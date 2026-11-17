// Creează tabelele și datele inițiale: DATABASE_URL=... node scripts/setup-db.mjs
import postgres from "postgres";
import { readFileSync } from "node:fs";
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false, max: 1, onnotice: () => {} });
await sql.unsafe(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await sql.unsafe(readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8"));
const [{ n }] = await sql`select count(*)::int as n from doctors`;
console.log(`Gata: tabele create, ${n} medici.`);
await sql.end();
