// Adaugă sau resetează un cont de personal.
// node scripts/add-user.mjs <email> <parola> <admin|reception|doctor> "<Nume>" [id_medic]
import postgres from "postgres";
import bcrypt from "bcryptjs";
const [email, password, role, name, doctorId] = process.argv.slice(2);
if (!email || !password || !["admin", "reception", "doctor"].includes(role) || !name) {
  console.log('Folosire: node scripts/add-user.mjs email parola admin|reception|doctor "Nume" [id_medic]'); process.exit(1);
}
if (password.length < 10) { console.log("Parola trebuie să aibă minim 10 caractere."); process.exit(1); }
if (role === "doctor" && !doctorId) { console.log("Pentru rolul doctor dă și id-ul medicului (ex. blivanu)."); process.exit(1); }
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false, max: 1 });
const hash = await bcrypt.hash(password, 12);
await sql`insert into staff (email, name, password_hash, role, doctor_id) values (${email.toLowerCase()}, ${name}, ${hash}, ${role}, ${doctorId || null})
  on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = excluded.role, doctor_id = excluded.doctor_id, active = true`;
console.log(`Cont salvat: ${email} (${role}).`);
await sql.end();
