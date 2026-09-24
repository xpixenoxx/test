-- Documents
create table if not exists public.documents (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,
  category            text not null default 'Other',
  file_url            text not null,
  file_type           text,
  size_bytes          integer,
  owner_id            uuid references public.profiles(id) on delete cascade,
  uploaded_by         uuid not null references public.profiles(id) on delete cascade,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now()
);

create index if not exists idx_documents_org on public.documents(organization_id);
create index if not exists idx_documents_owner on public.documents(owner_id);

alter table public.documents enable row level security;

-- Admin/HR can see all documents
create policy "Documents viewable by Admin/HR" on public.documents for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Admin/HR can insert, update, delete any document
create policy "Documents editable by Admin/HR" on public.documents for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Employees can see company documents (owner_id is null) or their own documents
create policy "Documents viewable by employee" on public.documents for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (owner_id is null or owner_id = auth.uid())
);

-- Employees can upload their own documents
create policy "Documents insertable by employee" on public.documents for insert with check (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and owner_id = auth.uid()
  and uploaded_by = auth.uid()
);

-- Employees can delete their own documents
create policy "Documents deletable by employee" on public.documents for delete using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and owner_id = auth.uid()
);
