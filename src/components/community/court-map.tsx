"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export interface MapVenue { id: string; name: string; city: string; lat: number; lng: number; courts: number; indoor: boolean }

export default function CourtMap({ venues, center }: { venues: MapVenue[]; center?: [number, number] }) {
  return (
    <MapContainer center={center ?? [53.5, -2.2]} zoom={center ? 10 : 6} scrollWheelZoom={false} className="h-[420px] w-full rounded-xl" aria-label="Map of padel courts">
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {venues.map((v) => (
        <CircleMarker key={v.id} center={[v.lat, v.lng]} radius={9} pathOptions={{ color: "#ffffff", weight: 2, fillColor: "#0d3b2e", fillOpacity: 0.9 }}>
          <Popup>
            <strong>{v.name}</strong>
            <br />
            {v.city} · {v.courts} courts · {v.indoor ? "indoor" : "outdoor"}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
