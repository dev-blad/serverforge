import { features } from "@/lib/config";

export interface PrintResult {
  ok: boolean;
  jobId: string | null;
  stubbed: boolean;
  error?: string;
}

/**
 * Send a PDF to a printer via PrintNode (https://www.printnode.com).
 * Install the PrintNode client on the computer attached to your label printer,
 * then set PRINTNODE_API_KEY and PRINTNODE_PRINTER_ID.
 */
export async function printPdf(opts: { title: string; pdf: Uint8Array; kind: "label" | "slip" }): Promise<PrintResult> {
  if (!features.printNode) return { ok: true, jobId: null, stubbed: true };
  const printerId = Number(
    opts.kind === "slip" ? (process.env.PRINTNODE_SLIP_PRINTER_ID ?? process.env.PRINTNODE_PRINTER_ID) : process.env.PRINTNODE_PRINTER_ID,
  );
  try {
    const res = await fetch("https://api.printnode.com/printjobs", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.PRINTNODE_API_KEY}:`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        printerId,
        title: opts.title,
        contentType: "pdf_base64",
        content: Buffer.from(opts.pdf).toString("base64"),
        source: "Courtline Padel store",
        // Label printers: let the driver scale to 4x6
        options: opts.kind === "label" ? { fit_to_page: true } : undefined,
      }),
    });
    const body = await res.text();
    if (!res.ok) return { ok: false, jobId: null, stubbed: false, error: `PrintNode HTTP ${res.status}: ${body.slice(0, 200)}` };
    return { ok: true, jobId: body.trim(), stubbed: false };
  } catch (e) {
    return { ok: false, jobId: null, stubbed: false, error: e instanceof Error ? e.message : String(e) };
  }
}
