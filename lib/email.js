import { fmtLong } from "./time.js";

// Emailurile către pacienți pleacă automat, prin Resend. Recepția nu trimite nimic de mână,
// cu excepția pacienților fără email (programați la telefon), pe care îi sună.
export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
const PHONE = () => process.env.CLINIC_PHONE || "0752 192 733";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function layout(title, body, link) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#11304D">
  <p style="letter-spacing:.3em;color:#A99383;font-weight:bold">PIUARFIL</p>
  <h2 style="margin:.2em 0 1em">${title}</h2>${body}
  ${link ? `<p style="margin:1.6em 0"><a href="${link}" style="background:#2A6496;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Vezi sau anulează programarea</a></p>
  <p style="font-size:13px;color:#55687B">Anularea online e posibilă cu cel puțin 48 de ore înainte. Mai târziu, sună la recepție: ${PHONE()}.</p>` : ""}
  <p style="font-size:13px;color:#55687B">Piuarfil Clinică Medicală, Dumbrăveni · ${PHONE()}</p></div>`;
}
function lines(a, doctorName) {
  return `<p><b>${esc(doctorName)}</b> · ${esc(a.spec)}<br>${esc(fmtLong(String(a.day).slice(0, 10)))}, ora ${String(a.slot).slice(0, 5)}${a.child_name ? `<br>Pentru: ${esc(a.child_name)}` : ""}</p>`;
}

const TEMPLATES = (a) => ({
  received: ["Am primit cererea ta", "Recepția o verifică și îți trimitem confirmarea tot pe email."],
  confirmed: ["Programarea ta e confirmată", "Te așteptăm."],
  moved: ["Programarea ta a fost mutată", "Recepția a stabilit o oră nouă:"],
  rejected: ["Nu am putut confirma cererea", esc(a.note || "Te rugăm să alegi altă oră pe site sau să suni la recepție.")],
  cancelled: ["Programarea a fost anulată", a.cancelled_by === "patient" ? "Ai anulat programarea. Ora a devenit liberă." : esc(a.note && !/recep/i.test(a.note) ? a.note : "Recepția a anulat programarea. Pentru o oră nouă, programează-te pe site sau sună-ne.")],
  expired: ["Cererea ta nu a putut fi confirmată", "Ne cerem scuze, nu am reușit să confirmăm la timp cererea ta. Te rugăm să alegi altă oră pe site sau să ne suni."],
  reminder: ["Mâine ai programare", "Îți reamintim de programarea de mâine. Dacă nu mai poți ajunge, te rugăm să ne anunți la telefon."],
});
const WITH_LINK = ["received", "confirmed", "moved", "reminder"];

/** Trimite emailul potrivit. Întoarce { sent } — false dacă pacientul nu are email sau emailul e oprit. */
export async function notify(kind, a, doctorName, link) {
  if (!emailEnabled() || !a.email) return { sent: false };
  const T = TEMPLATES(a)[kind];
  if (!T) return { sent: false };
  try {
    const r = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM, to: a.email, subject: T[0] + " · Piuarfil",
        html: layout(T[0], `<p>${T[1]}</p>` + lines(a, doctorName), WITH_LINK.includes(kind) ? link : null),
      }),
    });
    return { sent: r.ok };
  } catch { return { sent: false }; }
}
