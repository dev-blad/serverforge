"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function Gallery({ images, name }: { images: string[]; name: string }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const current = images[index] ?? images[0]!;
  const n = images.length;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (!d.open) return;
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % n);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + n) % n);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [n]);

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
      <ul className="flex gap-2 sm:flex-col" aria-label="Product images">
        {images.map((src, i) => (
          <li key={src}>
            <button
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1} of ${n}`}
              aria-current={i === index}
              className={`relative block size-16 overflow-hidden rounded-lg bg-canvas ring-2 sm:size-20 ${i === index ? "ring-brand-900" : "ring-transparent hover:ring-line"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny SVG thumbnails */}
              <img src={src} alt="" width={80} height={80} loading="lazy" className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>
      <div className="relative flex-1">
        <button
          type="button"
          className="relative block aspect-square w-full cursor-zoom-in overflow-hidden rounded-2xl bg-canvas"
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
          }}
          onMouseLeave={() => setZoom(null)}
          onClick={() => dialogRef.current?.showModal()}
          aria-label={`Open full-screen image of ${name}`}
        >
          <Image
            src={current}
            alt={`${name} — image ${index + 1}`}
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover transition-transform duration-150"
            style={zoom ? { transform: "scale(2)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined}
            unoptimized
          />
          <span className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold shadow">
            <ZoomIn className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Hover to zoom · click to expand</span><span className="sm:hidden">Tap to expand</span>
          </span>
        </button>
      </div>

      <dialog ref={dialogRef} className="m-auto max-h-[95dvh] w-[95vw] max-w-4xl rounded-2xl p-0 backdrop:bg-black/80" aria-label={`${name} images`}>
        <div className="relative aspect-square w-full bg-canvas">
          <Image src={current} alt={`${name} — image ${index + 1}`} fill sizes="95vw" className="object-contain" unoptimized />
          <button type="button" onClick={() => dialogRef.current?.close()} className="absolute top-3 right-3 grid size-10 place-items-center rounded-full bg-white shadow" aria-label="Close">
            <X className="size-5" aria-hidden />
          </button>
          {n > 1 && (
            <>
              <button type="button" onClick={() => setIndex((index - 1 + n) % n)} className="absolute top-1/2 left-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white shadow" aria-label="Previous image">
                <ChevronLeft className="size-5" aria-hidden />
              </button>
              <button type="button" onClick={() => setIndex((index + 1) % n)} className="absolute top-1/2 right-3 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white shadow" aria-label="Next image">
                <ChevronRight className="size-5" aria-hidden />
              </button>
            </>
          )}
        </div>
      </dialog>
    </div>
  );
}
