"use client";

import { Ruler, X } from "lucide-react";
import { useRef } from "react";

const RACKET = (
  <div className="space-y-4 text-sm">
    <table className="w-full text-left">
      <caption className="mb-2 text-left font-semibold">Racket shape</caption>
      <thead><tr className="border-b border-line"><th className="py-2">Shape</th><th>Sweet spot</th><th>Best for</th></tr></thead>
      <tbody>
        <tr className="border-b border-line"><td className="py-2 font-medium">Round</td><td>Large, central</td><td>Beginners, control & defensive players</td></tr>
        <tr className="border-b border-line"><td className="py-2 font-medium">Teardrop</td><td>Medium, slightly high</td><td>All-round players wanting balance</td></tr>
        <tr><td className="py-2 font-medium">Diamond</td><td>Small, high</td><td>Advanced, attacking players</td></tr>
      </tbody>
    </table>
    <table className="w-full text-left">
      <caption className="mb-2 text-left font-semibold">Weight</caption>
      <tbody>
        <tr className="border-b border-line"><td className="py-2 font-medium">Under 350 g</td><td>Fast and easy to handle — juniors, beginners, players with arm issues</td></tr>
        <tr className="border-b border-line"><td className="py-2 font-medium">350–365 g</td><td>The sweet spot for most adult players</td></tr>
        <tr><td className="py-2 font-medium">365 g +</td><td>More power and stability; needs good technique</td></tr>
      </tbody>
    </table>
    <p><strong>Balance:</strong> low = control & manoeuvrability, high = power (more weight in the head). <strong>Core:</strong> soft EVA/foam is comfortable and gives easy depth; hard EVA gives control and power for fast swings.</p>
    <p>Elbow or shoulder niggles? Choose a round or teardrop racket under 360 g with a soft core.</p>
  </div>
);

const SIZES = (
  <div className="space-y-4 text-sm">
    <table className="w-full text-left">
      <caption className="mb-2 text-left font-semibold">Footwear (UK / EU / foot length)</caption>
      <thead><tr className="border-b border-line"><th className="py-2">UK</th><th>EU</th><th>cm</th></tr></thead>
      <tbody>
        {[[4, 37, 23.5], [5, 38, 24.1], [6, 39, 24.8], [7, 40.5, 25.4], [8, 42, 26.0], [9, 43, 26.7], [10, 44.5, 27.3], [11, 46, 27.9], [12, 47, 28.6]].map(([uk, eu, cm]) => (
          <tr key={uk} className="border-b border-line"><td className="py-1.5">{uk}</td><td>{eu}</td><td>{cm}</td></tr>
        ))}
      </tbody>
    </table>
    <table className="w-full text-left">
      <caption className="mb-2 text-left font-semibold">Clothing (chest, cm)</caption>
      <tbody>
        {[["XS", "81–86"], ["S", "86–94"], ["M", "94–102"], ["L", "102–110"], ["XL", "110–118"], ["XXL", "118–126"]].map(([s, c]) => (
          <tr key={s} className="border-b border-line"><td className="py-1.5 font-medium">{s}</td><td>{c}</td></tr>
        ))}
      </tbody>
    </table>
    <p>Between sizes? For padel shoes we recommend going up half a size to allow for sports socks.</p>
  </div>
);

export function GuideDialog({ kind }: { kind: "racket" | "size" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = kind === "racket" ? "Racket buying guide" : "Size guide";
  return (
    <>
      <button type="button" onClick={() => ref.current?.showModal()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 underline">
        <Ruler className="size-4" aria-hidden /> {title}
      </button>
      <dialog ref={ref} aria-label={title} className="m-auto w-[92vw] max-w-lg rounded-2xl p-0 backdrop:bg-black/60">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={() => ref.current?.close()} className="grid size-9 place-items-center" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-5">{kind === "racket" ? RACKET : SIZES}</div>
      </dialog>
    </>
  );
}
