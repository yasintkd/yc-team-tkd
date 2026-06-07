alter table public.belt_exams
  add column if not exists fee_amount numeric(10, 2) not null default 0;

alter table public.belt_exam_participants
  add column if not exists fee_paid boolean not null default false;
