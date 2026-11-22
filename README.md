# Piuarfil · programări online

Site-ul clinicii Piuarfil (Dumbrăveni) cu programări online și panou pentru recepție și medici.

- **Site public** (`/`): prezentarea clinicii, echipa, specialitățile, programarea în 4 pași.
- **Linkul personal al pacientului** (`/p/<cod>`): vede programarea și o poate anula cu minimum 48h înainte.
- **Panou** (`/receptie`): calendar pe zi (o coloană pe medic) și pe săptămână. Recepția confirmă, respinge, mută și anulează cereri, adaugă programări primite la telefon (click pe o oră liberă) și marchează zile libere. Medicii își văd calendarul propriu, fără să poată modifica.

## Cum funcționează
- Pacientul trimite cererea, iar ora se blochează imediat (status „în așteptare”).
- Emailul e obligatoriu la programarea online. Pacientul primește **automat** email la fiecare pas: cerere primită, confirmată, mutată, respinsă, anulată, expirată. Recepția nu trimite nimic de mână.
- **Reminderul** pleacă automat pe email în fiecare seară (job Vercel la 16:00 UTC: 18:00 iarna, 19:00 vara) către pacienții de a doua zi.
- Excepția: pacienții fără email (programați la telefon). Panoul îi adună în caseta „De anunțat telefonic”, cu butoane Sună și WhatsApp (mesaj gata scris, fără date medicale).
- Când un pacient își anulează programarea din link, recepția vede imediat un avertisment în panou („Anulări noi”), ca să poată da ora altcuiva.
- Cererile neconfirmate: după 24h apar în panou cu „Așteaptă de …”; cele pentru mâine apar cu „Expiră la miezul nopții”. Dacă recepția nu le confirmă până în ziua programării, se anulează automat, ora se eliberează și pacientul primește email.
- O oră nu poate fi rezervată de două ori: baza de date garantează asta (index unic pe medic + zi + oră).
- Regula de 48h la anulare e verificată pe server.
- Sărbătorile legale și zilele libere ale medicilor închid automat ziua.

## Tehnologie
Next.js (doar rutele `/api`), pagini statice în `public/`, PostgreSQL (Supabase), sesiuni semnate pentru personal, emailuri prin Resend (gratuit până la 3.000/lună), job zilnic prin Vercel Cron. Fără SMS și fără Google Calendar: calendarul e în panou. WhatsApp doar pentru excepții, prin linkuri `wa.me`, fără costuri.

## Lansare (o singură dată)

### 1. Supabase
1. Creează un proiect pe supabase.com, **regiunea Frankfurt (eu-central-1)**. Notează parola bazei de date.
2. **SQL Editor → New query**: lipește `db/schema.sql`, apasă Run. Apoi la fel cu `db/seed.sql`.
3. **Project Settings → Database → Connection string**: copiază varianta **Transaction pooler** (portul 6543) și pune parola în ea. Acesta e `DATABASE_URL`.

### 2. Conturile personalului
De pe calculatorul tău, în folderul proiectului (`npm install` o dată):
```
DATABASE_URL="..." node scripts/add-user.mjs receptie@piuarfil.ro "ParolaLunga123" reception "Recepție"
DATABASE_URL="..." node scripts/add-user.mjs blivanu@piuarfil.ro "AltaParola456" doctor "Dr. Beatrice Livanu" blivanu
```
Roluri: `admin`, `reception`, `doctor` (pentru doctor dai și id-ul medicului: blivanu, cirdei, constantineanu, tofan, ananii, apiu, cpiu, clivanu, tomascu). Aceeași comandă resetează parola unui cont existent.

### 3. GitHub + Vercel
1. Urcă proiectul într-un repo GitHub (fără `node_modules`, `.next`, `.env.local`).
2. Pe vercel.com: **Add New → Project → Import** repo-ul. Framework: Next.js (detectat automat).
3. La **Environment Variables** adaugă variabilele din `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_URL`, `CLINIC_PHONE`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`). Apasă **Deploy**. Jobul de seară din `vercel.json` pornește singur.
4. **Settings → Domains**: adaugă domeniul clinicii, apoi actualizează `PUBLIC_URL` și redeployează.

### 4. Email (Resend)
Cont pe resend.com → **Domains → Add domain** (ex. piuarfil.ro) → adaugă recordurile DNS la furnizorul domeniului → **API Keys → Create**. Cheia e `RESEND_API_KEY`; `EMAIL_FROM` folosește domeniul verificat.

### 5. Pune linkul în bio-ul de Instagram @piuarfil.

## De înlocuit cu datele reale ale clinicii
- **Programul medicilor**: tabelul `schedules` (zi, oră început, oră sfârșit) și durata consultației în `doctors.slot_minutes`. În `seed.sql` e un program PROVIZORIU.
- Lista completă de specialități (`doctors.specs`), adresa, motto-ul, pozele originale (în `public/img`).
- Politica de confidențialitate (draft în `public/common.js`), validată cu un jurist. Perioada de păstrare a datelor.

## Rulare locală
```
cp .env.example .env.local   # completează DATABASE_URL și SESSION_SECRET
npm install
npm run db:setup             # creează tabelele (DATABASE_SSL=disable pentru Postgres local)
npm run dev
```
`scripts/demo-data.mjs` adaugă programări fictive pentru prezentări (`--sterge` le scoate). **Nu-l rula pe baza de date reală.**
