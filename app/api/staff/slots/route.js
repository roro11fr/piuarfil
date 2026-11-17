import { requireStaff } from "@/lib/auth.js";
import { availability } from "@/lib/slots.js";
import { addDays, nowLocal } from "@/lib/time.js";
import { json, fail } from "@/lib/util.js";
export const dynamic = "force-dynamic";

// Ore libere pentru recepție (programări telefonice, mutări): de azi, 35 de zile.
export async function GET(req) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  const q = new URL(req.url).searchParams;
  const a = await availability(q.get("doctor"), nowLocal().day, 35, { exceptId: q.get("except") || null });
  if (!a) return fail("Medicul nu există", 404);
  return json({ days: a.filter((d) => d.slots.some((s) => s.free)).map((d) => ({ day: d.day, slots: d.slots.filter((s) => s.free).map((s) => s.t) })) });
}
