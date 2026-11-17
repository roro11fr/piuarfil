import { sql } from "./db.js";

/** Cererile pe care recepția nu le-a confirmat până în ziua programării se eliberează automat,
 *  ca ora să nu rămână blocată. Rulează la fiecare citire a disponibilității sau a listei (cost mic,
 *  folosește indexul pe zi), deci nu e nevoie de un job programat. */
let last = 0;
export async function expireStale() {
  if (Date.now() - last < 60_000) return; // cel mult o dată pe minut pe instanță
  last = Date.now();
  await sql`
    update appointments set status = 'cancelled', cancelled_by = 'system', notified = false, updated_at = now(),
           note = 'Cererea nu a fost confirmată de recepție până în ziua programării'
    where status = 'pending' and day <= (now() at time zone 'Europe/Bucharest')::date`;
}
