-- Piuarfil: programări online
-- Rulează o singură dată pe baza de date (Supabase: SQL Editor → New query → Run).
-- Toate datele se accesează doar de pe server (rutele /api), nu direct din browser.

create extension if not exists pgcrypto;

create table if not exists doctors (
  id            text primary key,
  name          text not null,
  role          text not null,              -- textul afișat, ex. „Chirurgie pediatrică · Ultrasonografie generală”
  specs         text[] not null,            -- specialitățile pentru care se poate face programare
  photo         text,                       -- ex. /img/tofan.jpg
  slot_minutes  int  not null default 30 check (slot_minutes between 10 and 120),
  active        boolean not null default true,
  sort          int not null default 0
);

-- programul săptămânal: 1=luni … 6=sâmbătă, 0=duminică
create table if not exists schedules (
  doctor_id   text not null references doctors(id) on delete cascade,
  weekday     int  not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  primary key (doctor_id, weekday, start_time)
);

-- zile în care un medic nu consultă (concediu, cursuri)
create table if not exists days_off (
  doctor_id  text not null references doctors(id) on delete cascade,
  day        date not null,
  reason     text,
  primary key (doctor_id, day)
);

-- sărbători legale (clinica închisă)
create table if not exists holidays (
  day   date primary key,
  name  text not null
);

-- conturile personalului: recepție, medici (doar citire, agenda proprie), admin
create table if not exists staff (
  id             uuid primary key default gen_random_uuid(),
  email          text not null unique,
  name           text not null,
  password_hash  text not null,
  role           text not null check (role in ('admin','reception','doctor')),
  doctor_id      text references doctors(id),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create table if not exists appointments (
  id              uuid primary key default gen_random_uuid(),
  ref             text not null unique,                 -- referință internă pentru recepție, ex. PF-4821
  token           text not null unique,                 -- linkul personal al pacientului /p/<token>
  doctor_id       text not null references doctors(id),
  spec            text not null,
  day             date not null,
  slot            time not null,                        -- ora locală (Europe/Bucharest)
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','rejected','cancelled')),
  source          text not null default 'online' check (source in ('online','telefon')),
  patient_name    text not null,
  phone           text not null,
  email           text,
  child_name      text,
  child_age       text,
  reason          text,
  prev_results    text,
  prev_consults   text,
  urgent          boolean not null default false,
  notified        boolean not null default false,       -- recepția a anunțat pacientul (WhatsApp / telefon)
  reminded_at     timestamptz,                          -- reminderul de cu o zi înainte a fost trimis
  cancelled_by    text check (cancelled_by in ('patient','staff','system')),  -- system = cerere neconfirmată la timp
  note            text,                                 -- motiv respingere / observații
  consent_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- O singură programare activă pe medic + zi + oră. Garanția împotriva programărilor duble.
create unique index if not exists one_active_per_slot
  on appointments (doctor_id, day, slot)
  where status in ('pending','confirmed');

create index if not exists appt_day   on appointments (day);
create index if not exists appt_phone on appointments (phone);

-- jurnal: cine a confirmat / mutat / anulat și când
create table if not exists audit_log (
  id              bigserial primary key,
  at              timestamptz not null default now(),
  staff_id        uuid references staff(id),
  appointment_id  uuid references appointments(id) on delete cascade,
  action          text not null,
  detail          jsonb
);

-- Supabase: blochează accesul direct din browser (cheia anon) la toate tabelele.
-- Aplicația folosește conexiunea de server, care nu e afectată.
alter table doctors      enable row level security;
alter table schedules    enable row level security;
alter table days_off     enable row level security;
alter table holidays     enable row level security;
alter table staff        enable row level security;
alter table appointments enable row level security;
alter table audit_log    enable row level security;

-- Pentru baze de date create cu o versiune anterioară a acestui fișier
alter table appointments add column if not exists reminded_at timestamptz;
alter table appointments add column if not exists cancelled_by text;
alter table appointments drop constraint if exists appointments_cancelled_by_check;
alter table appointments add constraint appointments_cancelled_by_check check (cancelled_by in ('patient','staff','system'));
