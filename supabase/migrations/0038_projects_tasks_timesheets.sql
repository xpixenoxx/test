-- ============================================================
-- Projects, Tasks, and Timesheets Schema
-- ============================================================

-- 1. Clients
create table public.clients (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  contact_person  text,
  email           text,
  phone           text,
  address         text,
  status          text default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  created         timestamptz not null default now(),
  updated         timestamptz not null default now()
);
create index idx_clients_org on public.clients(organization_id);

-- 2. Projects
create table public.projects (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  description     text,
  client_id       uuid references public.clients(id) on delete set null,
  start_date      date,
  end_date        date,
  status          text default 'PLANNING' check (status in ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED')),
  manager_id      uuid references public.profiles(id) on delete set null,
  budget          numeric,
  created         timestamptz not null default now(),
  updated         timestamptz not null default now()
);
create index idx_projects_org on public.projects(organization_id);

-- 3. Project Members
create table public.project_members (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  employee_id     uuid not null references public.profiles(id) on delete cascade,
  role            text default 'MEMBER',
  created         timestamptz not null default now()
);
create index idx_project_members_org on public.project_members(organization_id);
create index idx_project_members_proj on public.project_members(project_id);
create unique index idx_project_members_unique on public.project_members(project_id, employee_id);

-- 4. Tasks
create table public.tasks (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  assigned_to     uuid references public.profiles(id) on delete set null,
  status          text default 'TODO' check (status in ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
  priority        text default 'MEDIUM' check (priority in ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  due_date        timestamptz,
  created         timestamptz not null default now(),
  updated         timestamptz not null default now()
);
create index idx_tasks_org on public.tasks(organization_id);
create index idx_tasks_proj on public.tasks(project_id);
create index idx_tasks_assigned on public.tasks(assigned_to);

-- 5. Timesheets
create table public.timesheets (
  id              uuid primary key default uuid_generate_v4(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id     uuid not null references public.profiles(id) on delete cascade,
  project_id      uuid not null references public.projects(id) on delete cascade,
  task_id         uuid references public.tasks(id) on delete set null,
  date            date not null,
  hours           numeric not null,
  description     text,
  status          text default 'DRAFT' check (status in ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  created         timestamptz not null default now(),
  updated         timestamptz not null default now()
);
create index idx_timesheets_org on public.timesheets(organization_id);
create index idx_timesheets_emp on public.timesheets(employee_id);
create index idx_timesheets_proj on public.timesheets(project_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Enable RLS
alter table public.clients enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.tasks enable row level security;
alter table public.timesheets enable row level security;

-- Clients: SuperAdmins/Admins/HR can do all. Others can read in their org.
create policy "Clients are viewable by org members" on public.clients for select using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
create policy "Clients are editable by Admins/HR" on public.clients for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'HR')
);

-- Projects: All members can view projects in their org. Admins/Managers can edit.
create policy "Projects are viewable by org members" on public.projects for select using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
create policy "Projects are editable by Admins/Managers" on public.projects for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and ((select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'MANAGER') or manager_id = auth.uid())
);

-- Project Members: All members can view. Admins/Managers can edit.
create policy "Project members are viewable by org members" on public.project_members for select using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
create policy "Project members are editable by Admins/Managers" on public.project_members for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and ((select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'MANAGER'))
);

-- Tasks: Viewable by org members. Editable by Admins/Managers or assigned user.
create policy "Tasks are viewable by org members" on public.tasks for select using (organization_id = (select organization_id from public.profiles where id = auth.uid()));
create policy "Tasks are insertable by org members" on public.tasks for insert with check (organization_id = (select organization_id from public.profiles where id = auth.uid()));
create policy "Tasks are editable by Admins/Managers or assigned" on public.tasks for update using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (
    (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
    or assigned_to = auth.uid()
  )
);
create policy "Tasks are deletable by Admins/Managers" on public.tasks for delete using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'MANAGER')
);

-- Timesheets: Viewable by Admins/Managers or the owner. Insert/Update by owner. Delete by owner or Admin.
create policy "Timesheets viewable by owner or admin" on public.timesheets for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (
    employee_id = auth.uid() 
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER')
  )
);
create policy "Timesheets insertable by owner" on public.timesheets for insert with check (
  employee_id = auth.uid() and organization_id = (select organization_id from public.profiles where id = auth.uid())
);
create policy "Timesheets editable by owner or admin" on public.timesheets for update using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (
    employee_id = auth.uid() 
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER')
  )
);
create policy "Timesheets deletable by owner or admin" on public.timesheets for delete using (
  organization_id = (select organization_id from public.profiles where id = auth.uid()) 
  and (
    employee_id = auth.uid() 
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN', 'ADMIN', 'HR', 'MANAGER')
  )
);
