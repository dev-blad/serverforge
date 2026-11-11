"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const gbp = (p: number) => `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;

export function RevenueChart({ data }: { data: { label: string; revenue: number; orders: number }[] }) {
  return (
    <div className="h-72 w-full" role="img" aria-label="Revenue over time bar chart. A table view follows.">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="#e3e8e4" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#c9d1cc" }} tick={{ fontSize: 11, fill: "#55645c" }} interval="preserveStartEnd" minTickGap={16} />
          <YAxis tickFormatter={gbp} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#55645c" }} width={56} />
          <Tooltip
            cursor={{ fill: "rgba(13,59,46,0.06)" }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e3e8e4", fontSize: 12 }}
            formatter={(value, _n, item) => [`${gbp(Number(value))} · ${(item.payload as { orders: number }).orders} orders`, "Revenue"]}
          />
          <Bar dataKey="revenue" fill="#1f7a55" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
