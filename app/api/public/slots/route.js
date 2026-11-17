import { availability, BOOKING_DAYS } from "@/lib/slots.js";
import { addDays, nowLocal } from "@/lib/time.js";
import { json, fail } from "@/lib/util.js";
export const dynamic = "force-dynamic";

export async function GET(req) {
  const doctor = new URL(req.url).searchParams.get("doctor");
  if (!doctor) return fail("Lipsește medicul");
  const from = addDays(nowLocal().day, 1); // programări online de mâine încolo
  const a = await availability(doctor, from, BOOKING_DAYS);
  if (!a) return fail("Medicul nu există", 404);
  return json({ days: a });
}
