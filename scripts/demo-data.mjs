// DOAR PENTRU DEMONSTRAȚIE: adaugă ~40 de programări fictive. Nu rula pe baza de date reală a clinicii.
// node scripts/demo-data.mjs      ·  ștergere: node scripts/demo-data.mjs --sterge
import postgres from "postgres";
import crypto from "node:crypto";
const sql = postgres(process.env.DATABASE_URL, { ssl: process.env.DATABASE_SSL === "disable" ? false : "require", prepare: false, max: 1 });
if (process.argv.includes("--sterge")) { const r = await sql`delete from appointments where note = 'demo' or reason like '[demo]%' returning id`; console.log(`Șterse ${r.length} programări demo.`); await sql.end(); process.exit(0); }
let x = 11; const rnd = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646, pick = (a) => a[Math.floor(rnd() * a.length)];
const FN = ["Maria","Ioana","Elena","Andreea","Gabriela","Mihaela","Cristina","Alina","Ion","Vasile","Gheorghe","Constantin","Mihai","Andrei","Florin","Bogdan","Daniel","Petru"];
const LN = ["Popescu","Ursache","Hrițcu","Moroșan","Cojocaru","Bodnar","Rusu","Ciobanu","Lungu","Grigoraș","Prelipcean","Onu","Bîrsan","Pintilie","Ilisei","Nistor"];
const R = { "Medicină de familie": ["Control anual și rețetă compensată.","Tuse de o săptămână.","Tensiune crescută dimineața."], "Pediatrie": ["Control la 1 an.","Tuse noaptea.","Erupție pe piele."], "Chirurgie pediatrică": ["Hernie ombilicală.","Control după operație."], "Ecografie generală": ["Ecografie abdominală.","Ecografie de tiroidă."], "Obstetrică-ginecologie": ["Control de rutină.","Monitorizare sarcină."], "Cardiologie": ["Palpitații ocazionale.","EKG și control."], "Stomatologie": ["Durere la o măsea.","Detartraj.","Plombă căzută."] };
const docs = await sql`select d.id, d.specs, d.slot_minutes, array_agg(s.weekday) as days, min(s.start_time)::text as st from doctors d join schedules s on s.doctor_id = d.id group by d.id`;
const hol = new Set((await sql`select day from holidays`).map((r) => String(r.day)));
const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest" }).format(new Date()) + "T00:00:00Z");
let n = 0;
for (let off = -10; off <= 14; off++) {
  const d0 = new Date(today); d0.setUTCDate(d0.getUTCDate() + off); const day = d0.toISOString().slice(0, 10), wd = d0.getUTCDay();
  if (wd === 0 || hol.has(day)) continue;
  for (const doc of docs.filter((d) => d.days.includes(wd))) {
    const k = Math.floor(rnd() * 3);
    for (let i = 0; i < k; i++) {
      const m = 9 * 60 + Math.floor(rnd() * 8) * doc.slot_minutes; if (m + doc.slot_minutes > (wd === 6 ? 12 : 16) * 60) continue;
      const slot = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const spec = pick(doc.specs), r = rnd(), child = spec.includes("ediatr");
      const status = off < 0 ? (r < .88 ? "confirmed" : "cancelled") : off <= 1 ? "confirmed" : r < .2 ? "pending" : r < .9 ? "confirmed" : "cancelled";
      const name = pick(FN) + " " + pick(LN);
      // online: email obligatoriu; la telefon, unii pacienți nu au email
      const source = rnd() < .25 ? "telefon" : "online", email = source === "online" || rnd() < .4 ? "pacient" + n + "@exemplu.ro" : null;
      try {
        await sql`insert into appointments ${sql({ ref: "PF-" + crypto.randomInt(1000, 99999), token: crypto.randomBytes(18).toString("base64url"), doctor_id: doc.id, spec, day, slot, status,
          source, patient_name: name, phone: "07" + crypto.randomInt(10000000, 99999999), email,
          child_name: child ? pick(["Matei","Ana","Luca","Sofia","David"]) + " " + name.split(" ")[1] : null, child_age: child ? Math.floor(1 + rnd() * 12) + " ani" : null,
          reason: "[demo] " + pick(R[spec]), prev_results: rnd() < .3 ? "Analize de sânge de luna trecută." : null, prev_consults: rnd() < .2 ? "Trimis de medicul de familie." : null,
          cancelled_by: status === "cancelled" ? "patient" : null, urgent: status === "pending" && rnd() < .12, notified: status !== "pending" && (!!email || source === "telefon" || off < 0) && !(status === "confirmed" && !email && off >= 0 && rnd() < .15),
          reminded_at: status === "confirmed" && off < 0 ? new Date() : null, note: "demo" })}`;
        n++;
      } catch (e) { if (e.code !== "23505") throw e; }
    }
  }
}
console.log(`Adăugate ${n} programări demo.`); await sql.end();
