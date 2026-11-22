import { currentStaff } from "@/lib/auth.js";
import { sql } from "@/lib/db.js";
import { json, fail } from "@/lib/util.js";
import { nowLocal } from "@/lib/time.js";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await currentStaff();
  if (!s) return fail("Neautentificat", 401);
  const [doctors, schedules] = await Promise.all([
    sql`select id, name, role, specs, photo, slot_minutes from doctors where active order by sort, name`,
    sql`select doctor_id, weekday, to_char(start_time,'HH24:MI') as s, to_char(end_time,'HH24:MI') as e from schedules order by start_time`,
  ]);
  return json({ me: s, doctors, schedules, today: nowLocal().day, phone: process.env.CLINIC_PHONE || "0752 192 733" });
}
