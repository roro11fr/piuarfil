import { z } from "zod";
import { sql } from "@/lib/db.js";
import { slotIsFree, BOOKING_DAYS } from "@/lib/slots.js";
import { addDays, nowLocal, isDay, isTime } from "@/lib/time.js";
import { json, fail, digits, baseUrl, insertAppointment } from "@/lib/util.js";
import { notify } from "@/lib/email.js";
export const dynamic = "force-dynamic";

const t = (max) => z.string().trim().max(max);
const Body = z.object({
  doctor: z.string().min(1).max(40),
  spec: z.string().min(1).max(80),
  day: z.string().refine(isDay),
  slot: z.string().refine(isTime),
  forChild: z.boolean().default(false),
  childName: t(80).optional().default(""),
  childAge: t(30).optional().default(""),
  name: t(80).min(3),
  phone: z.string().refine((p) => { const d = digits(p); return d.length >= 10 && d.length <= 13; }),
  email: z.union([z.literal(""), z.string().trim().email().max(120)]).optional().default(""),
  reason: t(1000).min(3),
  prevResults: t(1000).optional().default(""),
  prevConsults: t(1000).optional().default(""),
  urgent: z.boolean(),
  consent: z.literal(true),
  website: z.string().max(0).optional().default(""), // capcană pentru boți: câmp ascuns, trebuie gol
});

export async function POST(req) {
  let b;
  try { b = Body.parse(await req.json()); }
  catch { return fail("Datele formularului nu sunt complete. Verifică câmpurile marcate cu *."); }
  if (b.forChild && b.childName.length < 3) return fail("Completează numele copilului.");

  const [doc] = await sql`select id, name, specs from doctors where id = ${b.doctor} and active`;
  if (!doc || !doc.specs.includes(b.spec)) return fail("Medicul sau specialitatea nu există.");
  const first = addDays(nowLocal().day, 1), last = addDays(first, BOOKING_DAYS - 1);
  if (b.day < first || b.day > last) return fail("Ziua aleasă nu mai e disponibilă online.");
  if (!(await slotIsFree(b.doctor, b.day, b.slot))) return fail("Ora tocmai a fost luată de altcineva. Alege altă oră.", 409, { code: "SLOT_TAKEN" });

  const phone = digits(b.phone);
  const [{ n }] = await sql`select count(*)::int as n from appointments
    where phone = ${phone} and status in ('pending','confirmed') and day >= ${nowLocal().day}`;
  if (n >= 3) return fail("Ai deja 3 programări active cu acest număr. Sună la recepție pentru altele.", 429);

  let a;
  try {
    a = await insertAppointment(sql, {
      doctor_id: b.doctor, spec: b.spec, day: b.day, slot: b.slot, status: "pending", source: "online",
      patient_name: b.name, phone, email: b.email || null,
      child_name: b.forChild ? b.childName : null, child_age: b.forChild ? b.childAge || null : null,
      reason: b.reason, prev_results: b.prevResults || null, prev_consults: b.prevConsults || null,
      urgent: b.urgent, consent_at: new Date(),
    });
  } catch (e) {
    if (e.code === "SLOT_TAKEN") return fail("Ora tocmai a fost luată de altcineva. Alege altă oră.", 409, { code: "SLOT_TAKEN" });
    throw e;
  }
  const link = `${baseUrl(req)}/p/${a.token}`;
  const mail = await notify("received", a, doc.name, link);
  return json({ ref: a.ref, link, emailSent: mail.sent }, 201);
}
