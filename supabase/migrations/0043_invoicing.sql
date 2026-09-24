-- Invoicing
create table if not exists public.invoices (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  client_id           uuid not null references public.clients(id) on delete cascade,
  project_id          uuid references public.projects(id) on delete set null,
  invoice_number      text not null,
  date                date not null,
  due_date            date not null,
  status              text not null default 'DRAFT' check (status in ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')),
  currency            text not null default 'USD',
  subtotal            numeric not null default 0,
  tax_amount          numeric not null default 0,
  total_amount        numeric not null default 0,
  notes               text,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now(),
  unique (organization_id, invoice_number)
);

create index if not exists idx_invoices_org on public.invoices(organization_id);
create index if not exists idx_invoices_client on public.invoices(client_id);

create table if not exists public.invoice_items (
  id                  uuid primary key default uuid_generate_v4(),
  invoice_id          uuid not null references public.invoices(id) on delete cascade,
  description         text not null,
  quantity            numeric not null default 1,
  unit_price          numeric not null default 0,
  amount              numeric not null default 0
);

create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

-- Invoices viewable and editable by Admin/HR
create policy "Invoices access for Admin/HR" on public.invoices for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

create policy "Invoice items access for Admin/HR" on public.invoice_items for all using (
  (select organization_id from public.invoices where id = invoice_id) = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);
