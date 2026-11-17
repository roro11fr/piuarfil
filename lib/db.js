import postgres from "postgres";

// Conexiune de server. Pe Supabase folosește „Transaction pooler” (portul 6543) pentru Vercel.
const g = globalThis;
export const sql =
  g.__pfSql ??
  (g.__pfSql = postgres(process.env.DATABASE_URL, {
    max: process.env.NODE_ENV === "production" ? 3 : 5,
    prepare: false, // necesar pentru pooler-ul Supabase
    idle_timeout: 20,
    // zilele (tip date) rămân șiruri „YYYY-MM-DD”, fără conversii de fus orar
    types: { date: { to: 1082, from: [1082], serialize: (x) => x, parse: (x) => x } },
    ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
  }));
