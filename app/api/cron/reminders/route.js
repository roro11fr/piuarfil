import { sql } from "@/lib/db.js";
import { notify, emailEnabled } from "@/lib/email.js";
import { expireStale } from "@/lib/expire.js";
import { addDays, nowLocal } from "@/lib/time.js";
import { json, fail, baseUrl } from "@/lib/util.js";
export const dynamic = "force-dynamic";

// Rulează în fiecare seară (vercel.json → crons). Trimite reminder pe email pacienților programați mâine
// și eliberează cererile neconfirmate. Vercel trimite antetul Authorization: Bearer <CRON_SECRET>.
export async function GET(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return fail("Neautorizat", 401);
  const expired = await expireStale({ force: true });
  if (!emailEnabled()) return json({ ok: true, expired, reminded: 0, note: "Emailul nu e configurat (RESEND_API_KEY, EMAIL_FROM)." });

  const tomorrow = addDays(nowLocal().day, 1);
  const rows = await sql`select a.*, a.day::text as day, to_char(a.slot,'HH24:MI') as slot, d.name as doctor_name
    from appointments a join doctors d on d.id = a.doctor_id
    where a.day = ${tomorrow} and a.status = 'confirmed' and a.reminded_at is null and a.email is not null`;
  let reminded = 0;
  for (const a of rows) {
    const { sent } = await notify("reminder", a, a.doctor_name, `${baseUrl(req)}/p/${a.token}`);
    if (sent) { reminded++; await sql`update appointments set reminded_at = now() where id = ${a.id} and reminded_at is null`; }
  }
  return json({ ok: true, expired, reminded, of: rows.length });
}
