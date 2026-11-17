import { sql } from "./db.js";
import { expireStale } from "./expire.js";

export async function loadByToken(token) {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null;
  await expireStale();
  const [a] = await sql`
    select a.id, a.status, a.spec, a.day::text as day, to_char(a.slot,'HH24:MI') as slot, a.patient_name, a.child_name,
           a.email, a.note, a.ref, a.cancelled_by, d.name as doctor_name, d.photo as doctor_photo,
           extract(epoch from ((a.day + a.slot) at time zone 'Europe/Bucharest') - now()) / 3600 as hours_left
    from appointments a join doctors d on d.id = a.doctor_id where a.token = ${token}`;
  return a || null;
}

