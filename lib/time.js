// Toate datele și orele clinicii sunt în Europe/Bucharest. Zilele sunt șiruri „YYYY-MM-DD”.
export const TZ = "Europe/Bucharest";

export function nowLocal() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date()).map((x) => [x.type, x.value])
  );
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function addDays(day, n) {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekday = (day) => new Date(day + "T00:00:00Z").getUTCDay();
export const toMin = (t) => { const [h, m] = String(t).slice(0, 5).split(":").map(Number); return h * 60 + m; };
export const toTime = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const isDay = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + "T00:00:00Z"));
export const isTime = (s) => /^\d{2}:\d{2}$/.test(s);
export function fmtLong(day) {
  return new Date(day + "T12:00:00Z").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
