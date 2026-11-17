import { currentStaff } from "@/lib/auth.js";
import { sql } from "@/lib/db.js";
import { json, fail } from "@/lib/util.js";
import { nowLocal } from "@/lib/time.js";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await currentStaff();
  if (!s) return fail("Neautentificat", 401);
  const doctors = await sql`select id, name, role, specs, photo from doctors where active order by sort, name`;
  return json({ me: s, doctors, today: nowLocal().day, phone: process.env.CLINIC_PHONE || "0752 192 733" });
}
