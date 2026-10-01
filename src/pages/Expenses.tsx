import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Plus, Loader2, X, AlertTriangle, Eye, Check, XCircle,
  Banknote, Filter, Image as ImageIcon, Save
} from 'lucide-react';
import { expenseService } from '../services/expense.service';
import { hrService } from '../services/hrService';
import { Expense, User } from '../types';
import { useToast } from '../context/ToastContext';

interface ExpensesProps {
  user: User;
}

const CATEGORIES = ['Travel', 'Meals', 'Supplies', 'Software', 'Client Event', 'Other'];

const STATUS_COLORS: Record<Expense['status'], string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-blue-100 text-blue-700',
  REJECTED: 'bg-red-100 text-red-700',
  REIMBURSED: 'bg-emerald-100 text-emerald-700',
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 animate-in fade-in duration-200 overflow-y-auto">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg animate-in zoom-in-95 duration-200">
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

const Expenses: React.FC<ExpensesProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REIMBURSED'>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);

  const emptyForm = { category: CATEGORIES[0], amount: '', currency: 'INR', date: new Date().toISOString().split('T')[0], merchant: '', description: '', receiptUrl: '' };
  const [form, setForm] = useState(emptyForm);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isAdmin ? await expenseService.getExpenses() : await expenseService.getMyExpenses(user.id);
      setExpenses(data);
      if (isAdmin) {
        const emps = await hrService.getEmployees();
        const empMap = emps.reduce((acc, e) => ({ ...acc, [e.id]: e.name }), {});
        setEmployees(empMap);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load expenses', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!form.amount || Number(form.amount) <= 0) { showToast('Amount must be greater than zero', 'warning'); return; }
    if (!form.date) { showToast('Date is required', 'warning'); return; }
    setIsSaving(true);
    try {
      const created = await expenseService.createExpense({
        employeeId: user.id,
        category: form.category,
        amount: Number(form.amount),
        currency: form.currency,
        date: form.date,
        merchant: form.merchant,
        description: form.description,
        receiptUrl: form.receiptUrl,
      });
      setExpenses(prev => [created, ...prev]);
      setShowModal(false);
      setForm(emptyForm);
      showToast('Expense submitted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to submit', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (expenseId: string, status: Expense['status']) => {
    try {
      const updated = await expenseService.updateStatus(expenseId, status, user.id);
      setExpenses(prev => prev.map(e => e.id === expenseId ? updated : e));
      if (viewExpense?.id === expenseId) setViewExpense(updated);
      showToast(`Expense marked as ${status.toLowerCase()}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await expenseService.deleteExpense(expenseId);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      setViewExpense(null);
      showToast('Expense deleted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  };

  const filteredExpenses = expenses.filter(e => filter === 'ALL' || e.status === filter);
  
  const totalPending = expenses.filter(e => e.status === 'PENDING').reduce((s, e) => s + e.amount, 0);
  const totalReimbursed = expenses.filter(e => e.status === 'REIMBURSED').reduce((s, e) => s + e.amount, 0);

  const getEmpName = (id: string) => employees[id] || (id === user.id ? 'You' : id.slice(0, 8));

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Receipt className="text-primary" size={24} />
            Expenses
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage claims and reimbursements</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
            <Plus size={16} /> New Expense
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 sm:p-5 flex items-start gap-4 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
          <Receipt size={20} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-blue-900">What is this section for?</h3>
          <p className="text-sm text-blue-700 mt-1 leading-relaxed max-w-3xl">
            This section is for submitting <strong>out-of-pocket business expenses</strong> (such as client meals, work travel, or software subscriptions) to get reimbursed by the company. <strong>This is not related to your personal salary or payroll.</strong>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0"><AlertTriangle size={18} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending Claims</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">₹{totalPending.toLocaleString('en-IN')}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><Banknote size={18} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Reimbursed</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">₹{totalReimbursed.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <Filter size={16} className="text-slate-400 mr-1" />
          {(['ALL', 'PENDING', 'APPROVED', 'REIMBURSED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Receipt size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No expenses found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Employee</th>}
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(e => (
                  <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap">{new Date(e.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    {isAdmin && <td className="px-5 py-3.5 font-medium text-slate-800">{getEmpName(e.employeeId)}</td>}
                    <td className="px-5 py-3.5 text-slate-700">
                      <div className="flex flex-col">
                        <span className="font-semibold">{e.category}</span>
                        {e.merchant && <span className="text-xs text-slate-500">{e.merchant}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">{e.currency} {e.amount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COLORS[e.status]}`}>{e.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setViewExpense(e)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                        <Eye size={13} /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewExpense && (
        <Modal title="Expense Details" onClose={() => setViewExpense(null)}>
          <div className="space-y-5">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Amount</p>
                <p className="text-2xl font-bold text-slate-900">{viewExpense.currency} {viewExpense.amount.toLocaleString()}</p>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full uppercase ${STATUS_COLORS[viewExpense.status]}`}>{viewExpense.status}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-slate-500 text-xs font-bold uppercase">Date</p><p className="font-semibold mt-1">{new Date(viewExpense.date).toLocaleDateString()}</p></div>
              <div><p className="text-slate-500 text-xs font-bold uppercase">Category</p><p className="font-semibold mt-1">{viewExpense.category}</p></div>
              {isAdmin && <div><p className="text-slate-500 text-xs font-bold uppercase">Employee</p><p className="font-semibold mt-1">{getEmpName(viewExpense.employeeId)}</p></div>}
              {viewExpense.merchant && <div><p className="text-slate-500 text-xs font-bold uppercase">Merchant</p><p className="font-semibold mt-1">{viewExpense.merchant}</p></div>}
            </div>

            {viewExpense.description && (
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase mb-1">Description</p>
                <p className="text-sm bg-slate-50 p-3 rounded-xl">{viewExpense.description}</p>
              </div>
            )}

            {viewExpense.receiptUrl && (
              <div>
                <p className="text-slate-500 text-xs font-bold uppercase mb-2">Receipt</p>
                <a href={viewExpense.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100">
                  <ImageIcon size={14} /> View Receipt
                </a>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-100">
              {isAdmin && viewExpense.status === 'PENDING' && (
                <>
                  <button onClick={() => handleUpdateStatus(viewExpense.id, 'APPROVED')} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                    <Check size={16} /> Approve
                  </button>
                  <button onClick={() => handleUpdateStatus(viewExpense.id, 'REJECTED')} className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                    <XCircle size={16} /> Reject
                  </button>
                </>
              )}
              {isAdmin && viewExpense.status === 'APPROVED' && (
                <button onClick={() => handleUpdateStatus(viewExpense.id, 'REIMBURSED')} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2">
                  <Banknote size={16} /> Mark as Reimbursed
                </button>
              )}
              {(viewExpense.employeeId === user.id && viewExpense.status === 'PENDING') && (
                <button onClick={() => handleDelete(viewExpense.id)} className="w-full py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold">
                  Delete Request
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* New Expense Modal */}
      {showModal && (
        <Modal title="Submit Expense" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount" required>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold">{form.currency}</span>
                  <input type="number" className={`${inputCls} pl-10`} placeholder="0.00" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
                </div>
              </Field>
              <Field label="Date" required>
                <input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </Field>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" required>
                <select className={selectCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Merchant">
                <input className={inputCls} placeholder="e.g. Uber, Amazon" value={form.merchant} onChange={e => setForm({ ...form, merchant: e.target.value })} />
              </Field>
            </div>

            <Field label="Description">
              <textarea className={inputCls} rows={2} placeholder="What was this expense for?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </Field>

            <Field label="Receipt URL (Optional)">
              <input type="url" className={inputCls} placeholder="https://..." value={form.receiptUrl} onChange={e => setForm({ ...form, receiptUrl: e.target.value })} />
              <p className="text-[10px] text-slate-500 mt-1">Upload to a secure host and paste URL here</p>
            </Field>

            <button onClick={handleSubmit} disabled={isSaving} className="w-full mt-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Submit Claim
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Expenses;
