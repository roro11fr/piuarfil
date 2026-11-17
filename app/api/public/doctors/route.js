import { sql } from "@/lib/db.js";
import { json } from "@/lib/util.js";
export const dynamic = "force-dynamic";

export async function GET() {
  const docs = await sql`
    select d.id, d.name, d.role, d.specs, d.photo, d.slot_minutes,
           coalesce(array_agg(distinct s.weekday) filter (where s.weekday is not null), '{}') as days
    from doctors d left join schedules s on s.doctor_id = d.id
    where d.active group by d.id order by d.sort, d.name`;
  return json({ doctors: docs, phone: process.env.CLINIC_PHONE || "0752 192 733" });
}
