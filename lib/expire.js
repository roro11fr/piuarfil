import { sql } from "./db.js";
import { notify } from "./email.js";

/** Cererile pe care recepția nu le-a confirmat până în ziua programării se eliberează automat,
 *  ca ora să nu rămână blocată, iar pacientul primește email. Rulează la citirea disponibilității
 *  sau a listei (cel mult o dată pe minut pe instanță) și în jobul de seară. */
let last = 0;
export async function expireStale({ force = false } = {}) {
  if (!force && Date.now() - last < 60_000) return 0;
  last = Date.now();
  const rows = await sql`
    with x as (
      update appointments set status = 'cancelled', cancelled_by = 'system', notified = false, updated_at = now(),
             note = 'Cererea nu a fost confirmată de recepție până în ziua programării'
      where status = 'pending' and day <= (now() at time zone 'Europe/Bucharest')::date
      returning *
    ) select x.*, x.day::text as day, d.name as doctor_name from x join doctors d on d.id = x.doctor_id`;
  for (const a of rows) {
    const { sent } = await notify("expired", a, a.doctor_name, null);
    if (sent) await sql`update appointments set notified = true where id = ${a.id}`;
  }
  return rows.length;
}
