import { addWorkingDays } from "@/lib/shipping-rates";
export { formatOrderNumber } from "@/lib/utils";

export function addWorkingDaysLabel(created: Date) {
  const london = new Date(created.toLocaleString("en-US", { timeZone: "Europe/London" }));
  const sameDay = london.getDay() >= 1 && london.getDay() <= 5 && london.getHours() < 14;
  const dispatch = sameDay ? london : addWorkingDays(london, 1);
  return sameDay ? "We'll dispatch your order today." : `We'll dispatch your order on ${dispatch.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}.`;
}
