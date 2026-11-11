"use client";

import dynamic from "next/dynamic";
import { ExternalLink, LocateFixed, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import type { MapVenue } from "./court-map";

const CourtMap = dynamic(() => import("./court-map"), { ssr: false, loading: () => <div className="grid h-[420px] place-items-center rounded-xl bg-canvas text-sm text-muted">Loading map…</div> });

interface Venue extends MapVenue { region: string; website: string | null; playtomicUrl: string | null; isDemo: boolean }

function km(a: [number, number], b: [number, number]) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function CourtFinder({ venues }: { venues: Venue[] }) {
  const [q, setQ] = useState("");
  const [indoor, setIndoor] = useState(false);
  const [me, setMe] = useState<[number, number] | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const list = useMemo(() => {
    const filtered = venues.filter((v) => (!q || `${v.name} ${v.city} ${v.region}`.toLowerCase().includes(q.toLowerCase())) && (!indoor || v.indoor));
    return me ? [...filtered].sort((a, b) => km(me, [a.lat, a.lng]) - km(me, [b.lat, b.lng])) : filtered;
  }, [venues, q, indoor, me]);

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor="cf-q" className="label">Town, city or region</label>
          <input id="cf-q" value={q} onChange={(e) => setQ(e.target.value)} className="input" placeholder="e.g. Manchester" />
        </div>
        <label className="flex items-center gap-2 pb-3 text-sm"><input type="checkbox" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} className="size-4 accent-brand-900" /> Indoor only</label>
        <button
          type="button"
          className="btn-outline"
          onClick={() => {
            setGeoError(null);
            navigator.geolocation?.getCurrentPosition(
              (p) => setMe([p.coords.latitude, p.coords.longitude]),
              () => setGeoError("Couldn't get your location — try searching by town instead."),
            );
          }}
        >
          <LocateFixed className="size-4" aria-hidden /> Near me
        </button>
        <button type="button" className="btn-primary" onClick={() => setShowMap(!showMap)} aria-expanded={showMap}>
          <MapPin className="size-4" aria-hidden /> {showMap ? "Hide map" : "Show map"}
        </button>
      </div>
      {geoError && <p role="alert" className="mt-2 text-sm text-sale">{geoError}</p>}
      {showMap && (
        <div className="mt-4">
          <CourtMap venues={list} center={me ?? undefined} />
          <p className="mt-1 text-xs text-muted">Map tiles load from OpenStreetMap only when you open the map.</p>
        </div>
      )}
      <ul className="mt-6 grid gap-3 md:grid-cols-2">
        {list.map((v) => (
          <li key={v.id} className="card flex flex-col gap-2 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{v.name}</p>
                <p className="text-sm text-muted">{v.city}, {v.region} · {v.courts} courts · {v.indoor ? "Indoor" : "Outdoor"}{me ? ` · ${km(me, [v.lat, v.lng]).toFixed(0)} km away` : ""}</p>
              </div>
              {v.isDemo && <span className="badge bg-canvas text-muted ring-1 ring-line">example</span>}
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <a href={v.playtomicUrl ?? "https://playtomic.com/"} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">
                Book on Playtomic <ExternalLink className="size-3.5" aria-hidden /><span className="sr-only">(opens in new tab)</span>
              </a>
              {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer" className="btn-outline btn-sm">Venue website</a>}
            </div>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-muted">No venues match — try a nearby city.</li>}
      </ul>
    </div>
  );
}
