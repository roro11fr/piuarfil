import { fmtLong } from "./time.js";

// Email opțional, prin Resend. Fără RESEND_API_KEY nu se trimite nimic (recepția anunță telefonic).
const enabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
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
  return `<p><b>${esc(doctorName)}</b> · ${esc(a.spec)}<br>${esc(fmtLong(a.day))}, ora ${String(a.slot).slice(0, 5)}${a.child_name ? `<br>Pentru: ${esc(a.child_name)}` : ""}</p>`;
}

export async function notify(kind, a, doctorName, link) {
  if (!enabled() || !a.email) return { sent: false };
  const T = {
    received: ["Am primit cererea ta", "Recepția o verifică și te confirmă în curând."],
    confirmed: ["Programarea ta e confirmată", "Te așteptăm."],
    moved: ["Programarea ta a fost mutată", "Recepția a stabilit o oră nouă:"],
    rejected: ["Nu am putut confirma cererea", esc(a.note || "Te rugăm să alegi altă oră sau să suni la recepție.")],
    cancelled: ["Programarea a fost anulată", "Ora a devenit liberă pentru alți pacienți."],
  }[kind];
  if (!T) return { sent: false };
  const showLink = ["received", "confirmed", "moved"].includes(kind) ? link : null;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: a.email, subject: T[0] + " · Piuarfil", html: layout(T[0], `<p>${T[1]}</p>` + lines(a, doctorName), showLink) }),
    });
    return { sent: r.ok };
  } catch { return { sent: false }; }
}
