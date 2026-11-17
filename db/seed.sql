-- Date inițiale: medicii de pe @piuarfil, program PROVIZORIU, sărbători legale.
-- Programul se înlocuiește cu cel real primit de la clinică.

insert into doctors (id, name, role, specs, photo, slot_minutes, sort) values
 ('blivanu','Dr. Beatrice Livanu','Medicină de familie','{"Medicină de familie"}','/img/blivanu.jpg',20,1),
 ('cirdei','Dr. Ligia Cîrdei','Pediatrie','{"Pediatrie"}','/img/cirdei.jpg',30,2),
 ('constantineanu','Dr. Adriana Constantineanu','Chirurgie pediatrică · Ultrasonografie generală','{"Chirurgie pediatrică","Ecografie generală"}','/img/constantineanu.jpg',30,3),
 ('tofan','Dr. Anamaria Tofan','Obstetrică-ginecologie','{"Obstetrică-ginecologie"}','/img/tofan.jpg',30,4),
 ('ananii','Dr. Sabina Ananii','Cardiologie','{"Cardiologie"}','/img/ananii.jpg',30,5),
 ('apiu','Dr. Anca Piu','Stomatologie','{"Stomatologie"}','/img/apiu.jpg',45,6),
 ('cpiu','Dr. Cosmin Piu','Stomatologie','{"Stomatologie"}','/img/cpiu.jpg',45,7),
 ('clivanu','Dr. Cătălin Livanu','Stomatologie','{"Stomatologie"}','/img/clivanu.jpg',45,8),
 ('tomascu','Dr. Floarea Tomascu','Stomatologie','{"Stomatologie"}','/img/tomascu.jpg',45,9)
on conflict (id) do nothing;

insert into schedules (doctor_id, weekday, start_time, end_time)
select d, w, '09:00', case when w = 6 then '12:00'::time else '16:00'::time end
from (values
  ('blivanu', array[1,2,3,4,5]),
  ('cirdei', array[1,3,5]),
  ('constantineanu', array[2,4]),
  ('tofan', array[1,3,6]),
  ('ananii', array[2,5]),
  ('apiu', array[1,2,3,4,5]),
  ('cpiu', array[1,2,4,5,6]),
  ('clivanu', array[1,3,5]),
  ('tomascu', array[2,4,6])
) as s(d, ws), unnest(ws) as w
on conflict do nothing;

insert into holidays (day, name) values
 ('2026-11-30','Sf. Andrei'),('2026-12-01','Ziua Națională'),
 ('2026-12-25','Crăciunul'),('2026-12-26','Crăciunul'),
 ('2027-01-01','Anul Nou'),('2027-01-02','Anul Nou'),
 ('2027-01-06','Boboteaza'),('2027-01-07','Sf. Ioan'),
 ('2027-01-24','Unirea Principatelor'),
 ('2027-04-30','Vinerea Mare'),('2027-05-01','Ziua Muncii'),
 ('2027-05-02','Paștele'),('2027-05-03','Paștele'),
 ('2027-06-01','Ziua Copilului'),('2027-06-20','Rusaliile'),('2027-06-21','Rusaliile'),
 ('2027-08-15','Adormirea Maicii Domnului'),('2027-11-30','Sf. Andrei'),('2027-12-01','Ziua Națională'),
 ('2027-12-25','Crăciunul'),('2027-12-26','Crăciunul')
on conflict (day) do nothing;
