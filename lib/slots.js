import { sql } from "./db.js";
import { addDays, weekday, toMin, toTime, nowLocal } from "./time.js";
import { expireStale } from "./expire.js";

export const BOOKING_DAYS = 21; // cât de departe se pot face programări online
export const CANCEL_HOURS = 48; // anulare online doar cu minimum 48h înainte

/** Disponibilitatea unui medic pe un interval de zile.
 *  Returnează [{ day, open, reason, slots:[{t, free}] }]. */
export async function availability(doctorId, fromDay, nDays, { exceptId = null, db = sql } = {}) {
  await expireStale();
  const toDay = addDays(fromDay, nDays - 1);
  const [doc] = await db`select id, slot_minutes, active from doctors where id = ${doctorId}`;
  if (!doc || !doc.active) return null;
  const [sched, off, hol, taken] = await Promise.all([
    db`select weekday, start_time::text as s, end_time::text as e from schedules where doctor_id = ${doctorId} order by start_time`,
    db`select day::text as day from days_off where doctor_id = ${doctorId} and day between ${fromDay} and ${toDay}`,
    db`select day::text as day, name from holidays where day between ${fromDay} and ${toDay}`,
    db`select day::text as day, to_char(slot,'HH24:MI') as t from appointments
       where doctor_id = ${doctorId} and day between ${fromDay} and ${toDay}
         and status in ('pending','confirmed') and (${exceptId}::uuid is null or id <> ${exceptId}::uuid)`,
  ]);
  const offSet = new Set(off.map((r) => r.day));
  const holMap = new Map(hol.map((r) => [r.day, r.name]));
  const takenSet = new Set(taken.map((r) => r.day + " " + r.t));
  const now = nowLocal();
  const out = [];
  for (let i = 0; i < nDays; i++) {
    const day = addDays(fromDay, i);
    const wd = weekday(day);
    const blocks = sched.filter((s) => s.weekday === wd);
    let reason = null;
    if (holMap.has(day)) reason = "Sărbătoare legală: " + holMap.get(day);
    else if (offSet.has(day)) reason = "Medicul nu e disponibil";
    else if (!blocks.length) reason = "Medicul nu consultă";
    const slots = [];
    if (!reason) {
      for (const b of blocks) {
        for (let m = toMin(b.s); m + doc.slot_minutes <= toMin(b.e); m += doc.slot_minutes) {
          const t = toTime(m);
          const past = day < now.day || (day === now.day && t <= now.time);
          slots.push({ t, free: !past && !takenSet.has(day + " " + t) });
        }
      }
    }
    out.push({ day, open: !reason && slots.some((s) => s.free), reason, slots });
  }
  return out;
}

export async function slotIsFree(doctorId, day, t, opts) {
  const a = await availability(doctorId, day, 1, opts);
  return !!a && a[0].slots.some((s) => s.t === t && s.free);
}
