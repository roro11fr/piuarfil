import { clearSession } from "@/lib/auth.js";
import { json } from "@/lib/util.js";
export async function POST() { await clearSession(); return json({ ok: true }); }
