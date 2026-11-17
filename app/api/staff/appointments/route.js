import { z } from "zod";
import { sql } from "@/lib/db.js";
import { requireStaff } from "@/lib/auth.js";
import { slotIsFree } from "@/lib/slots.js";
import { isDay, isTime, addDays, nowLocal } from "@/lib/time.js";
import { json, fail, digits, baseUrl, insertAppointment } from "@/lib/util.js";
import { notify } from "@/lib/email.js";
import { expireStale } from "@/lib/expire.js";
export const dynamic = "force-dynamic";

const COLS = sql`a.id, a.ref, a.token, a.doctor_id, d.name as doctor_name, a.spec, a.day::text as day, to_char(a.slot,'HH24:MI') as slot,
  a.status, a.source, a.patient_name, a.phone, a.email, a.child_name, a.child_age, a.reason, a.prev_results, a.prev_consults,
  a.urgent, a.notified, a.reminded_at, a.cancelled_by, a.note, a.created_at, a.updated_at`;

// Lista programărilor. Medicii văd doar agenda lor.
export async function GET(req) {
  const auth = await requireStaff(req);
  if (auth.error) return fail(auth.error, auth.status);
  await expireStale();
  const q = new URL(req.url).searchParams;
  const today = nowLocal().day;
  const from = isDay(q.get("from")) ? q.get("from") : addDays(today, -14);
  const to = isDay(q.get("to")) ? q.get("to") : addDays(today, 60);
  const doctor = auth.staff.role === "doctor" ? auth.staff.doctor_id : q.get("doctor") || null;
  const rows = await sql`select ${COLS} from appointments a join doctors d on d.id = a.doctor_id
    where a.day between ${from} and ${to} and (${doctor}::text is null or a.doctor_id = ${doctor})
    order by a.day, a.slot`;
  return json({ appointments: rows, today });
}

// Programare primită la telefon: intră direct confirmată.
const Phone = z.object({
  doctor: z.string().min(1), day: z.string().refine(isDay), slot: z.string().refine(isTime),
  name: z.string().trim().min(3).max(80), phone: z.string().refine((p) => digits(p).length >= 10),
  email: z.union([z.literal(""), z.string().trim().email()]).optional().default(""),
  reason: z.string().trim().max(1000).optional().default(""),
  childName: z.string().trim().max(80).optional().default(""),
  spec: z.string().optional(),
});
export async function POST(req) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  let b; try { b = Phone.parse(await req.json()); } catch { return fail("Completează medicul, ora, numele și un telefon de 10 cifre."); }
  const [doc] = await sql`select id, name, specs from doctors where id = ${b.doctor} and active`;
  if (!doc) return fail("Medicul nu există.");
  if (!(await slotIsFree(b.doctor, b.day, b.slot))) return fail("Ora nu mai e liberă.", 409);
  let a;
  try {
    a = await sql.begin(async (tx) => {
      const r = await insertAppointment(tx, {
        doctor_id: b.doctor, spec: b.spec && doc.specs.includes(b.spec) ? b.spec : doc.specs[0], day: b.day, slot: b.slot,
        status: "confirmed", source: "telefon", patient_name: b.name, phone: digits(b.phone), email: b.email || null,
        child_name: b.childName || null, reason: b.reason || "Programare telefonică", notified: true,
      });
      await tx`insert into audit_log (staff_id, appointment_id, action) values (${auth.staff.id}, ${r.id}, 'phone_booking')`;
      return r;
    });
  } catch (e) { if (e.code === "SLOT_TAKEN") return fail("Ora nu mai e liberă.", 409); throw e; }
  await notify("confirmed", a, doc.name, `${baseUrl(req)}/p/${a.token}`);
  return json({ ref: a.ref }, 201);
}
