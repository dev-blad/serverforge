import { SHIPPING_FROM, features } from "@/lib/config";
import { getShippingMethod } from "@/lib/shipping-rates";
import { renderStubLabel } from "./pdf";
import { trackingUrlFor, type LabelRequest, type LabelResult, type ShippingProvider } from "./types";

/** Local provider: generates a realistic (but clearly marked DEMO) PDF label. No credentials needed. */
export const stubProvider: ShippingProvider = {
  id: "stub",
  async createLabel(req) {
    const method = getShippingMethod(req.serviceId);
    const digits = String(Date.now()).slice(-9);
    const trackingNumber = method.carrier === "Evri" ? `H01DEMO${digits}` : `DM${digits}GB`;
    const labelPdf = await renderStubLabel({
      carrier: method.carrier,
      service: method.name,
      trackingNumber,
      orderReference: req.orderReference,
      weightGrams: req.weightGrams,
      to: req.recipient,
    });
    return { provider: "stub", carrier: method.carrier, service: method.name, trackingNumber, trackingUrl: null, labelPdf };
  },
};

/**
 * Royal Mail Click & Drop — https://api.parcel.royalmail.com/api/v1
 * Creates the order and asks for the label in the response (requires label printing via API
 * to be enabled on your Click & Drop account — not available on OLP accounts).
 */
export const royalMailProvider: ShippingProvider = {
  id: "royalmail",
  async createLabel(req) {
    const key = process.env.ROYALMAIL_API_KEY;
    if (!key) throw new Error("ROYALMAIL_API_KEY is not set");
    const base = process.env.ROYALMAIL_API_BASE ?? "https://api.parcel.royalmail.com/api/v1";
    const method = getShippingMethod(req.serviceId);
    // Evri isn't available through Click & Drop — Evri orders are sent as Tracked 48.
    const serviceCode =
      req.serviceId === "rm-tracked24"
        ? (process.env.ROYALMAIL_SERVICE_TRACKED24 ?? "TOLP24")
        : (process.env.ROYALMAIL_SERVICE_TRACKED48 ?? "TOLP48");
    const body = {
      items: [
        {
          orderReference: req.orderReference,
          recipient: {
            address: {
              fullName: req.recipient.name,
              addressLine1: req.recipient.line1,
              addressLine2: req.recipient.line2 || undefined,
              city: req.recipient.city,
              county: req.recipient.county || undefined,
              postcode: req.recipient.postcode,
              countryCode: req.recipient.country || "GB",
            },
            phoneNumber: req.recipient.phone || undefined,
            emailAddress: req.recipient.email || undefined,
          },
          packages: [
            {
              weightInGrams: req.weightGrams,
              packageFormatIdentifier: req.parcelFormat,
              contents: req.items.map((i) => ({
                name: i.name.slice(0, 800),
                SKU: i.sku,
                quantity: i.quantity,
                unitValue: i.unitPrice / 100,
                unitWeightInGrams: i.weightGrams,
              })),
            },
          ],
          orderDate: req.orderDate.toISOString(),
          subtotal: req.subtotal / 100,
          shippingCostCharged: req.shipping / 100,
          total: req.total / 100,
          currencyCode: "GBP",
          postageDetails: { sendNotificationsTo: "recipient", serviceCode, receiveEmailNotification: true },
          label: { includeLabelInResponse: true, includeCN: false, includeReturnsLabel: false },
        },
      ],
    };
    const res = await fetch(`${base}/orders`, {
      method: "POST",
      headers: { Authorization: key, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as {
      createdOrders?: { orderIdentifier: number; trackingNumber?: string; label?: string }[];
      failedOrders?: { errors?: { errorMessage?: string }[] }[];
    };
    const created = json.createdOrders?.[0];
    if (!res.ok || !created) {
      const msg = json.failedOrders?.[0]?.errors?.map((e) => e.errorMessage).join("; ") ?? `HTTP ${res.status}`;
      throw new Error(`Click & Drop: ${msg}`);
    }
    let labelPdf: Uint8Array | null = created.label ? Buffer.from(created.label, "base64") : null;
    if (!labelPdf) {
      // Fallback: fetch the label document separately.
      const lr = await fetch(
        `${base}/orders/${created.orderIdentifier}/label?documentType=postageLabel&includeReturnsLabel=false`,
        { headers: { Authorization: key } },
      );
      if (lr.ok) labelPdf = new Uint8Array(await lr.arrayBuffer());
    }
    const trackingNumber = created.trackingNumber ?? `CD${created.orderIdentifier}`;
    return {
      provider: "royalmail",
      carrier: "Royal Mail",
      service: method.carrier === "Royal Mail" ? method.name : "Royal Mail Tracked 48",
      trackingNumber,
      trackingUrl: created.trackingNumber ? trackingUrlFor("Royal Mail", created.trackingNumber) : null,
      labelPdf,
      externalId: String(created.orderIdentifier),
    };
  },
};

/** ShipStation (v1 API) — POST /shipments/createlabel. Supports Royal Mail and Evri carriers connected to your account. */
export const shipStationProvider: ShippingProvider = {
  id: "shipstation",
  async createLabel(req) {
    const key = process.env.SHIPSTATION_API_KEY;
    const secret = process.env.SHIPSTATION_API_SECRET;
    if (!key || !secret) throw new Error("SHIPSTATION_API_KEY / SHIPSTATION_API_SECRET are not set");
    const method = getShippingMethod(req.serviceId);
    const isEvri = method.carrier === "Evri";
    const carrierCode = isEvri
      ? (process.env.SHIPSTATION_CARRIER_EVRI ?? "evri")
      : (process.env.SHIPSTATION_CARRIER_ROYALMAIL ?? "royal_mail");
    const serviceCode = {
      "evri-48": process.env.SHIPSTATION_SERVICE_EVRI ?? "evri_standard",
      "rm-tracked48": process.env.SHIPSTATION_SERVICE_TRACKED48 ?? "rm_tracked_48",
      "rm-tracked24": process.env.SHIPSTATION_SERVICE_TRACKED24 ?? "rm_tracked_24",
    }[req.serviceId];
    const addr = (a: typeof req.recipient) => ({
      name: a.name,
      street1: a.line1,
      street2: a.line2 || null,
      city: a.city,
      state: a.county || null,
      postalCode: a.postcode,
      country: a.country || "GB",
      phone: a.phone || null,
    });
    const res = await fetch(`${process.env.SHIPSTATION_API_BASE ?? "https://ssapi.shipstation.com"}/shipments/createlabel`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        carrierCode,
        serviceCode,
        packageCode: "package",
        confirmation: "none",
        shipDate: new Date().toISOString().slice(0, 10),
        weight: { value: req.weightGrams, units: "grams" },
        shipFrom: addr({ ...SHIPPING_FROM, country: "GB" }),
        shipTo: addr(req.recipient),
        testLabel: process.env.SHIPSTATION_TEST_LABELS !== "false",
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { trackingNumber?: string; labelData?: string; shipmentId?: number; Message?: string };
    if (!res.ok || !json.trackingNumber) throw new Error(`ShipStation: ${json.Message ?? `HTTP ${res.status}`}`);
    return {
      provider: "shipstation",
      carrier: method.carrier,
      service: method.name,
      trackingNumber: json.trackingNumber,
      trackingUrl: trackingUrlFor(method.carrier, json.trackingNumber),
      labelPdf: json.labelData ? Buffer.from(json.labelData, "base64") : null,
      externalId: json.shipmentId ? String(json.shipmentId) : undefined,
    };
  },
};

export function getShippingProvider(): ShippingProvider {
  switch (features.shippingProvider) {
    case "royalmail":
      return royalMailProvider;
    case "shipstation":
      return shipStationProvider;
    default:
      return stubProvider;
  }
}
