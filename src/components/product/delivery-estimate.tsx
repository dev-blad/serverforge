"use client";

import { Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { addWorkingDays, SHIPPING_METHODS } from "@/lib/shipping-rates";

function londonNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/London" }));
}

export function DeliveryEstimate({ cutoffHour = 14 }: { cutoffHour?: number }) {
  const [text, setText] = useState<{ countdown: string | null; date: string } | null>(null);
  useEffect(() => {
    const update = () => {
      const now = londonNow();
      const weekday = now.getDay() >= 1 && now.getDay() <= 5;
      const beforeCutoff = weekday && now.getHours() < cutoffHour;
      let countdown: string | null = null;
      if (beforeCutoff) {
        const mins = cutoffHour * 60 - (now.getHours() * 60 + now.getMinutes());
        countdown = `${Math.floor(mins / 60)}h ${mins % 60}m`;
      }
      const dispatch = beforeCutoff ? now : addWorkingDays(now, 1);
      const std = SHIPPING_METHODS[0]!;
      const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      setText({ countdown, date: `${fmt(addWorkingDays(dispatch, std.minDays))} – ${fmt(addWorkingDays(dispatch, std.maxDays))}` });
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, [cutoffHour]);

  return (
    <div className="flex items-start gap-3 rounded-lg bg-canvas p-3 text-sm">
      <Truck className="mt-0.5 size-5 shrink-0 text-brand-600" aria-hidden />
      <p className="min-h-10">
        {text ? (
          <>
            {text.countdown ? (
              <>
                Order within <strong className="text-brand-700">{text.countdown}</strong> for <strong>same-day dispatch</strong>.{" "}
              </>
            ) : (
              <>Dispatched next working day. </>
            )}
            Estimated delivery <strong>{text.date}</strong> with Royal Mail Tracked 48.
          </>
        ) : (
          "Calculating delivery estimate…"
        )}
      </p>
    </div>
  );
}
