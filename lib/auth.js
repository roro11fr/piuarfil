import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { sql } from "./db.js";

const COOKIE = "pf_session";
const key = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET lipsește sau e prea scurt (minim 32 de caractere)");
  return new TextEncoder().encode(s);
};

export async function createSession(staff) {
  const jwt = await new SignJWT({ sub: staff.id, role: staff.role })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("12h").sign(key());
  (await cookies()).set(COOKIE, jwt, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 12 * 3600 });
}
export async function clearSession() { (await cookies()).delete(COOKIE); }

/** Returnează contul logat sau null. Verifică și că acel cont e încă activ. */
export async function currentStaff() {
  const c = (await cookies()).get(COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, key());
    const [s] = await sql`select id, email, name, role, doctor_id from staff where id = ${payload.sub} and active`;
    return s || null;
  } catch { return null; }
}

/** Pentru rutele care modifică date: cere sesiune + antetul x-pf (protecție simplă CSRF). */
export async function requireStaff(req, roles = ["admin", "reception", "doctor"]) {
  if (req.method !== "GET" && req.headers.get("x-pf") !== "1") return { error: "Cerere invalidă", status: 400 };
  const s = await currentStaff();
  if (!s) return { error: "Trebuie să te autentifici", status: 401 };
  if (!roles.includes(s.role)) return { error: "Nu ai drept pentru această acțiune", status: 403 };
  return { staff: s };
}
