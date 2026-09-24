-- Assets
create table if not exists public.assets (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  category            text not null default 'Other',
  serial_number       text,
  status              text not null default 'AVAILABLE' check (status in ('AVAILABLE', 'ALLOCATED', 'MAINTENANCE', 'RETIRED')),
  assigned_to         uuid references public.profiles(id) on delete set null,
  assigned_at         timestamptz,
  condition           text,
  purchase_date       date,
  purchase_cost       numeric,
  notes               text,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now()
);

create index if not exists idx_assets_org on public.assets(organization_id);
create index if not exists idx_assets_emp on public.assets(assigned_to);

alter table public.assets enable row level security;

-- Admins/HR can do everything
create policy "Assets full access for Admin/HR" on public.assets for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Employees can view assets assigned to them
create policy "Assets viewable by assignee" on public.assets for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and assigned_to = auth.uid()
);
