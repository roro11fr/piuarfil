import bcrypt from "bcryptjs";
import { sql } from "@/lib/db.js";
import { createSession } from "@/lib/auth.js";
import { json, fail } from "@/lib/util.js";
export const dynamic = "force-dynamic";

const attempts = new Map(); // limită simplă pe instanță: 8 încercări / 15 minute / email
export async function POST(req) {
  const { email = "", password = "" } = await req.json().catch(() => ({}));
  const key = String(email).toLowerCase().trim();
  const now = Date.now(), list = (attempts.get(key) || []).filter((t) => now - t < 15 * 60e3);
  if (list.length >= 8) return fail("Prea multe încercări. Încearcă din nou peste 15 minute.", 429);
  const [s] = await sql`select id, email, name, role, doctor_id, password_hash from staff where lower(email) = ${key} and active`;
  const ok = s && (await bcrypt.compare(String(password), s.password_hash));
  if (!ok) { attempts.set(key, [...list, now]); return fail("Email sau parolă greșită.", 401); }
  attempts.delete(key);
  await createSession(s);
  return json({ name: s.name, role: s.role, doctor_id: s.doctor_id });
}
