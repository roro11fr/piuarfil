import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const json = (data, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const fail = (message, status = 400, extra = {}) => json({ error: message, ...extra }, status);
export const newToken = () => crypto.randomBytes(18).toString("base64url");
export const newRef = () => "PF-" + crypto.randomInt(1000, 99999);
export const digits = (s) => String(s || "").replace(/\D/g, "");
export function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const u = new URL(req.url);
  return u.origin;
}
/** Inserează cu ref unic; reîncearcă la coliziune de ref. Aruncă SLOT_TAKEN dacă ora e luată. */
export async function insertAppointment(tx, row) {
  for (let i = 0; i < 5; i++) {
    try {
      const [r] = await tx`insert into appointments ${tx({ ...row, ref: newRef(), token: newToken() })} returning *`;
      return r;
    } catch (e) {
      if (e.code === "23505" && String(e.constraint_name || e.message).includes("one_active_per_slot")) {
        const err = new Error("SLOT_TAKEN"); err.code = "SLOT_TAKEN"; throw err;
      }
      if (e.code === "23505") continue; // ref sau token duplicat, reîncearcă
      throw e;
    }
  }
  throw new Error("Nu am putut genera o referință unică");
}
