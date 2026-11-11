"use client";

import { useState } from "react";
import type { ProductCardData } from "@/lib/catalog";
import { ProductCard } from "@/components/product/product-card";

type Racket = ProductCardData & { shape: string | null; level: string | null; balance: string | null; weight: number | null; soft: boolean };

const QUESTIONS = [
  { key: "level", q: "How long have you been playing?", options: [["Beginner", "Less than 6 months"], ["Intermediate", "6 months – 2 years, play weekly"], ["Advanced", "2+ years, competitive / league"], ["Junior", "Buying for a junior (8–13)"]] },
  { key: "style", q: "How would you describe your game?", options: [["control", "Patient — I like long rallies and placement"], ["all", "A bit of everything"], ["power", "Aggressive — I love to smash and finish at the net"]] },
  { key: "arm", q: "Any elbow, wrist or shoulder niggles?", options: [["yes", "Yes — comfort matters"], ["no", "No issues"]] },
  { key: "budget", q: "What's your budget?", options: [["100", "Up to £100"], ["180", "Up to £180"], ["999", "Whatever it takes"]] },
] as const;

function score(r: Racket, a: Record<string, string>) {
  let s = 0;
  if (r.totalStock <= 0) s -= 50;
  if (a.level && r.level === a.level) s += 30;
  if (a.level === "Intermediate" && r.level === "Beginner") s += 8;
  if (a.level === "Advanced" && r.level === "Intermediate") s += 10;
  const shapeFor = { control: "Round", all: "Teardrop", power: "Diamond" } as Record<string, string>;
  if (a.style && r.shape === shapeFor[a.style]) s += 20;
  if (a.style === "power" && r.balance === "High") s += 8;
  if (a.style === "control" && r.balance === "Low") s += 8;
  if (a.arm === "yes") s += (r.soft ? 15 : -10) + ((r.weight ?? 360) < 360 ? 8 : -5);
  if (a.budget && r.price > Number(a.budget) * 100) s -= 40;
  s += r.ratingAvg;
  return s;
}

export function RacketFinder({ rackets }: { rackets: Racket[] }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [step, setStep] = useState(0);
  const done = step >= QUESTIONS.length;
  const results = done ? [...rackets].sort((x, y) => score(y, answers) - score(x, answers)).slice(0, 3) : [];
  const q = QUESTIONS[Math.min(step, QUESTIONS.length - 1)]!;

  return (
    <div className="mt-8">
      {!done ? (
        <div className="card max-w-2xl p-6 sm:p-8">
          <p className="text-xs font-bold tracking-widest text-brand-600 uppercase">
            Question {step + 1} of {QUESTIONS.length}
          </p>
          <div className="mt-2 h-1.5 rounded-full bg-canvas" aria-hidden>
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${(step / QUESTIONS.length) * 100}%` }} />
          </div>
          <fieldset className="mt-5">
            <legend className="text-xl font-bold">{q.q}</legend>
            <div className="mt-4 grid gap-2">
              {q.options.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className="rounded-lg border border-line px-4 py-3 text-left text-sm font-medium hover:border-brand-900 hover:bg-canvas"
                  onClick={() => {
                    setAnswers({ ...answers, [q.key]: value });
                    setStep(step + 1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {step > 0 && (
            <button type="button" className="mt-4 text-sm text-muted underline" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-extrabold" tabIndex={-1} ref={(el) => el?.focus()}>
            Your top matches
          </h2>
          <p className="mt-1 text-muted">Based on your answers. Still unsure? Use the chat button — we&apos;re players too.</p>
          <ul className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
            {results.map((r) => (
              <li key={r.id}>
                <ProductCard p={r} />
              </li>
            ))}
          </ul>
          <button type="button" className="btn-outline mt-6" onClick={() => { setAnswers({}); setStep(0); }}>
            Start again
          </button>
        </div>
      )}
    </div>
  );
}
