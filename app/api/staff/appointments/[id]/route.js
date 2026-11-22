import { z } from "zod";
import { sql } from "@/lib/db.js";
import { requireStaff } from "@/lib/auth.js";
import { slotIsFree } from "@/lib/slots.js";
import { isDay, isTime } from "@/lib/time.js";
import { json, fail, baseUrl } from "@/lib/util.js";
import { notify } from "@/lib/email.js";
export const dynamic = "force-dynamic";

const Body = z.object({
  action: z.enum(["confirm", "reject", "cancel", "move", "notified", "reminded"]),
  note: z.string().trim().max(500).optional(),
  day: z.string().refine(isDay).optional(),
  slot: z.string().refine(isTime).optional(),
  value: z.boolean().optional(),
});
const ALLOWED = { confirm: ["pending"], reject: ["pending"], cancel: ["pending", "confirmed"], move: ["pending", "confirmed"], notified: ["confirmed", "rejected", "cancelled", "pending"], reminded: ["confirmed"] };

export async function POST(req, { params }) {
  const auth = await requireStaff(req, ["admin", "reception"]);
  if (auth.error) return fail(auth.error, auth.status);
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) return fail("Programare inexistentă", 404);
  let b; try { b = Body.parse(await req.json()); } catch { return fail("Acțiune invalidă"); }

  const [cur] = await sql`select a.*, d.name as doctor_name from appointments a join doctors d on d.id = a.doctor_id where a.id = ${id}`;
  if (!cur) return fail("Programare inexistentă", 404);
  if (!ALLOWED[b.action].includes(cur.status)) return fail("Programarea și-a schimbat statusul între timp. Reîncarcă lista.", 409);

  let set, mail = null;
  if (b.action === "confirm") { set = { status: "confirmed", notified: false }; mail = "confirmed"; }
  if (b.action === "reject") { set = { status: "rejected", note: b.note || "Medicul nu e disponibil în acest interval.", notified: false }; mail = "rejected"; }
  if (b.action === "cancel") { set = { status: "cancelled", cancelled_by: "staff", note: b.note || "Anulată de recepție", notified: false }; mail = "cancelled"; }
  if (b.action === "notified") set = { notified: !!b.value };
  if (b.action === "reminded") set = { reminded_at: new Date() };
  if (b.action === "move") {
    if (!b.day || !b.slot) return fail("Alege ziua și ora nouă.");
    if (!(await slotIsFree(cur.doctor_id, b.day, b.slot, { exceptId: id }))) return fail("Ora nouă nu mai e liberă.", 409);
    set = { day: b.day, slot: b.slot, status: "confirmed", notified: false, reminded_at: null, note: "Mutată de recepție" }; mail = "moved";
  }
  let row;
  try {
    row = await sql.begin(async (tx) => {
      const [r] = await tx`update appointments set ${tx({ ...set, updated_at: new Date() })}
        where id = ${id} and status = ${cur.status} returning *, day::text as day`;
      if (!r) throw Object.assign(new Error("RACE"), { code: "RACE" });
      await tx`insert into audit_log (staff_id, appointment_id, action, detail) values (${auth.staff.id}, ${id}, ${b.action}, ${tx.json({ from: { status: cur.status, day: String(cur.day), slot: cur.slot }, set })})`;
      return r;
    });
  } catch (e) {
    if (e.code === "RACE") return fail("Programarea și-a schimbat statusul între timp. Reîncarcă lista.", 409);
    if (e.code === "23505") return fail("Ora nouă nu mai e liberă.", 409);
    throw e;
  }
  // Pacientul primește automat email. Dacă nu are email, programarea rămâne „de anunțat telefonic”.
  const sent = mail ? (await notify(mail, row, cur.doctor_name, `${baseUrl(req)}/p/${row.token}`)).sent : false;
  if (sent) await sql`update appointments set notified = true where id = ${id}`;
  return json({ ok: true, emailSent: sent, hasEmail: !!row.email });
}
