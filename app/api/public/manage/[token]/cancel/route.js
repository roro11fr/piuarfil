import { sql } from "@/lib/db.js";
import { CANCEL_HOURS } from "@/lib/slots.js";
import { json, fail } from "@/lib/util.js";
import { notify } from "@/lib/email.js";
import { loadByToken } from "@/lib/manage.js";
export const dynamic = "force-dynamic";

export async function POST(_req, { params }) {
  const token = (await params).token;
  const a = await loadByToken(token);
  if (!a) return fail("Linkul nu e valid.", 404);
  if (!(a.status === "pending" || a.status === "confirmed")) return fail("Programarea nu mai e activă.", 409);
  // Regula de 48h, verificată din nou în aceeași instrucțiune ca actualizarea.
  const [u] = await sql`
    update appointments set status = 'cancelled', cancelled_by = 'patient', note = 'Anulată de pacient din link', updated_at = now()
    where token = ${token} and status in ('pending','confirmed')
      and ((day + slot) at time zone 'Europe/Bucharest') - now() >= make_interval(hours => ${CANCEL_HOURS})
    returning id, email, spec, day::text as day, slot, child_name, cancelled_by`;
  if (!u) return fail(`Programarea e în mai puțin de ${CANCEL_HOURS} de ore. Sună la recepție ca s-o anulezi.`, 409);
  await sql`insert into audit_log (appointment_id, action, detail) values (${u.id}, 'cancel_by_patient', ${sql.json({})})`;
  await notify("cancelled", u, a.doctor_name, null);
  return json({ ok: true });
}
