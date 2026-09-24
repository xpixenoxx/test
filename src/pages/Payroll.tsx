import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet, Users, Play, CheckCircle2, Plus, Loader2, X,
  ChevronRight, DollarSign, BarChart3, TrendingUp,
  AlertTriangle, Eye, Check, Save, Settings2, CreditCard, Clock,
  FileText, ArrowDownLeft,
} from 'lucide-react';
import { payrollService, calcPayslipBreakdown } from '../services/payroll.service';
import { hrService } from '../services/hrService';
import { SalaryStructure, EmployeeSalary, PayrollRun, Payslip, SalaryAdvance, Employee, User } from '../types';
import { useToast } from '../context/ToastContext';

interface PayrollProps {
  user: User;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const INR = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

const RUN_STATUS_COLOR: Record<PayrollRun['status'], string> = {
  DRAFT:      'bg-slate-100 text-slate-600',
  PROCESSING: 'bg-blue-100 text-blue-700',
  APPROVED:   'bg-emerald-100 text-emerald-700',
  PAID:       'bg-violet-100 text-violet-700',
};

const SLIP_STATUS_COLOR: Record<Payslip['status'], string> = {
  GENERATED: 'bg-amber-100 text-amber-700',
  APPROVED:  'bg-emerald-100 text-emerald-700',
  PAID:      'bg-violet-100 text-violet-700',
  HELD:      'bg-red-100 text-red-700',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 animate-in fade-in duration-200 overflow-y-auto">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-in zoom-in-95 duration-200`}>
      <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100"><X size={18} /></button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all';
const selectCls = `${inputCls} cursor-pointer`;

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-slate-900', icon }) => (
  <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">{icon}</div>
    <div className="min-w-0">
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Payslip Detail View ─────────────────────────────────────────────────────

const PayslipDetail: React.FC<{ slip: Payslip; onClose: () => void }> = ({ slip, onClose }) => (
  <Modal title="Payslip Details" onClose={onClose} wide>
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl border border-primary/20">
        <div>
          <p className="font-bold text-slate-900 text-lg">{slip.employeeName}</p>
          <p className="text-sm text-primary font-medium">{MONTHS[slip.month - 1]} {slip.year}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 font-semibold">Net Salary</p>
          <p className="text-2xl font-bold text-primary">{INR(slip.netSalary)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Earnings */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <TrendingUp size={12} /> Earnings
          </h3>
          {[
            ['Basic', slip.basic],
            ['HRA', slip.hra],
            ['DA', slip.da],
            ['Special Allowance', slip.specialAllowance],
            ['Overtime', slip.overtime],
            ['Bonus', slip.bonus],
          ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
              <span className="text-slate-600">{label as string}</span>
              <span className="font-semibold text-slate-800">{INR(val as number)}</span>
            </div>
          ))}
          {slip.lopDeduction > 0 && (
            <div className="flex justify-between text-sm py-1.5 border-b border-slate-50">
              <span className="text-red-600">LOP Deduction ({slip.lopDays}d)</span>
              <span className="font-semibold text-red-600">- {INR(slip.lopDeduction)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold py-2 bg-emerald-50 px-2 rounded-lg">
            <span className="text-emerald-800">Gross Earnings</span>
            <span className="text-emerald-700">{INR(slip.grossEarnings)}</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <ArrowDownLeft size={12} /> Deductions
          </h3>
          {[
            ['PF (Employee)', slip.pfEmployee],
            ['ESI (Employee)', slip.esiEmployee],
            ['Professional Tax', slip.professionalTax],
            ['TDS', slip.tds],
            ['Loan EMI', slip.loanDeduction],
            ['Other', slip.otherDeductions],
          ].filter(([, v]) => (v as number) > 0).map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-sm py-1.5 border-b border-slate-50">
              <span className="text-slate-600">{label as string}</span>
              <span className="font-semibold text-red-600">- {INR(val as number)}</span>
            </div>
          ))}
          <div className="flex justify-between font-bold py-2 bg-red-50 px-2 rounded-lg">
            <span className="text-red-800">Total Deductions</span>
            <span className="text-red-700">- {INR(slip.totalDeductions)}</span>
          </div>
        </div>
      </div>

      {/* Net */}
      <div className="flex justify-between items-center p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Net Take-Home</p>
          <p className="text-3xl font-bold text-primary mt-0.5">{INR(slip.netSalary)}</p>
        </div>
        <div className="text-right text-xs text-slate-500 space-y-0.5">
          <p>Working Days: {slip.workingDays}</p>
          <p>Present: {slip.daysPresent}</p>
          <p>Absent: {slip.daysAbsent}</p>
          {slip.lopDays > 0 && <p className="text-red-600">LOP: {slip.lopDays} days</p>}
        </div>
      </div>
    </div>
  </Modal>
);

// ─── Main Page ────────────────────────────────────────────────────────────────

const Payroll: React.FC<PayrollProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);

  // ── Data ──
  const [structures, setStructures]         = useState<SalaryStructure[]>([]);
  const [empSalaries, setEmpSalaries]       = useState<EmployeeSalary[]>([]);
  const [runs, setRuns]                     = useState<PayrollRun[]>([]);
  const [payslips, setPayslips]             = useState<Payslip[]>([]);
  const [myPayslips, setMyPayslips]         = useState<Payslip[]>([]);
  const [advances, setAdvances]             = useState<SalaryAdvance[]>([]);
  const [employees, setEmployees]           = useState<Employee[]>([]);

  // ── View ──
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'RUNS' | 'PAYSLIPS' | 'SALARY' | 'ADVANCES'>(
    isAdmin ? 'OVERVIEW' : 'PAYSLIPS'
  );
  const [selectedRun, setSelectedRun]         = useState<PayrollRun | null>(null);
  const [viewSlip, setViewSlip]               = useState<Payslip | null>(null);
  const [isLoading, setIsLoading]             = useState(true);
  const [isSaving, setIsSaving]               = useState(false);

  // ── Modals ──
  const [showRunModal, setShowRunModal]           = useState(false);
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showSalaryModal, setShowSalaryModal]     = useState(false);
  const [showAdvanceModal, setShowAdvanceModal]   = useState(false);
  const [processingRun, setProcessingRun]         = useState(false);

  // ── Forms ──
  const now = new Date();
  const [runForm, setRunForm]       = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const emptyStructure              = { name: '', basicPercent: 50, hraPercent: 20, daPercent: 10, specialAllowancePercent: 0, pfEmployeePercent: 12, pfEmployerPercent: 12, esiEmployeePercent: 0.75, esiEmployerPercent: 3.25, professionalTax: 200, isDefault: false };
  const [structureForm, setStructureForm] = useState(emptyStructure);
  const emptySalary = { employeeId: '', salaryStructureId: '', ctcAnnual: '', effectiveFrom: new Date().toISOString().split('T')[0], bankName: '', accountNumber: '', ifscCode: '', panNumber: '' };
  const [salaryForm, setSalaryForm] = useState(emptySalary);
  const [advanceForm, setAdvanceForm] = useState({ amount: '', reason: '' });

  // ── Load ──
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isAdmin) {
        const [st, es, ru, adv, emps] = await Promise.all([
          payrollService.getSalaryStructures(),
          payrollService.getEmployeeSalaries(),
          payrollService.getPayrollRuns(),
          payrollService.getAdvances(),
          hrService.getEmployees(),
        ]);
        setStructures(st);
        setEmpSalaries(es);
        setRuns(ru);
        setAdvances(adv);
        setEmployees(emps);
      }
      // All users see their own payslips
      const mySlips = await payrollService.getMyPayslips(user.id);
      setMyPayslips(mySlips);
      if (!isAdmin) {
        const adv = await payrollService.getAdvances();
        setAdvances(adv.filter(a => a.employeeId === user.id));
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load payroll data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Actions ──

  const handleCreateRun = async () => {
    setIsSaving(true);
    try {
      const run = await payrollService.createPayrollRun(runForm.month, runForm.year);
      setRuns(prev => [run, ...prev]);
      setSelectedRun(run);
      setShowRunModal(false);
      showToast(`Payroll run created for ${MONTHS[run.month - 1]} ${run.year}`, 'success');
      setActiveTab('RUNS');
    } catch (e: any) {
      showToast(e.message?.includes('unique') ? 'A payroll run for that month already exists.' : (e.message || 'Failed to create'), 'error');
    } finally { setIsSaving(false); }
  };

  const handleProcessRun = async (run: PayrollRun) => {
    if (!confirm(`Process payroll for ${MONTHS[run.month - 1]} ${run.year}? This will generate payslips for all employees with salary configured.`)) return;
    setProcessingRun(true);
    try {
      // Get attendance summary for the month
      const relevantSalaries = empSalaries.reduce<Record<string, EmployeeSalary>>((acc, es) => {
        if (!acc[es.employeeId] || es.effectiveFrom > acc[es.employeeId].effectiveFrom) acc[es.employeeId] = es;
        return acc;
      }, {});

      const workingDays = 22; // Default working days; can be computed from attendance later
      let totalGross = 0, totalDeductions = 0, totalNet = 0;

      for (const [empId, salary] of Object.entries(relevantSalaries)) {
        const emp = employees.find(e => e.id === empId);
        if (!emp) continue;
        const structure = salary.salaryStructureId ? structures.find(s => s.id === salary.salaryStructureId) : structures.find(s => s.isDefault);
        if (!structure) continue;

        // For now use default attendance (full attendance). Real integration with attendance module to follow.
        const daysPresent = workingDays;
        const daysAbsent = 0;
        const daysLeave = 0;
        const lopDays = 0;

        const breakdown = calcPayslipBreakdown(salary.ctcAnnual, structure, daysPresent, workingDays, lopDays);

        await payrollService.savePayslip(
          run.id, empId, emp.name || emp.employeeId || empId,
          breakdown, run.month, run.year,
          daysPresent, workingDays, daysAbsent, daysLeave
        );

        totalGross += breakdown.grossEarnings;
        totalDeductions += breakdown.totalDeductions;
        totalNet += breakdown.netSalary;
      }

      // Update totals on the run
      await supabaseUpdateRunTotals(run.id, totalGross, totalDeductions, totalNet);
      await payrollService.updatePayrollRunStatus(run.id, 'PROCESSING');

      showToast('Payslips generated successfully!', 'success');
      await loadData();
      const slips = await payrollService.getPayslipsForRun(run.id);
      setPayslips(slips);
      setSelectedRun({ ...run, status: 'PROCESSING', totalGross, totalDeductions, totalNet });
      setActiveTab('RUNS');
    } catch (e: any) {
      showToast(e.message || 'Failed to process payroll', 'error');
    } finally { setProcessingRun(false); }
  };

  // Helper (direct Supabase call since service doesn't expose this yet)
  const supabaseUpdateRunTotals = async (runId: string, gross: number, deductions: number, net: number) => {
    const { supabase } = await import('../services/supabase');
    await supabase.from('payroll_runs').update({
      total_gross: gross, total_deductions: deductions, total_net: net,
      processed_at: new Date().toISOString(), updated: new Date().toISOString(),
    }).eq('id', runId);
  };

  const handleApproveRun = async (run: PayrollRun) => {
    if (!confirm(`Approve payroll for ${MONTHS[run.month - 1]} ${run.year}?`)) return;
    try {
      await payrollService.updatePayrollRunStatus(run.id, 'APPROVED');
      setRuns(prev => prev.map(r => r.id === run.id ? { ...r, status: 'APPROVED' } : r));
      showToast('Payroll approved', 'success');
    } catch { showToast('Failed to approve', 'error'); }
  };

  const handleMarkPaid = async (run: PayrollRun) => {
    if (!confirm('Mark this payroll as PAID? This cannot be undone.')) return;
    try {
      await payrollService.updatePayrollRunStatus(run.id, 'PAID');
      setRuns(prev => prev.map(r => r.id === run.id ? { ...r, status: 'PAID' } : r));
      showToast('Payroll marked as paid', 'success');
    } catch { showToast('Failed', 'error'); }
  };

  const handleLoadPayslips = async (run: PayrollRun) => {
    setSelectedRun(run);
    setIsLoading(true);
    try {
      const slips = await payrollService.getPayslipsForRun(run.id);
      setPayslips(slips);
    } catch { showToast('Failed to load payslips', 'error'); }
    finally { setIsLoading(false); }
  };

  const handleSaveStructure = async () => {
    if (!structureForm.name.trim()) { showToast('Name is required', 'warning'); return; }
    setIsSaving(true);
    try {
      await payrollService.createSalaryStructure(structureForm);
      showToast('Salary structure saved', 'success');
      setShowStructureModal(false);
      setStructureForm(emptyStructure);
      const s = await payrollService.getSalaryStructures();
      setStructures(s);
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleSaveSalary = async () => {
    if (!salaryForm.employeeId || !salaryForm.ctcAnnual) { showToast('Employee and CTC are required', 'warning'); return; }
    setIsSaving(true);
    try {
      await payrollService.saveEmployeeSalary({
        employeeId: salaryForm.employeeId,
        salaryStructureId: salaryForm.salaryStructureId || undefined,
        ctcAnnual: Number(salaryForm.ctcAnnual),
        effectiveFrom: salaryForm.effectiveFrom,
        bankName: salaryForm.bankName || undefined,
        accountNumber: salaryForm.accountNumber || undefined,
        ifscCode: salaryForm.ifscCode || undefined,
        panNumber: salaryForm.panNumber || undefined,
      });
      showToast('Salary saved', 'success');
      setShowSalaryModal(false);
      setSalaryForm(emptySalary);
      const es = await payrollService.getEmployeeSalaries();
      setEmpSalaries(es);
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleRequestAdvance = async () => {
    if (!advanceForm.amount || Number(advanceForm.amount) <= 0) { showToast('Amount is required', 'warning'); return; }
    setIsSaving(true);
    try {
      await payrollService.requestAdvance(user.id, Number(advanceForm.amount), advanceForm.reason);
      showToast('Advance request submitted', 'success');
      setShowAdvanceModal(false);
      setAdvanceForm({ amount: '', reason: '' });
      await loadData();
    } catch (e: any) { showToast(e.message || 'Failed', 'error'); }
    finally { setIsSaving(false); }
  };

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || id.slice(0, 8);
  const latestRun = runs[0];
  const totalPayroll = runs.filter(r => r.status === 'PAID').reduce((s, r) => s + r.totalNet, 0);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Wallet className="text-primary" size={24} />
            Payroll
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {isAdmin ? `${employees.length} employees · ${runs.length} payroll runs` : 'Your payslips & advances'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowStructureModal(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              <Settings2 size={15} /> Structure
            </button>
            <button onClick={() => setShowSalaryModal(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              <CreditCard size={15} /> Set CTC
            </button>
            <button onClick={() => setShowRunModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm shadow-primary/20 transition-all active:scale-95">
              <Plus size={16} /> New Payroll Run
            </button>
          </div>
        )}
        {!isAdmin && (
          <button onClick={() => setShowAdvanceModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
            <ArrowDownLeft size={16} /> Request Advance
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {(isAdmin
          ? ['OVERVIEW', 'RUNS', 'PAYSLIPS', 'SALARY', 'ADVANCES'] as const
          : ['PAYSLIPS', 'ADVANCES'] as const
        ).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-colors whitespace-nowrap relative ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab === 'OVERVIEW' && <BarChart3 size={14} />}
            {tab === 'RUNS' && <Play size={14} />}
            {tab === 'PAYSLIPS' && <FileText size={14} />}
            {tab === 'SALARY' && <DollarSign size={14} />}
            {tab === 'ADVANCES' && <ArrowDownLeft size={14} />}
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
            {activeTab === tab && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <>
          {/* ── OVERVIEW ── */}
          {activeTab === 'OVERVIEW' && isAdmin && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <StatCard label="Total Employees" value={employees.length} sub="with salary configured" icon={<Users size={18} />} />
                <StatCard label="Configured" value={Object.keys(empSalaries.reduce((a, e) => ({ ...a, [e.employeeId]: 1 }), {})).length} sub="have CTC set" icon={<CreditCard size={18} />} />
                <StatCard label="Total Paid (YTD)" value={INR(totalPayroll)} sub="across paid runs" color="text-emerald-700" icon={<TrendingUp size={18} />} />
                <StatCard
                  label="Latest Run"
                  value={latestRun ? `${MONTHS[latestRun.month - 1]} ${latestRun.year}` : 'None'}
                  sub={latestRun?.status || '—'}
                  icon={<Clock size={18} />}
                />
              </div>

              {latestRun && (
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h2 className="font-bold text-slate-800 mb-4">Latest Run — {MONTHS[latestRun.month - 1]} {latestRun.year}</h2>
                  <div className="grid grid-cols-3 gap-4 text-center mb-4">
                    <div className="p-3 bg-emerald-50 rounded-xl">
                      <p className="text-xs text-emerald-600 font-bold uppercase">Gross</p>
                      <p className="text-xl font-bold text-emerald-700">{INR(latestRun.totalGross)}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-xl">
                      <p className="text-xs text-red-600 font-bold uppercase">Deductions</p>
                      <p className="text-xl font-bold text-red-700">{INR(latestRun.totalDeductions)}</p>
                    </div>
                    <div className="p-3 bg-primary/5 rounded-xl">
                      <p className="text-xs text-primary font-bold uppercase">Net</p>
                      <p className="text-xl font-bold text-primary">{INR(latestRun.totalNet)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${RUN_STATUS_COLOR[latestRun.status]}`}>{latestRun.status}</span>
                    {latestRun.status === 'DRAFT' && (
                      <button onClick={() => handleProcessRun(latestRun)} disabled={processingRun} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-60">
                        {processingRun ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />} Process Payroll
                      </button>
                    )}
                    {latestRun.status === 'PROCESSING' && (
                      <button onClick={() => handleApproveRun(latestRun)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                        <Check size={13} /> Approve Payroll
                      </button>
                    )}
                    {latestRun.status === 'APPROVED' && (
                      <button onClick={() => handleMarkPaid(latestRun)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                        <CheckCircle2 size={13} /> Mark as Paid
                      </button>
                    )}
                    <button onClick={() => { setSelectedRun(latestRun); handleLoadPayslips(latestRun); setActiveTab('PAYSLIPS'); }} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline ml-auto">
                      View Payslips <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── RUNS ── */}
          {activeTab === 'RUNS' && isAdmin && (
            <div className="space-y-3">
              {runs.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Play size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No payroll runs yet</p>
                  <p className="text-sm mt-1">Create your first payroll run to get started.</p>
                </div>
              ) : (
                runs.map(run => (
                  <div key={run.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center">
                        <span className="text-[10px] font-bold text-primary">{MONTHS[run.month - 1]}</span>
                        <span className="text-xs font-bold text-slate-600">{run.year}</span>
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{MONTHS[run.month - 1]} {run.year}</p>
                        <p className="text-xs text-slate-500">Net: {INR(run.totalNet)} · Gross: {INR(run.totalGross)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase ${RUN_STATUS_COLOR[run.status]}`}>{run.status}</span>
                      {run.status === 'DRAFT' && (
                        <button onClick={() => handleProcessRun(run)} disabled={processingRun} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">
                          <Play size={12} /> Process
                        </button>
                      )}
                      {run.status === 'PROCESSING' && (
                        <button onClick={() => handleApproveRun(run)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">
                          <Check size={12} /> Approve
                        </button>
                      )}
                      {run.status === 'APPROVED' && (
                        <button onClick={() => handleMarkPaid(run)} className="flex items-center gap-1 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-xs font-bold hover:bg-violet-700">
                          <CheckCircle2 size={12} /> Mark Paid
                        </button>
                      )}
                      <button onClick={() => { handleLoadPayslips(run); setActiveTab('PAYSLIPS'); }} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                        Payslips <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ── PAYSLIPS ── */}
          {activeTab === 'PAYSLIPS' && (
            <div className="space-y-4">
              {isAdmin && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Run:</span>
                  {runs.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleLoadPayslips(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedRun?.id === r.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {MONTHS[r.month - 1]} {r.year}
                    </button>
                  ))}
                </div>
              )}

              {(() => {
                const slipsToShow = isAdmin ? payslips : myPayslips;
                if (slipsToShow.length === 0) return (
                  <div className="text-center py-16 text-slate-400">
                    <FileText size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">{isAdmin ? (selectedRun ? 'No payslips in this run' : 'Select a payroll run above') : 'No payslips yet'}</p>
                  </div>
                );
                return (
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>}
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Period</th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Gross</th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Deductions</th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Net Pay</th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slipsToShow.map(s => (
                          <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                            {isAdmin && <td className="px-5 py-3.5 font-medium text-slate-800">{s.employeeName || '—'}</td>}
                            <td className="px-5 py-3.5 text-slate-600">{MONTHS[s.month - 1]} {s.year}</td>
                            <td className="px-5 py-3.5 text-slate-600 hidden md:table-cell">{INR(s.grossEarnings)}</td>
                            <td className="px-5 py-3.5 text-red-600 hidden md:table-cell">- {INR(s.totalDeductions)}</td>
                            <td className="px-5 py-3.5 font-bold text-slate-900">{INR(s.netSalary)}</td>
                            <td className="px-5 py-3.5">
                              <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${SLIP_STATUS_COLOR[s.status]}`}>{s.status}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <button onClick={() => setViewSlip(s)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                                <Eye size={13} /> View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── SALARY CONFIG ── */}
          {activeTab === 'SALARY' && isAdmin && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Structures */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h2 className="font-bold text-slate-800 mb-3 flex items-center justify-between">
                    Salary Structures ({structures.length})
                    <button onClick={() => { setShowStructureModal(true); setStructureForm(emptyStructure); }} className="text-xs text-primary font-semibold flex items-center gap-1">
                      <Plus size={13} /> Add
                    </button>
                  </h2>
                  {structures.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-6">No structures yet. Create one to configure payroll.</p>
                  ) : (
                    <div className="space-y-2">
                      {structures.map(s => (
                        <div key={s.id} className="p-3 bg-slate-50 rounded-xl">
                          <p className="font-semibold text-slate-800 text-sm">{s.name} {s.isDefault && <span className="text-[10px] bg-primary text-white px-1.5 py-0.5 rounded ml-1">Default</span>}</p>
                          <p className="text-xs text-slate-500 mt-1">Basic {s.basicPercent}% · HRA {s.hraPercent}% · PF {s.pfEmployeePercent}% · PT ₹{s.professionalTax}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Employee CTCs */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5">
                  <h2 className="font-bold text-slate-800 mb-3 flex items-center justify-between">
                    Employee CTC ({empSalaries.length})
                    <button onClick={() => { setShowSalaryModal(true); setSalaryForm(emptySalary); }} className="text-xs text-primary font-semibold flex items-center gap-1">
                      <Plus size={13} /> Assign
                    </button>
                  </h2>
                  {empSalaries.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-6">No salary assignments yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {empSalaries.slice(0, 10).map(es => (
                        <div key={es.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{getEmpName(es.employeeId)}</p>
                            <p className="text-xs text-slate-500">From {es.effectiveFrom}</p>
                          </div>
                          <p className="font-bold text-primary text-sm">{INR(es.ctcAnnual)}<span className="text-xs text-slate-400 font-normal">/yr</span></p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── ADVANCES ── */}
          {activeTab === 'ADVANCES' && (
            <div className="space-y-4">
              {!isAdmin && (
                <div className="flex justify-end">
                  <button onClick={() => setShowAdvanceModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
                    <Plus size={14} /> Request Advance
                  </button>
                </div>
              )}
              {advances.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <ArrowDownLeft size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No advance requests</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>}
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Reason</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {advances.map(a => (
                        <tr key={a.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          {isAdmin && <td className="px-5 py-3.5 font-medium text-slate-800">{getEmpName(a.employeeId)}</td>}
                          <td className="px-5 py-3.5 font-bold text-slate-900">{INR(a.amount)}</td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs hidden md:table-cell">{a.reason || '—'}</td>
                          <td className="px-5 py-3.5 text-slate-600">{new Date(a.appliedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                              a.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                              a.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                              a.status === 'CLEARED'  ? 'bg-violet-100 text-violet-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>{a.status}</span>
                          </td>
                          {isAdmin && a.status === 'PENDING' && (
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <button onClick={() => payrollService.approveAdvance(a.id, user.id).then(loadData)} className="text-xs text-emerald-600 font-semibold hover:underline">Approve</button>
                                <button onClick={() => payrollService.rejectAdvance(a.id).then(loadData)} className="text-xs text-red-500 font-semibold hover:underline">Reject</button>
                              </div>
                            </td>
                          )}
                          {isAdmin && a.status !== 'PENDING' && <td className="px-5 py-3.5" />}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════ Modals ════ */}

      {/* Create Run */}
      {showRunModal && (
        <Modal title="New Payroll Run" onClose={() => setShowRunModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Month" required>
                <select className={selectCls} value={runForm.month} onChange={e => setRunForm(f => ({ ...f, month: Number(e.target.value) }))}>
                  {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                </select>
              </Field>
              <Field label="Year" required>
                <input type="number" className={inputCls} value={runForm.year} onChange={e => setRunForm(f => ({ ...f, year: Number(e.target.value) }))} min="2020" max="2099" />
              </Field>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              After creating, click "Process Payroll" to generate payslips for all configured employees.
            </div>
            <button onClick={handleCreateRun} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Payroll Run
            </button>
          </div>
        </Modal>
      )}

      {/* Salary Structure */}
      {showStructureModal && (
        <Modal title="Salary Structure" onClose={() => setShowStructureModal(false)}>
          <div className="space-y-4">
            <Field label="Structure Name" required>
              <input className={inputCls} placeholder="e.g. Standard Dev Package" value={structureForm.name} onChange={e => setStructureForm(f => ({ ...f, name: e.target.value }))} />
            </Field>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Earnings (% of CTC/Basic)</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Basic % of CTC"><input type="number" className={inputCls} value={structureForm.basicPercent} onChange={e => setStructureForm(f => ({ ...f, basicPercent: Number(e.target.value) }))} /></Field>
              <Field label="HRA % of Basic"><input type="number" className={inputCls} value={structureForm.hraPercent} onChange={e => setStructureForm(f => ({ ...f, hraPercent: Number(e.target.value) }))} /></Field>
              <Field label="DA % of Basic"><input type="number" className={inputCls} value={structureForm.daPercent} onChange={e => setStructureForm(f => ({ ...f, daPercent: Number(e.target.value) }))} /></Field>
              <Field label="Special Allow. %"><input type="number" className={inputCls} value={structureForm.specialAllowancePercent} onChange={e => setStructureForm(f => ({ ...f, specialAllowancePercent: Number(e.target.value) }))} /></Field>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deductions</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PF Employee %"><input type="number" className={inputCls} value={structureForm.pfEmployeePercent} onChange={e => setStructureForm(f => ({ ...f, pfEmployeePercent: Number(e.target.value) }))} /></Field>
              <Field label="ESI Employee %"><input type="number" className={inputCls} value={structureForm.esiEmployeePercent} onChange={e => setStructureForm(f => ({ ...f, esiEmployeePercent: Number(e.target.value) }))} /></Field>
              <Field label="Professional Tax ₹"><input type="number" className={inputCls} value={structureForm.professionalTax} onChange={e => setStructureForm(f => ({ ...f, professionalTax: Number(e.target.value) }))} /></Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={structureForm.isDefault} onChange={e => setStructureForm(f => ({ ...f, isDefault: e.target.checked }))} className="w-4 h-4 accent-primary" />
              <span className="text-sm text-slate-700">Set as default structure</span>
            </label>
            <button onClick={handleSaveStructure} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Structure
            </button>
          </div>
        </Modal>
      )}

      {/* Employee Salary */}
      {showSalaryModal && (
        <Modal title="Assign Employee CTC" onClose={() => setShowSalaryModal(false)}>
          <div className="space-y-4">
            <Field label="Employee" required>
              <select className={selectCls} value={salaryForm.employeeId} onChange={e => setSalaryForm(f => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Select employee</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Annual CTC (₹)" required>
                <input type="number" className={inputCls} placeholder="e.g. 600000" value={salaryForm.ctcAnnual} onChange={e => setSalaryForm(f => ({ ...f, ctcAnnual: e.target.value }))} />
              </Field>
              <Field label="Effective From" required>
                <input type="date" className={inputCls} value={salaryForm.effectiveFrom} onChange={e => setSalaryForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
              </Field>
            </div>
            <Field label="Salary Structure">
              <select className={selectCls} value={salaryForm.salaryStructureId} onChange={e => setSalaryForm(f => ({ ...f, salaryStructureId: e.target.value }))}>
                <option value="">Use default structure</option>
                {structures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Bank Details</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Bank Name"><input className={inputCls} placeholder="HDFC Bank" value={salaryForm.bankName} onChange={e => setSalaryForm(f => ({ ...f, bankName: e.target.value }))} /></Field>
              <Field label="Account Number"><input className={inputCls} placeholder="1234567890" value={salaryForm.accountNumber} onChange={e => setSalaryForm(f => ({ ...f, accountNumber: e.target.value }))} /></Field>
              <Field label="IFSC Code"><input className={inputCls} placeholder="HDFC0001234" value={salaryForm.ifscCode} onChange={e => setSalaryForm(f => ({ ...f, ifscCode: e.target.value }))} /></Field>
              <Field label="PAN Number"><input className={inputCls} placeholder="ABCDE1234F" value={salaryForm.panNumber} onChange={e => setSalaryForm(f => ({ ...f, panNumber: e.target.value }))} /></Field>
            </div>
            <button onClick={handleSaveSalary} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Salary
            </button>
          </div>
        </Modal>
      )}

      {/* Advance Request */}
      {showAdvanceModal && (
        <Modal title="Request Salary Advance" onClose={() => setShowAdvanceModal(false)}>
          <div className="space-y-4">
            <Field label="Amount (₹)" required>
              <input type="number" className={inputCls} placeholder="e.g. 10000" value={advanceForm.amount} onChange={e => setAdvanceForm(f => ({ ...f, amount: e.target.value }))} />
            </Field>
            <Field label="Reason">
              <textarea className={inputCls} rows={3} placeholder="Briefly explain why you need this advance..." value={advanceForm.reason} onChange={e => setAdvanceForm(f => ({ ...f, reason: e.target.value }))} />
            </Field>
            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 flex items-start gap-2">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              Advances are subject to HR approval and will be recovered in monthly installments.
            </div>
            <button onClick={handleRequestAdvance} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownLeft size={16} />}
              Submit Request
            </button>
          </div>
        </Modal>
      )}

      {/* Payslip Detail */}
      {viewSlip && <PayslipDetail slip={viewSlip} onClose={() => setViewSlip(null)} />}

    </div>
  );
};

export default Payroll;
