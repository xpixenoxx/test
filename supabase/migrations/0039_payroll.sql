-- ============================================================
-- Payroll Schema — Pixenox HRM
-- 0039_payroll.sql
-- ============================================================

-- 1. Salary Structures (templates)
create table if not exists public.salary_structures (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  name                text not null,                          -- e.g. "Standard Dev Package"
  basic_percent       numeric not null default 50,           -- % of CTC
  hra_percent         numeric not null default 20,           -- % of basic
  da_percent          numeric not null default 10,           -- % of basic
  special_allowance_percent numeric default 0,
  pf_employee_percent numeric not null default 12,           -- % of basic (employee side)
  pf_employer_percent numeric not null default 12,           -- % of basic (employer side)
  esi_employee_percent numeric default 0.75,
  esi_employer_percent numeric default 3.25,
  professional_tax    numeric default 200,                    -- fixed monthly
  is_default          boolean default false,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now()
);
create index if not exists idx_salary_structures_org on public.salary_structures(organization_id);

-- 2. Employee CTC (annual cost-to-company)
create table if not exists public.employee_salary (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  employee_id         uuid not null references public.profiles(id) on delete cascade,
  salary_structure_id uuid references public.salary_structures(id) on delete set null,
  ctc_annual          numeric not null,                      -- annual CTC in INR
  effective_from      date not null,
  bank_name           text,
  account_number      text,
  ifsc_code           text,
  pan_number          text,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now(),
  unique (employee_id, effective_from)
);
create index if not exists idx_employee_salary_org on public.employee_salary(organization_id);
create index if not exists idx_employee_salary_emp on public.employee_salary(employee_id);

-- 3. Payroll Runs (monthly payroll processing)
create table if not exists public.payroll_runs (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  month               integer not null check (month between 1 and 12),
  year                integer not null,
  status              text default 'DRAFT' check (status in ('DRAFT', 'PROCESSING', 'APPROVED', 'PAID')),
  processed_by        uuid references public.profiles(id) on delete set null,
  processed_at        timestamptz,
  approved_by         uuid references public.profiles(id) on delete set null,
  approved_at         timestamptz,
  total_gross         numeric default 0,
  total_deductions    numeric default 0,
  total_net           numeric default 0,
  notes               text,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now(),
  unique (organization_id, month, year)
);
create index if not exists idx_payroll_runs_org on public.payroll_runs(organization_id);

-- 4. Payslips (per employee per payroll run)
create table if not exists public.payslips (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  payroll_run_id      uuid not null references public.payroll_runs(id) on delete cascade,
  employee_id         uuid not null references public.profiles(id) on delete cascade,
  employee_name       text,
  month               integer not null,
  year                integer not null,

  -- Earnings
  basic               numeric not null default 0,
  hra                 numeric not null default 0,
  da                  numeric not null default 0,
  special_allowance   numeric not null default 0,
  overtime            numeric default 0,
  bonus               numeric default 0,
  gross_earnings      numeric not null default 0,

  -- Deductions
  pf_employee         numeric default 0,
  esi_employee        numeric default 0,
  professional_tax    numeric default 0,
  tds                 numeric default 0,
  other_deductions    numeric default 0,
  loan_deduction      numeric default 0,
  total_deductions    numeric default 0,

  -- Net
  net_salary          numeric not null default 0,

  -- Attendance-based adjustments
  working_days        integer default 0,
  days_present        integer default 0,
  days_absent         integer default 0,
  days_leave          integer default 0,
  lop_days            numeric default 0,                     -- Loss Of Pay days
  lop_deduction       numeric default 0,

  -- Meta
  status              text default 'GENERATED' check (status in ('GENERATED', 'APPROVED', 'PAID', 'HELD')),
  remarks             text,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now(),
  unique (payroll_run_id, employee_id)
);
create index if not exists idx_payslips_org on public.payslips(organization_id);
create index if not exists idx_payslips_run on public.payslips(payroll_run_id);
create index if not exists idx_payslips_emp on public.payslips(employee_id);

-- 5. Advance / Loan Requests
create table if not exists public.salary_advances (
  id                  uuid primary key default uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  employee_id         uuid not null references public.profiles(id) on delete cascade,
  amount              numeric not null,
  reason              text,
  monthly_installment numeric,
  remaining_amount    numeric,
  status              text default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CLEARED')),
  approved_by         uuid references public.profiles(id) on delete set null,
  applied_date        date not null default current_date,
  created             timestamptz not null default now(),
  updated             timestamptz not null default now()
);
create index if not exists idx_salary_advances_org on public.salary_advances(organization_id);
create index if not exists idx_salary_advances_emp on public.salary_advances(employee_id);

-- ============================================================
-- RLS POLICIES
-- ============================================================

alter table public.salary_structures enable row level security;
alter table public.employee_salary enable row level security;
alter table public.payroll_runs enable row level security;
alter table public.payslips enable row level security;
alter table public.salary_advances enable row level security;

-- Salary Structures: Admin/HR only
create policy "Salary structures viewable by Admin/HR" on public.salary_structures for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);
create policy "Salary structures editable by Admin/HR" on public.salary_structures for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Employee Salary: Admin/HR or own record (read only)
create policy "Employee salary viewable by owner or Admin" on public.employee_salary for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    employee_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
  )
);
create policy "Employee salary editable by Admin/HR" on public.employee_salary for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Payroll Runs: Admin/HR only
create policy "Payroll runs viewable by Admin/HR" on public.payroll_runs for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);
create policy "Payroll runs editable by Admin/HR" on public.payroll_runs for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Payslips: Admin/HR or own record
create policy "Payslips viewable by owner or Admin" on public.payslips for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    employee_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
  )
);
create policy "Payslips editable by Admin/HR" on public.payslips for all using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);

-- Advances: Admin/HR or own record
create policy "Advances viewable by owner or Admin" on public.salary_advances for select using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (
    employee_id = auth.uid()
    or (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
  )
);
create policy "Advances insertable by any employee" on public.salary_advances for insert with check (
  employee_id = auth.uid()
  and organization_id = (select organization_id from public.profiles where id = auth.uid())
);
create policy "Advances editable by Admin/HR" on public.salary_advances for update using (
  organization_id = (select organization_id from public.profiles where id = auth.uid())
  and (select role from public.profiles where id = auth.uid()) in ('SUPER_ADMIN','ADMIN','HR')
);
