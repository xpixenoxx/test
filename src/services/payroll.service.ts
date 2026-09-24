import { supabase } from './supabase';
import { SalaryStructure, EmployeeSalary, PayrollRun, Payslip, SalaryAdvance } from '../types';
import { resolveOrgId } from './api.client';

// ── Mappers ───────────────────────────────────────────────────────────────────

const mapStructure = (r: any): SalaryStructure => ({
  id: r.id,
  name: r.name,
  basicPercent: r.basic_percent,
  hraPercent: r.hra_percent,
  daPercent: r.da_percent,
  specialAllowancePercent: r.special_allowance_percent,
  pfEmployeePercent: r.pf_employee_percent,
  pfEmployerPercent: r.pf_employer_percent,
  esiEmployeePercent: r.esi_employee_percent,
  esiEmployerPercent: r.esi_employer_percent,
  professionalTax: r.professional_tax,
  isDefault: r.is_default,
  organizationId: r.organization_id,
});

const mapEmpSalary = (r: any): EmployeeSalary => ({
  id: r.id,
  employeeId: r.employee_id,
  salaryStructureId: r.salary_structure_id,
  ctcAnnual: r.ctc_annual,
  effectiveFrom: r.effective_from,
  bankName: r.bank_name,
  accountNumber: r.account_number,
  ifscCode: r.ifsc_code,
  panNumber: r.pan_number,
  organizationId: r.organization_id,
});

const mapRun = (r: any): PayrollRun => ({
  id: r.id,
  month: r.month,
  year: r.year,
  status: r.status,
  processedBy: r.processed_by,
  processedAt: r.processed_at,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  totalGross: r.total_gross,
  totalDeductions: r.total_deductions,
  totalNet: r.total_net,
  notes: r.notes,
  organizationId: r.organization_id,
});

const mapPayslip = (r: any): Payslip => ({
  id: r.id,
  payrollRunId: r.payroll_run_id,
  employeeId: r.employee_id,
  employeeName: r.employee_name,
  month: r.month,
  year: r.year,
  basic: r.basic,
  hra: r.hra,
  da: r.da,
  specialAllowance: r.special_allowance,
  overtime: r.overtime,
  bonus: r.bonus,
  grossEarnings: r.gross_earnings,
  pfEmployee: r.pf_employee,
  esiEmployee: r.esi_employee,
  professionalTax: r.professional_tax,
  tds: r.tds,
  otherDeductions: r.other_deductions,
  loanDeduction: r.loan_deduction,
  totalDeductions: r.total_deductions,
  netSalary: r.net_salary,
  workingDays: r.working_days,
  daysPresent: r.days_present,
  daysAbsent: r.days_absent,
  daysLeave: r.days_leave,
  lopDays: r.lop_days,
  lopDeduction: r.lop_deduction,
  status: r.status,
  remarks: r.remarks,
  organizationId: r.organization_id,
});

const mapAdvance = (r: any): SalaryAdvance => ({
  id: r.id,
  employeeId: r.employee_id,
  amount: r.amount,
  reason: r.reason,
  monthlyInstallment: r.monthly_installment,
  remainingAmount: r.remaining_amount,
  status: r.status,
  approvedBy: r.approved_by,
  appliedDate: r.applied_date,
  organizationId: r.organization_id,
});

// ── Payroll Calculation Engine ────────────────────────────────────────────────
// Calculate breakdown from CTC annual + structure

export function calcPayslipBreakdown(ctcAnnual: number, structure: SalaryStructure, _daysPresent: number, workingDays: number, lopDays: number = 0, overtime: number = 0, bonus: number = 0, otherDeductions: number = 0, loanDeduction: number = 0) {
  const ctcMonthly = ctcAnnual / 12;

  // Earnings
  const basic           = Math.round(ctcMonthly * (structure.basicPercent / 100));
  const hra             = Math.round(basic * (structure.hraPercent / 100));
  const da              = Math.round(basic * (structure.daPercent / 100));
  const specialAllowance = Math.round(basic * (structure.specialAllowancePercent / 100));
  const grossBeforeLop  = basic + hra + da + specialAllowance + overtime + bonus;

  // LOP deduction (Loss of Pay)
  const lopDeduction = workingDays > 0 ? Math.round((grossBeforeLop / workingDays) * lopDays) : 0;
  const grossEarnings = grossBeforeLop - lopDeduction;

  // Deductions
  const pfEmployee     = Math.round(basic * (structure.pfEmployeePercent / 100));
  // ESI applies only if gross <= 21000
  const esiEmployee    = grossEarnings <= 21000 ? Math.round(grossEarnings * (structure.esiEmployeePercent / 100)) : 0;
  const professionalTax = structure.professionalTax;
  // Simplified TDS (no TDS for now, can be added later)
  const tds = 0;

  const totalDeductions = pfEmployee + esiEmployee + professionalTax + tds + otherDeductions + loanDeduction;
  const netSalary = Math.max(0, grossEarnings - totalDeductions);

  return {
    basic, hra, da, specialAllowance, overtime, bonus,
    grossEarnings, lopDeduction, lopDays,
    pfEmployee, esiEmployee, professionalTax, tds,
    otherDeductions, loanDeduction, totalDeductions, netSalary,
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

export const payrollService = {
  // Salary Structures
  getSalaryStructures: async (): Promise<SalaryStructure[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('salary_structures')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapStructure);
  },

  createSalaryStructure: async (payload: Omit<SalaryStructure, 'id' | 'organizationId'>): Promise<SalaryStructure> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('salary_structures')
      .insert({
        name: payload.name,
        basic_percent: payload.basicPercent,
        hra_percent: payload.hraPercent,
        da_percent: payload.daPercent,
        special_allowance_percent: payload.specialAllowancePercent,
        pf_employee_percent: payload.pfEmployeePercent,
        pf_employer_percent: payload.pfEmployerPercent,
        esi_employee_percent: payload.esiEmployeePercent,
        esi_employer_percent: payload.esiEmployerPercent,
        professional_tax: payload.professionalTax,
        is_default: payload.isDefault,
        organization_id: orgId,
      })
      .select().single();
    if (error) throw error;
    return mapStructure(data);
  },

  // Employee Salary
  getEmployeeSalaries: async (): Promise<EmployeeSalary[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('employee_salary')
      .select('*')
      .eq('organization_id', orgId)
      .order('effective_from', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapEmpSalary);
  },

  getEmployeeSalary: async (employeeId: string): Promise<EmployeeSalary | null> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('employee_salary')
      .select('*')
      .eq('organization_id', orgId)
      .eq('employee_id', employeeId)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data ? mapEmpSalary(data) : null;
  },

  saveEmployeeSalary: async (payload: Omit<EmployeeSalary, 'id' | 'organizationId'>): Promise<EmployeeSalary> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('employee_salary')
      .upsert({
        employee_id: payload.employeeId,
        salary_structure_id: payload.salaryStructureId || null,
        ctc_annual: payload.ctcAnnual,
        effective_from: payload.effectiveFrom,
        bank_name: payload.bankName,
        account_number: payload.accountNumber,
        ifsc_code: payload.ifscCode,
        pan_number: payload.panNumber,
        organization_id: orgId,
      }, { onConflict: 'employee_id,effective_from' })
      .select().single();
    if (error) throw error;
    return mapEmpSalary(data);
  },

  // Payroll Runs
  getPayrollRuns: async (): Promise<PayrollRun[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('organization_id', orgId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapRun);
  },

  createPayrollRun: async (month: number, year: number): Promise<PayrollRun> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('payroll_runs')
      .insert({ month, year, organization_id: orgId, status: 'DRAFT' })
      .select().single();
    if (error) throw error;
    return mapRun(data);
  },

  updatePayrollRunStatus: async (runId: string, status: PayrollRun['status']): Promise<void> => {
    const updates: any = { status, updated: new Date().toISOString() };
    if (status === 'APPROVED') { updates.approved_at = new Date().toISOString(); }
    const { error } = await supabase.from('payroll_runs').update(updates).eq('id', runId);
    if (error) throw error;
  },

  // Payslips
  getPayslipsForRun: async (runId: string): Promise<Payslip[]> => {
    const { data, error } = await supabase
      .from('payslips')
      .select('*')
      .eq('payroll_run_id', runId)
      .order('employee_name');
    if (error) throw error;
    return (data || []).map(mapPayslip);
  },

  getMyPayslips: async (employeeId: string): Promise<Payslip[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('payslips')
      .select('*')
      .eq('organization_id', orgId)
      .eq('employee_id', employeeId)
      .order('year', { ascending: false })
      .order('month', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapPayslip);
  },

  savePayslip: async (runId: string, employeeId: string, empName: string, breakdown: ReturnType<typeof calcPayslipBreakdown>, month: number, year: number, daysPresent: number, workingDays: number, daysAbsent: number, daysLeave: number): Promise<Payslip> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('payslips')
      .upsert({
        payroll_run_id: runId,
        employee_id: employeeId,
        employee_name: empName,
        month, year,
        organization_id: orgId,
        ...breakdown,
        basic: breakdown.basic,
        hra: breakdown.hra,
        da: breakdown.da,
        special_allowance: breakdown.specialAllowance,
        overtime: breakdown.overtime,
        bonus: breakdown.bonus,
        gross_earnings: breakdown.grossEarnings,
        pf_employee: breakdown.pfEmployee,
        esi_employee: breakdown.esiEmployee,
        professional_tax: breakdown.professionalTax,
        tds: breakdown.tds,
        other_deductions: breakdown.otherDeductions,
        loan_deduction: breakdown.loanDeduction,
        total_deductions: breakdown.totalDeductions,
        net_salary: breakdown.netSalary,
        working_days: workingDays,
        days_present: daysPresent,
        days_absent: daysAbsent,
        days_leave: daysLeave,
        lop_days: breakdown.lopDays,
        lop_deduction: breakdown.lopDeduction,
        status: 'GENERATED',
      }, { onConflict: 'payroll_run_id,employee_id' })
      .select().single();
    if (error) throw error;
    return mapPayslip(data);
  },

  updatePayslipStatus: async (payslipId: string, status: Payslip['status']): Promise<void> => {
    const { error } = await supabase.from('payslips').update({ status, updated: new Date().toISOString() }).eq('id', payslipId);
    if (error) throw error;
  },

  // Advances
  getAdvances: async (): Promise<SalaryAdvance[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('salary_advances')
      .select('*')
      .eq('organization_id', orgId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapAdvance);
  },

  requestAdvance: async (employeeId: string, amount: number, reason: string): Promise<SalaryAdvance> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('salary_advances')
      .insert({
        employee_id: employeeId,
        amount,
        reason,
        remaining_amount: amount,
        applied_date: new Date().toISOString().split('T')[0],
        organization_id: orgId,
      })
      .select().single();
    if (error) throw error;
    return mapAdvance(data);
  },

  approveAdvance: async (advanceId: string, approverId: string): Promise<void> => {
    const { error } = await supabase
      .from('salary_advances')
      .update({ status: 'APPROVED', approved_by: approverId, updated: new Date().toISOString() })
      .eq('id', advanceId);
    if (error) throw error;
  },

  rejectAdvance: async (advanceId: string): Promise<void> => {
    const { error } = await supabase.from('salary_advances').update({ status: 'REJECTED', updated: new Date().toISOString() }).eq('id', advanceId);
    if (error) throw error;
  },
};
