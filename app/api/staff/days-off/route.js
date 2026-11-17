import { sql } from "@/lib/db.js";
import { requireStaff } from "@/lib/auth.js";
import { isDay, nowLocal } from "@/lib/time.js";
import { json, fail } from "@/lib/util.js";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  const rows = await sql`select o.doctor_id, d.name as doctor_name, o.day::text as day, o.reason
    from days_off o join doctors d on d.id = o.doctor_id where o.day >= ${nowLocal().day} order by o.day, d.sort`;
  return json({ daysOff: rows });
}
export async function POST(req) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  const { doctor, day, reason = "" } = await req.json().catch(() => ({}));
  if (!doctor || !isDay(day) || day < nowLocal().day) return fail("Alege medicul și o zi din viitor.");
  await sql`insert into days_off (doctor_id, day, reason) values (${doctor}, ${day}, ${String(reason).slice(0, 200) || null}) on conflict do nothing`;
  const [{ n }] = await sql`select count(*)::int as n from appointments where doctor_id = ${doctor} and day = ${day} and status in ('pending','confirmed')`;
  return json({ ok: true, clashes: n });
}
export async function DELETE(req) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  const q = new URL(req.url).searchParams;
  await sql`delete from days_off where doctor_id = ${q.get("doctor")} and day = ${q.get("day")}`;
  return json({ ok: true });
}
