import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Loader2, X, Trash2, Shield, Folder,
  FileCheck, UploadCloud, Users, Eye, Building2
} from 'lucide-react';
import { documentService } from '../services/document.service';
import { hrService } from '../services/hrService';
import { Document, User } from '../types';
import { useToast } from '../context/ToastContext';

interface DocumentsProps {
  user: User;
}

const CATEGORIES = ['Company Policy', 'Identity', 'Offer Letter', 'Contract', 'Certificate', 'Other'];

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

const Documents: React.FC<DocumentsProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR'].includes(user.role);

  const [companyDocs, setCompanyDocs] = useState<Document[]>([]);
  const [myDocs, setMyDocs] = useState<Document[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [empDocs, setEmpDocs] = useState<Record<string, Document[]>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'COMPANY' | 'PERSONAL' | 'EMPLOYEES'>('COMPANY');
  const [selectedEmp, setSelectedEmp] = useState<string>('');

  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    category: CATEGORIES[0],
    isCompanyDoc: false,
    targetEmployeeId: '',
    file: null as File | null
  });

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [cDocs, mDocs] = await Promise.all([
        documentService.getCompanyDocuments(),
        documentService.getMyDocuments(user.id),
      ]);
      setCompanyDocs(cDocs);
      setMyDocs(mDocs);

      if (isAdmin) {
        const emps = await hrService.getEmployees();
        setEmployees(emps);
      }
    } catch (e: any) {
      showToast(e.message || 'Failed to load documents', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, user.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadEmpDocs = async (empId: string) => {
    if (empDocs[empId]) return;
    try {
      const docs = await documentService.getEmployeeDocuments(empId);
      setEmpDocs(prev => ({ ...prev, [empId]: docs }));
    } catch (e: any) {
      showToast(e.message || 'Failed to load employee documents', 'error');
    }
  };

  useEffect(() => {
    if (activeTab === 'EMPLOYEES' && selectedEmp) {
      loadEmpDocs(selectedEmp);
    }
  }, [activeTab, selectedEmp]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setForm(prev => ({ ...prev, file, name: prev.name || file.name.split('.')[0] }));
    }
  };

  const handleUpload = async () => {
    if (!form.file) { showToast('Please select a file', 'warning'); return; }
    if (!form.name) { showToast('Document name is required', 'warning'); return; }
    
    let ownerId: string | null = user.id;
    if (isAdmin && form.isCompanyDoc) ownerId = null;
    if (isAdmin && !form.isCompanyDoc && form.targetEmployeeId) ownerId = form.targetEmployeeId;

    setIsSaving(true);
    try {
      const created = await documentService.uploadDocument(
        form.file,
        form.name,
        form.category,
        ownerId,
        user.id
      );
      
      if (ownerId === null) {
        setCompanyDocs(prev => [created, ...prev]);
        setActiveTab('COMPANY');
      } else if (ownerId === user.id) {
        setMyDocs(prev => [created, ...prev]);
        setActiveTab('PERSONAL');
      } else {
        setEmpDocs(prev => ({ ...prev, [ownerId!]: [created, ...(prev[ownerId!] || [])] }));
        setActiveTab('EMPLOYEES');
        setSelectedEmp(ownerId);
      }

      setShowModal(false);
      setForm({ name: '', category: CATEGORIES[0], isCompanyDoc: false, targetEmployeeId: '', file: null });
      showToast('Document uploaded successfully', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to upload document', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (doc: Document, type: 'COMPANY' | 'PERSONAL' | 'EMPLOYEE') => {
    if (!confirm(`Delete document "${doc.name}"?`)) return;
    try {
      await documentService.deleteDocument(doc.id);
      if (type === 'COMPANY') setCompanyDocs(prev => prev.filter(d => d.id !== doc.id));
      else if (type === 'PERSONAL') setMyDocs(prev => prev.filter(d => d.id !== doc.id));
      else if (type === 'EMPLOYEE' && doc.ownerId) {
        const oid = doc.ownerId;
        setEmpDocs(prev => ({ ...prev, [oid]: (prev[oid] || []).filter(d => d.id !== doc.id) }));
      }
      showToast('Document deleted', 'success');
    } catch (e: any) {
      showToast(e.message || 'Failed to delete', 'error');
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const DocumentCard = ({ doc, type }: { doc: Document, type: 'COMPANY' | 'PERSONAL' | 'EMPLOYEE' }) => (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow flex flex-col h-full">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
          <FileText size={24} />
        </div>
        <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded-full">{doc.category}</span>
      </div>
      <h3 className="font-bold text-slate-900 line-clamp-1 mb-1" title={doc.name}>{doc.name}</h3>
      <p className="text-xs text-slate-500 mb-4">{formatSize(doc.sizeBytes)} · {new Date(doc.created!).toLocaleDateString()}</p>
      
      <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
        <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <Eye size={16} /> View
        </a>
        {(isAdmin || doc.ownerId === user.id) && (
          <button onClick={() => handleDelete(doc, type)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Folder className="text-primary" size={24} />
            Documents
          </h1>
          <p className="text-slate-500 text-sm mt-1">Manage company policies and employee files</p>
        </div>
        <button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95">
          <UploadCloud size={16} /> Upload
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {(isAdmin ? ['COMPANY', 'PERSONAL', 'EMPLOYEES'] : ['COMPANY', 'PERSONAL']).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-colors whitespace-nowrap relative ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab === 'COMPANY' && <Building2 size={14} className="hidden" />}
            {tab === 'COMPANY' && <Shield size={14} />}
            {tab === 'PERSONAL' && <FileCheck size={14} />}
            {tab === 'EMPLOYEES' && <Users size={14} />}
            {tab === 'COMPANY' ? 'Company Policies' : tab === 'PERSONAL' ? 'My Documents' : 'Employee Files'}
            {activeTab === tab && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <div className="space-y-4">
          
          {/* COMPANY TAB */}
          {activeTab === 'COMPANY' && (
            companyDocs.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <Shield size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No company documents found</p>
                {isAdmin && <p className="text-sm mt-1">Upload employee handbooks or policies here.</p>}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {companyDocs.map(doc => <DocumentCard key={doc.id} doc={doc} type="COMPANY" />)}
              </div>
            )
          )}

          {/* PERSONAL TAB */}
          {activeTab === 'PERSONAL' && (
            myDocs.length === 0 ? (
              <div className="text-center py-16 text-slate-400">
                <FileCheck size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">You haven't uploaded any documents</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {myDocs.map(doc => <DocumentCard key={doc.id} doc={doc} type="PERSONAL" />)}
              </div>
            )
          )}

          {/* EMPLOYEES TAB (Admin only) */}
          {activeTab === 'EMPLOYEES' && isAdmin && (
            <div className="space-y-6">
              <div className="max-w-md">
                <Field label="Select Employee">
                  <select className={selectCls} value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)}>
                    <option value="">-- Choose an employee --</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </Field>
              </div>

              {selectedEmp && (
                !empDocs[selectedEmp] ? (
                  <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={24} /></div>
                ) : empDocs[selectedEmp].length === 0 ? (
                  <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <Folder size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No documents found for this employee</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {empDocs[selectedEmp].map(doc => <DocumentCard key={doc.id} doc={doc} type="EMPLOYEE" />)}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <Modal title="Upload Document" onClose={() => setShowModal(false)}>
          <div className="space-y-4">
            
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
              <UploadCloud size={32} className="mx-auto text-primary mb-3" />
              {form.file ? (
                <div>
                  <p className="font-bold text-slate-800">{form.file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">{formatSize(form.file.size)}</p>
                </div>
              ) : (
                <div>
                  <p className="font-bold text-slate-700">Click to browse files</p>
                  <p className="text-xs text-slate-500 mt-1">PDF, DOCX, JPG, PNG (Max 10MB)</p>
                </div>
              )}
            </div>

            <Field label="Document Name" required>
              <input className={inputCls} placeholder="e.g. Employee Handbook 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </Field>

            <Field label="Category" required>
              <select className={selectCls} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>

            {isAdmin && (
              <div className="bg-slate-50 p-4 rounded-xl space-y-3 border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Visibility & Ownership</p>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isCompanyDoc} onChange={e => setForm({ ...form, isCompanyDoc: e.target.checked, targetEmployeeId: '' })} className="w-4 h-4 accent-primary" />
                  <span className="text-sm font-semibold text-slate-800 flex items-center gap-1.5"><Shield size={14} className="text-blue-500" /> Company-wide Document</span>
                </label>
                
                {!form.isCompanyDoc && (
                  <Field label="Assign to Employee (Optional)">
                    <select className={selectCls} value={form.targetEmployeeId} onChange={e => setForm({ ...form, targetEmployeeId: e.target.value })}>
                      <option value="">-- Myself (Personal Document) --</option>
                      {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </Field>
                )}
                
                <p className="text-xs text-slate-500">
                  {form.isCompanyDoc ? 'Visible to ALL employees.' : form.targetEmployeeId ? 'Visible only to admins and the selected employee.' : 'Visible only to admins and you.'}
                </p>
              </div>
            )}

            <button onClick={handleUpload} disabled={isSaving || !form.file} className="w-full mt-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-60">
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
              Upload Document
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
};

export default Documents;
