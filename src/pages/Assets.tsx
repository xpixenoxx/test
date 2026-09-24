import React, { useState, useEffect, useCallback } from 'react';
import {
  Laptop, Plus, Loader2, X, Server, Keyboard, Mouse, Smartphone, Badge,
  Search, Filter, Edit2, Save, Users, Monitor, Building2, Wrench, Check
} from 'lucide-react';
import { assetService } from '../services/asset.service';
import { hrService } from '../services/hrService';
import { Asset, User } from '../types';
import { useToast } from '../context/ToastContext';

interface AssetsProps {
  user: User;
}

const CATEGORIES = ['Laptop', 'Monitor', 'Mobile', 'Keyboard', 'Mouse', 'Desk', 'Chair', 'Access Card', 'Other'];

const STATUS_COLORS: Record<Asset['status'], string> = {
  AVAILABLE: 'bg-emerald-100 text-emerald-700',
  ALLOCATED: 'bg-blue-100 text-blue-700',
  MAINTENANCE: 'bg-amber-100 text-amber-700',
  RETIRED: 'bg-slate-100 text-slate-500',
};

const CATEGORY_ICONS: Record<string, any> = {
  Laptop: Laptop, Monitor: Monitor, Mobile: Smartphone, Keyboard: Keyboard,
  Mouse: Mouse, Desk: Building2, Chair: Building2, 'Access Card': Badge, Other: Server
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

const Assets: React.FC<AssetsProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | Asset['status']>('ALL');

  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const emptyForm = { name: '', category: CATEGORIES[0], serialNumber: '', condition: 'New', purchaseDate: '', purchaseCost: '', notes: '' };
  const [form, setForm] = useState(emptyForm);
  const [assignForm, setAssignForm] = useState({ employeeId: '' });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isAdmin ? await assetService.getAssets() : await assetService.getMyAssets(user.id);
      setAssets(data);
      if (isAdmin) {
        const emps = await hrService.getEmployees();
        setEmployees(emps);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load assets', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!form.name) { showToast('Asset Name is required', 'warning'); return; }
    setIsSaving(true);
    try {
      if (selectedAsset) {
        const updated = await assetService.updateAsset(selectedAsset.id, {
          name: form.name,
          category: form.category,
          serialNumber: form.serialNumber,
          condition: form.condition,
          purchaseDate: form.purchaseDate || undefined,
          purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
          notes: form.notes,
        });
        setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
        showToast('Asset updated', 'success');
      } else {
        const created = await assetService.createAsset({
          name: form.name,
          category: form.category,
          serialNumber: form.serialNumber,
          condition: form.condition,
          purchaseDate: form.purchaseDate || undefined,
          purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
          notes: form.notes,
        });
        setAssets(prev => [created, ...prev]);
        showToast('Asset added', 'success');
      }
      setShowModal(false);
      setForm(emptyForm);
      setSelectedAsset(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to save asset', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedAsset) return;
    setIsSaving(true);
    try {
      const empId = assignForm.employeeId === 'UNASSIGN' ? null : assignForm.employeeId;
      const updated = await assetService.assignAsset(selectedAsset.id, empId);
      setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(empId ? 'Asset assigned successfully' : 'Asset unassigned', 'success');
      setShowAssignModal(false);
      setSelectedAsset(null);
    } catch (e: any) {
      showToast(e.message || 'Failed to assign asset', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkStatus = async (asset: Asset, status: Asset['status']) => {
    try {
      const updated = await assetService.updateAsset(asset.id, { status });
      setAssets(prev => prev.map(a => a.id === updated.id ? updated : a));
      showToast(`Asset marked as ${status.toLowerCase()}`, 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to update status', 'error');
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    try {
      await assetService.deleteAsset(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      showToast('Asset deleted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  };

  const filteredAssets = assets.filter(a => {
    if (filter !== 'ALL' && a.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return a.name.toLowerCase().includes(s) || (a.serialNumber && a.serialNumber.toLowerCase().includes(s));
    }
    return true;
  });

  const getEmpName = (id: string) => employees.find(e => e.id === id)?.name || (id === user.id ? 'You' : id.slice(0, 8));

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Laptop className="text-primary" size={24} />
            Assets
          </h1>
          <p className="text-slate-500 text-sm mt-1">{isAdmin ? 'Manage company hardware and allocations' : 'Assets assigned to you'}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setForm(emptyForm); setSelectedAsset(null); setShowModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
              <Plus size={16} /> Add Asset
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-slate-400 mr-1" />
            {(['ALL', 'AVAILABLE', 'ALLOCATED', 'MAINTENANCE', 'RETIRED'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search assets..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={32} /></div>
        ) : filteredAssets.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Laptop size={48} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No assets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 bg-slate-50/50">
            {filteredAssets.map(asset => {
              const Icon = CATEGORY_ICONS[asset.category] || CATEGORY_ICONS.Other;
              return (
                <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                      <Icon size={20} />
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COLORS[asset.status]}`}>{asset.status}</span>
                  </div>
                  <h3 className="font-bold text-slate-900 truncate" title={asset.name}>{asset.name}</h3>
                  <p className="text-xs text-slate-500 mt-1">{asset.category} {asset.serialNumber ? `· ${asset.serialNumber}` : ''}</p>
                  
                  {asset.assignedTo && (
                    <div className="mt-4 p-2 bg-blue-50 rounded-lg flex items-center gap-2">
                      <Users size={14} className="text-blue-600" />
                      <div className="min-w-0">
                        <p className="text-xs text-blue-800 font-semibold truncate">{getEmpName(asset.assignedTo)}</p>
                        <p className="text-[10px] text-blue-600">Assigned {new Date(asset.assignedAt!).toLocaleDateString()}</p>
                      </div>
                    </div>
                  )}

                  {isAdmin && (
                    <div className="mt-5 flex items-center justify-between pt-4 border-t border-slate-100">
                      <button onClick={() => { setSelectedAsset(asset); setAssignForm({ employeeId: asset.assignedTo || '' }); setShowAssignModal(true); }} className="text-xs text-blue-600 font-semibold hover:underline">
                        {asset.assignedTo ? 'Reassign' : 'Assign'}
                      </button>
                      <div className="flex gap-2">
                        {asset.status === 'AVAILABLE' && <button onClick={() => handleMarkStatus(asset, 'MAINTENANCE')} className="text-xs text-amber-600 font-semibold hover:underline" title="Send to Maintenance"><Wrench size={14} /></button>}
                        {asset.status === 'MAINTENANCE' && <button onClick={() => handleMarkStatus(asset, 'AVAILABLE')} className="text-xs text-emerald-600 font-semibold hover:underline" title="Mark Available"><Check size={14} /></button>}
                        <button onClick={() => {
                          setForm({
                            name: asset.name, category: asset.category, serialNumber: asset.serialNumber || '',
                            condition: asset.condition || '', purchaseDate: asset.purchaseDate || '', purchaseCost: asset.purchaseCost ? String(asset.purchaseCost) : '', notes: asset.notes || ''
                          });
                          setSelectedAsset(asset);
                          setShowModal(true);
                        }} className="text-xs text-slate-400 hover:text-slate-600"><Edit2 size={14} /></button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Asset Modal */}
      {showModal && (
        <Modal title={selectedAsset ? "Edit Asset" : "Add Asset"} onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            <Field label="Asset Name" required>
              <input className={inputCls} placeholder="e.g. MacBook Pro M3" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>
            
            <div className="grid grid-cols-2 gap-3">
              <Field label="Category" required>
                <select className={selectCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Serial Number">
                <input className={inputCls} placeholder="SN-..." value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Purchase Date">
                <input type="date" className={inputCls} value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
              </Field>
              <Field label="Purchase Cost (₹)">
                <input type="number" className={inputCls} placeholder="0" value={form.purchaseCost} onChange={e => setForm({ ...form, purchaseCost: e.target.value })} />
              </Field>
            </div>

            <Field label="Condition">
              <select className={selectCls} value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                <option value="New">New</option>
                <option value="Good">Good</option>
                <option value="Fair">Fair</option>
                <option value="Poor">Poor</option>
              </select>
            </Field>

            <Field label="Notes">
              <textarea className={inputCls} rows={2} placeholder="Any additional details..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </Field>

            <button onClick={handleSubmit} disabled={isSaving} className="w-full mt-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {selectedAsset ? 'Update Asset' : 'Add Asset'}
            </button>
            {selectedAsset && (
              <button onClick={() => { setShowModal(false); handleDelete(selectedAsset.id); }} className="w-full py-2 text-red-600 text-sm font-semibold hover:underline">
                Delete Asset
              </button>
            )}
          </div>
        </Modal>
      )}

      {/* Assign Asset Modal */}
      {showAssignModal && selectedAsset && (
        <Modal title="Assign Asset" onClose={() => setShowAssignModal(false)}>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl mb-2">
              <h3 className="font-bold text-slate-800">{selectedAsset.name}</h3>
              <p className="text-xs text-slate-500">{selectedAsset.serialNumber || selectedAsset.category}</p>
            </div>
            <Field label="Assign To Employee">
              <select className={selectCls} value={assignForm.employeeId} onChange={e => setAssignForm({ employeeId: e.target.value })}>
                <option value="">Select an employee</option>
                <option value="UNASSIGN">-- Unassign Asset --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <button onClick={handleAssign} disabled={isSaving || !assignForm.employeeId} className="w-full mt-4 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Assignment
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Assets;
