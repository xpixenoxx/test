import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Loader2, X, Eye, CheckCircle2, FileX2, FileSignature, 
  Trash2, DollarSign, Send, Save, Printer, AlertTriangle, Building2
} from 'lucide-react';
import { invoiceService } from '../services/invoice.service';
import { projectService } from '../services/project.service';
import { Invoice, Client, Project, User } from '../types';
import { useToast } from '../context/ToastContext';

interface InvoicesProps {
  user: User;
}

const STATUS_COLORS: Record<Invoice['status'], string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-100 text-blue-700',
  PAID: 'bg-emerald-100 text-emerald-700',
  OVERDUE: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-slate-200 text-slate-500',
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-12 animate-in fade-in duration-200 overflow-y-auto">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? 'max-w-4xl' : 'max-w-lg'} animate-in zoom-in-95 duration-200`}>
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

const Invoices: React.FC<InvoicesProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);

  if (!isAdmin) {
    return (
      <div className="p-8 max-w-4xl mx-auto text-center mt-20">
        <AlertTriangle size={48} className="mx-auto text-slate-300 mb-4" />
        <h2 className="text-2xl font-bold text-slate-800">Access Denied</h2>
        <p className="text-slate-500 mt-2">Only administrators can manage invoices.</p>
      </div>
    );
  }

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [showModal, setShowModal] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  // Form State
  const [form, setForm] = useState({
    clientId: '',
    projectId: '',
    invoiceNumber: '',
    date: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: 'USD',
    taxAmount: '0',
    notes: 'Thank you for your business!',
  });
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [invs, cls, prjs] = await Promise.all([
        invoiceService.getInvoices(),
        projectService.getClients(),
        projectService.getProjects()
      ]);
      setInvoices(invs);
      setClients(cls);
      setProjects(prjs);
    } catch (e: any) {
      showToast(e.message || 'Failed to load invoices', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenNew = async () => {
    try {
      const nextNum = await invoiceService.getNextInvoiceNumber();
      setForm(prev => ({ ...prev, invoiceNumber: nextNum }));
      setShowModal(true);
    } catch (e: any) {
      showToast('Could not fetch next invoice number', 'error');
    }
  };

  const handleAddItem = () => {
    setItems([...items, { description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof typeof items[0], value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async () => {
    if (!form.clientId) { showToast('Client is required', 'warning'); return; }
    if (!form.invoiceNumber) { showToast('Invoice number is required', 'warning'); return; }
    if (items.length === 0 || !items[0].description) { showToast('Add at least one line item', 'warning'); return; }

    setIsSaving(true);
    try {
      const created = await invoiceService.createInvoice({
        clientId: form.clientId,
        projectId: form.projectId || undefined,
        invoiceNumber: form.invoiceNumber,
        date: form.date,
        dueDate: form.dueDate,
        currency: form.currency,
        taxAmount: Number(form.taxAmount) || 0,
        notes: form.notes,
      }, items);
      
      setInvoices(prev => [created, ...prev]);
      setShowModal(false);
      setForm({ ...form, clientId: '', projectId: '', taxAmount: '0' });
      setItems([{ description: '', quantity: 1, unitPrice: 0 }]);
      showToast('Invoice created', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to create invoice', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStatus = async (invoiceId: string, status: Invoice['status']) => {
    try {
      await invoiceService.updateInvoiceStatus(invoiceId, status);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status } : inv));
      if (viewInvoice?.id === invoiceId) setViewInvoice(prev => prev ? { ...prev, status } : null);
      showToast(`Invoice marked as ${status}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (invoiceId: string) => {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;
    try {
      await invoiceService.deleteInvoice(invoiceId);
      setInvoices(prev => prev.filter(inv => inv.id !== invoiceId));
      setViewInvoice(null);
      showToast('Invoice deleted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  };

  const getClientName = (id: string) => clients.find(c => c.id === id)?.name || id;

  const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const tax = Number(form.taxAmount) || 0;
  const total = subtotal + tax;

  const totalOutstanding = invoices.filter(i => i.status === 'SENT' || i.status === 'OVERDUE').reduce((s, i) => s + i.totalAmount, 0);
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.totalAmount, 0);

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileSignature className="text-primary" size={24} />
            Invoices
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage client billing and payments</p>
        </div>
        <button onClick={handleOpenNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
          <Plus size={16} /> Create Invoice
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0"><AlertTriangle size={18} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Outstanding</p>
            <p className="text-2xl font-bold text-slate-900 mt-0.5">${totalOutstanding.toLocaleString()}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><DollarSign size={18} /></div>
          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Paid (Lifetime)</p>
            <p className="text-2xl font-bold text-emerald-700 mt-0.5">${totalPaid.toLocaleString()}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <FileSignature size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No invoices created yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice No.</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Client</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3.5 font-bold text-slate-900 whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3.5 font-medium text-slate-800">{getClientName(inv.clientId)}</td>
                    <td className="px-5 py-3.5 text-slate-600">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-5 py-3.5 font-bold text-slate-900">{inv.currency} {inv.totalAmount.toLocaleString()}</td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COLORS[inv.status]}`}>{inv.status}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={() => setViewInvoice(inv)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
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
      {viewInvoice && (
        <Modal title={`Invoice ${viewInvoice.invoiceNumber}`} onClose={() => setViewInvoice(null)} wide>
          <div className="space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900 mb-1">{viewInvoice.currency} {viewInvoice.totalAmount.toLocaleString()}</p>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase ${STATUS_COLORS[viewInvoice.status]}`}>{viewInvoice.status}</span>
              </div>
              <div className="text-right text-sm">
                <p className="text-slate-500 font-bold uppercase text-xs">Date</p>
                <p className="font-semibold text-slate-900 mb-2">{new Date(viewInvoice.date).toLocaleDateString()}</p>
                <p className="text-slate-500 font-bold uppercase text-xs">Due Date</p>
                <p className="font-semibold text-slate-900">{new Date(viewInvoice.dueDate).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center gap-3">
              <Building2 className="text-slate-400" size={24} />
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">Bill To</p>
                <p className="font-bold text-slate-800 text-lg">{getClientName(viewInvoice.clientId)}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3 border-b border-slate-200 pb-2">Line Items</h3>
              <table className="w-full text-sm">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left font-semibold py-2">Description</th>
                    <th className="text-right font-semibold py-2">Qty</th>
                    <th className="text-right font-semibold py-2">Price</th>
                    <th className="text-right font-semibold py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viewInvoice.items?.map((item, i) => (
                    <tr key={i}>
                      <td className="py-3 text-slate-800">{item.description}</td>
                      <td className="py-3 text-right text-slate-600">{item.quantity}</td>
                      <td className="py-3 text-right text-slate-600">{item.unitPrice.toLocaleString()}</td>
                      <td className="py-3 text-right font-medium text-slate-900">{item.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200">
                  <tr>
                    <td colSpan={3} className="py-3 text-right text-slate-500 font-semibold">Subtotal</td>
                    <td className="py-3 text-right font-bold text-slate-800">{viewInvoice.currency} {viewInvoice.subtotal.toLocaleString()}</td>
                  </tr>
                  {viewInvoice.taxAmount > 0 && (
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-slate-500 font-semibold">Tax</td>
                      <td className="py-1 text-right font-bold text-slate-800">{viewInvoice.currency} {viewInvoice.taxAmount.toLocaleString()}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={3} className="py-3 text-right text-slate-800 font-bold uppercase tracking-wider text-xs">Total</td>
                    <td className="py-3 text-right font-bold text-primary text-lg">{viewInvoice.currency} {viewInvoice.totalAmount.toLocaleString()}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {viewInvoice.notes && (
              <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded-xl">
                {viewInvoice.notes}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-slate-200">
              {viewInvoice.status === 'DRAFT' && (
                <button onClick={() => handleUpdateStatus(viewInvoice.id, 'SENT')} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                  <Send size={16} /> Mark as Sent
                </button>
              )}
              {(viewInvoice.status === 'SENT' || viewInvoice.status === 'OVERDUE') && (
                <button onClick={() => handleUpdateStatus(viewInvoice.id, 'PAID')} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold flex items-center gap-2">
                  <CheckCircle2 size={16} /> Mark as Paid
                </button>
              )}
              {viewInvoice.status !== 'CANCELLED' && viewInvoice.status !== 'PAID' && (
                <button onClick={() => handleUpdateStatus(viewInvoice.id, 'CANCELLED')} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2">
                  <FileX2 size={16} /> Cancel Invoice
                </button>
              )}
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 ml-auto">
                <Printer size={16} /> Print
              </button>
              {viewInvoice.status === 'DRAFT' && (
                <button onClick={() => handleDelete(viewInvoice.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg ml-2">
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Create Modal */}
      {showModal && (
        <Modal title="Create Invoice" onClose={() => setShowModal(false)} wide>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Client" required>
                <select className={selectCls} value={form.clientId} onChange={e => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">Select a client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Project (Optional)">
                <select className={selectCls} value={form.projectId} onChange={e => setForm({ ...form, projectId: e.target.value })}>
                  <option value="">No Project</option>
                  {projects.filter(p => p.clientId === form.clientId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Invoice No." required>
                <input className={inputCls} value={form.invoiceNumber} onChange={e => setForm({ ...form, invoiceNumber: e.target.value })} />
              </Field>
              <Field label="Currency">
                <select className={selectCls} value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </Field>
              <Field label="Invoice Date" required>
                <input type="date" className={inputCls} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
              </Field>
              <Field label="Due Date" required>
                <input type="date" className={inputCls} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} />
              </Field>
            </div>

            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-2">Line Items</h3>
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="flex-1">
                      <input className={inputCls} placeholder="Description..." value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} />
                    </div>
                    <div className="w-24">
                      <input type="number" className={inputCls} placeholder="Qty" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', Number(e.target.value))} min="1" />
                    </div>
                    <div className="w-32">
                      <input type="number" className={inputCls} placeholder="Price" value={item.unitPrice} onChange={e => handleItemChange(index, 'unitPrice', Number(e.target.value))} min="0" />
                    </div>
                    <div className="w-32 p-2.5 text-right font-semibold text-slate-700 bg-slate-50 rounded-xl border border-slate-100">
                      {(item.quantity * item.unitPrice).toLocaleString()}
                    </div>
                    <button onClick={() => handleRemoveItem(index)} disabled={items.length === 1} className="p-2.5 text-slate-400 hover:text-red-500 disabled:opacity-30">
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
              <button onClick={handleAddItem} className="mt-2 text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                <Plus size={14} /> Add Line Item
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1">
                <Field label="Notes">
                  <textarea className={inputCls} rows={4} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
              <div className="w-full md:w-64 space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 font-semibold">Subtotal</span>
                  <span className="text-slate-800 font-bold">{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-semibold">Tax Amount</span>
                  <input type="number" className={`${inputCls} w-24 py-1 px-2 text-right`} value={form.taxAmount} onChange={e => setForm({ ...form, taxAmount: e.target.value })} />
                </div>
                <div className="flex justify-between text-base border-t border-slate-200 pt-3">
                  <span className="text-slate-800 font-bold uppercase tracking-wider text-xs">Total</span>
                  <span className="text-primary font-bold">{form.currency} {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <button onClick={handleSubmit} disabled={isSaving} className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Invoice
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Invoices;
