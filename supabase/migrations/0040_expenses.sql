-- Expenses
create table if not exists public.expenses (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  employee_id         uuid not null references public.profiles(id) on delete cascade,
  category            text not null,
  amount              numeric not null,
  currency            text not null default 'INR',
  date                date not null,
  merchant            text,
  description         text,
  receipt_url         text,
  status              text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'REIMBURSED')),
  approved_by         uuid references public.profiles(id) on delete set null,
  approved_at         timestamptz,
  reimbursed_at       timestamptz,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now()
);

create index if not exists idx_expenses_org on public.expenses(organization_id);
create index if not exists idx_expenses_emp on public.expenses(employee_id);

alter table public.expenses enable row level security;

create policy "Expenses viewable by owner or Admin/HR" on public.expenses for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    employee_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
  )
);

create policy "Expenses insertable by owner" on public.expenses for insert with check (
  employee_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);

create policy "Expenses updatable by Admin/HR or owner if pending" on public.expenses for update using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
    or (employee_id = auth.uid() and status = 'PENDING')
  )
);

create policy "Expenses deletable by owner if pending" on public.expenses for delete using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and employee_id = auth.uid()
  and status = 'PENDING'
);
