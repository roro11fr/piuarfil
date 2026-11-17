import { loadByToken } from "@/lib/manage.js";
import { CANCEL_HOURS } from "@/lib/slots.js";
import { json, fail } from "@/lib/util.js";
export const dynamic = "force-dynamic";

// Pagina linkului personal: fără date medicale, doar ce trebuie ca pacientul să-și vadă programarea.
export async function GET(_req, { params }) {
  const a = await loadByToken((await params).token);
  if (!a) return fail("Linkul nu e valid sau programarea a fost ștearsă.", 404);
  const active = a.status === "pending" || a.status === "confirmed";
  return json({
    status: a.status, spec: a.spec, day: a.day, slot: a.slot,
    patient: a.child_name || a.patient_name, doctor: a.doctor_name, photo: a.doctor_photo,
    note: a.status === "rejected" ? a.note : null,
    canCancel: active && Number(a.hours_left) >= CANCEL_HOURS,
    tooLate: active && Number(a.hours_left) < CANCEL_HOURS && Number(a.hours_left) > 0,
    phone: process.env.CLINIC_PHONE || "0752 192 733",
  });
}
