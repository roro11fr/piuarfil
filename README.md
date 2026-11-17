# Piuarfil · programări online

Site-ul clinicii Piuarfil (Dumbrăveni) cu programări online și panou pentru recepție și medici.

- **Site public** (`/`): prezentarea clinicii, echipa, specialitățile, programarea în 4 pași.
- **Linkul personal al pacientului** (`/p/<cod>`): vede programarea și o poate anula cu minimum 48h înainte.
- **Panou** (`/receptie`): recepția confirmă, respinge, mută și anulează cereri, adaugă programări primite la telefon, marchează zile libere și ține evidența pacienților anunțați. Medicii văd doar agenda proprie, fără să poată modifica.

## Cum funcționează
- Pacientul trimite cererea, iar ora se blochează imediat (status „în așteptare”).
- Recepția o vede în panou, o confirmă și apasă **WhatsApp**: se deschide WhatsApp (Web sau aplicația) cu mesajul gata scris și linkul personal al pacientului; recepția apasă Trimite. Dacă pacientul a lăsat email și emailul e configurat, primește automat și confirmarea pe email.
- Tab-ul **Reminder mâine** listează pacienții de a doua zi, cu buton de reminder pe WhatsApp pentru fiecare.
- Când un pacient își anulează programarea din link, recepția vede imediat un avertisment în panou („Anulări noi”), ca să poată da ora altcuiva.
- Mesajele de WhatsApp nu conțin date medicale: doar medicul, ziua, ora și linkul.
- O oră nu poate fi rezervată de două ori: baza de date garantează asta (index unic pe medic + zi + oră).
- Regula de 48h la anulare e verificată pe server.
- Sărbătorile legale și zilele libere ale medicilor închid automat ziua.

## Tehnologie
Next.js (doar rutele `/api`), pagini statice în `public/`, PostgreSQL (Supabase), sesiuni semnate pentru personal. Fără SMS și fără Google Calendar. WhatsApp prin linkuri `wa.me`: fără cont de API, fără costuri; clinica are nevoie de WhatsApp (ideal WhatsApp Business) pe telefonul recepției, conectat la WhatsApp Web pe calculatorul ei.

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
3. La **Environment Variables** adaugă variabilele din `.env.example` (`DATABASE_URL`, `SESSION_SECRET`, `PUBLIC_URL`, `CLINIC_PHONE`, opțional `RESEND_API_KEY` și `EMAIL_FROM`). Apasă **Deploy**.
4. **Settings → Domains**: adaugă domeniul clinicii, apoi actualizează `PUBLIC_URL` și redeployează.

### 4. WhatsApp la recepție
Instalează WhatsApp Business pe telefonul recepției și conectează-l la WhatsApp Web (web.whatsapp.com) pe calculatorul din care se lucrează în panou.

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
