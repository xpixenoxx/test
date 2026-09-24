import React, { useState, useEffect, useCallback } from 'react';
import {
  Briefcase, CheckSquare, Clock, Plus, Loader2, X, ChevronRight,
  Calendar, DollarSign, Trash2, AlertCircle,
  CheckCircle2, Circle, Timer, Building2,
  Edit2, Save
} from 'lucide-react';
import { projectService } from '../services/project.service';
import { Project, Task, Timesheet, Client, Employee, User } from '../types';
import { useToast } from '../context/ToastContext';
import { hrService } from '../services/hrService';

interface ProjectsProps {
  user: User;
}

// ─── Status Helpers ───────────────────────────────────────────────────────────

const PROJECT_STATUS_COLORS: Record<Project['status'], string> = {
  PLANNING:  'bg-slate-100 text-slate-600',
  ACTIVE:    'bg-emerald-100 text-emerald-700',
  ON_HOLD:   'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-blue-100 text-blue-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  LOW:    'bg-slate-100 text-slate-500',
  MEDIUM: 'bg-blue-100 text-blue-600',
  HIGH:   'bg-amber-100 text-amber-700',
  URGENT: 'bg-red-100 text-red-700',
};

const TASK_STATUS_ICONS: Record<Task['status'], React.ReactNode> = {
  TODO:        <Circle size={14} className="text-slate-400" />,
  IN_PROGRESS: <Timer size={14} className="text-blue-500" />,
  IN_REVIEW:   <AlertCircle size={14} className="text-amber-500" />,
  DONE:        <CheckCircle2 size={14} className="text-emerald-500" />,
};

// ─── Modal ───────────────────────────────────────────────────────────────────

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between p-6 border-b border-slate-100">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors">
          <X size={18} className="text-slate-500" />
        </button>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  </div>
);

const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <div className="space-y-1.5">
    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
  </div>
);

const inputCls = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all';
const selectCls = `${inputCls} cursor-pointer`;

// ─── Main Page ───────────────────────────────────────────────────────────────

const Projects: React.FC<ProjectsProps> = ({ user }) => {
  const { showToast } = useToast();
  const isAdmin = ['ADMIN', 'HR', 'MANAGER'].includes(user.role);

  // ── Data ──
  const [projects, setProjects]       = useState<Project[]>([]);
  const [clients, setClients]         = useState<Client[]>([]);
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [timesheets, setTimesheets]   = useState<Timesheet[]>([]);
  const [employees, setEmployees]     = useState<Employee[]>([]);

  // ── View state ──
  const [activeTab, setActiveTab]           = useState<'PROJECTS' | 'TASKS' | 'TIMESHEETS'>('PROJECTS');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const [isSaving, setIsSaving]             = useState(false);

  // ── Modals ──
  const [showProjectModal, setShowProjectModal]   = useState(false);
  const [showClientModal, setShowClientModal]     = useState(false);
  const [showTaskModal, setShowTaskModal]         = useState(false);
  const [showTimesheetModal, setShowTimesheetModal] = useState(false);
  const [editingProject, setEditingProject]       = useState<Project | null>(null);

  // ── Forms ──
  const emptyProject = { name: '', description: '', clientId: '', startDate: '', endDate: '', status: 'PLANNING' as Project['status'], budget: '' };
  const emptyClient  = { name: '', contactPerson: '', email: '', phone: '', address: '' };
  const emptyTask    = { title: '', description: '', projectId: '', assignedTo: '', priority: 'MEDIUM' as Task['priority'], dueDate: '' };
  const emptyTs      = { projectId: '', taskId: '', date: new Date().toISOString().split('T')[0], hours: '', description: '' };

  const [projectForm, setProjectForm] = useState(emptyProject);
  const [clientForm, setClientForm]   = useState(emptyClient);
  const [taskForm, setTaskForm]       = useState(emptyTask);
  const [tsForm, setTsForm]           = useState(emptyTs);

  // ── Load data ──
  const loadBase = useCallback(async () => {
    setIsLoading(true);
    try {
      const [p, c, e] = await Promise.all([
        projectService.getProjects(),
        projectService.getClients(),
        hrService.getEmployees(),
      ]);
      setProjects(p);
      setClients(c);
      setEmployees(e);
    } catch { showToast('Failed to load projects', 'error'); }
    finally { setIsLoading(false); }
  }, []);

  const loadTasks = useCallback(async (projectId?: string) => {
    setIsLoading(true);
    try {
      const data = projectId
        ? await projectService.getTasksByProject(projectId)
        : await projectService.getAllTasks();
      setTasks(data);
    } catch { showToast('Failed to load tasks', 'error'); }
    finally { setIsLoading(false); }
  }, []);

  const loadTimesheets = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = isAdmin
        ? await projectService.getAllTimesheets()
        : await projectService.getMyTimesheets(user.id);
      setTimesheets(data);
    } catch { showToast('Failed to load timesheets', 'error'); }
    finally { setIsLoading(false); }
  }, [isAdmin, user.id]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => {
    if (activeTab === 'TASKS') loadTasks(selectedProject?.id);
    if (activeTab === 'TIMESHEETS') loadTimesheets();
  }, [activeTab, selectedProject]);

  // ── Project actions ──
  const handleSaveProject = async () => {
    if (!projectForm.name.trim()) { showToast('Project name is required', 'warning'); return; }
    setIsSaving(true);
    try {
      if (editingProject) {
        await projectService.updateProject(editingProject.id, {
          ...projectForm, budget: projectForm.budget ? Number(projectForm.budget) : undefined,
        });
        showToast('Project updated', 'success');
      } else {
        await projectService.createProject({
          name: projectForm.name,
          description: projectForm.description,
          clientId: projectForm.clientId || undefined,
          startDate: projectForm.startDate || undefined,
          endDate: projectForm.endDate || undefined,
          status: projectForm.status,
          budget: projectForm.budget ? Number(projectForm.budget) : undefined,
        });
        showToast('Project created', 'success');
      }
      setShowProjectModal(false);
      setEditingProject(null);
      setProjectForm(emptyProject);
      await loadBase();
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Delete this project? All tasks and timesheets will also be deleted.')) return;
    try {
      await projectService.deleteProject(id);
      showToast('Project deleted', 'success');
      if (selectedProject?.id === id) setSelectedProject(null);
      await loadBase();
    } catch (e: any) { showToast(e.message || 'Failed to delete', 'error'); }
  };

  // ── Client actions ──
  const handleSaveClient = async () => {
    if (!clientForm.name.trim()) { showToast('Client name is required', 'warning'); return; }
    setIsSaving(true);
    try {
      await projectService.createClient({ ...clientForm, status: 'ACTIVE' });
      showToast('Client added', 'success');
      setShowClientModal(false);
      setClientForm(emptyClient);
      const c = await projectService.getClients();
      setClients(c);
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    finally { setIsSaving(false); }
  };

  // ── Task actions ──
  const handleSaveTask = async () => {
    if (!taskForm.title.trim()) { showToast('Task title is required', 'warning'); return; }
    if (!taskForm.projectId) { showToast('Please select a project', 'warning'); return; }
    setIsSaving(true);
    try {
      await projectService.createTask({
        title: taskForm.title,
        description: taskForm.description,
        projectId: taskForm.projectId,
        assignedTo: taskForm.assignedTo || undefined,
        priority: taskForm.priority,
        dueDate: taskForm.dueDate || undefined,
        status: 'TODO',
      });
      showToast('Task created', 'success');
      setShowTaskModal(false);
      setTaskForm(emptyTask);
      await loadTasks(selectedProject?.id);
    } catch (e: any) { showToast(e.message || 'Failed to save', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleUpdateTaskStatus = async (taskId: string, status: Task['status']) => {
    try {
      await projectService.updateTask(taskId, { status });
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } catch { showToast('Failed to update task', 'error'); }
  };

  // ── Timesheet actions ──
  const handleLogTime = async () => {
    if (!tsForm.projectId) { showToast('Please select a project', 'warning'); return; }
    if (!tsForm.hours || Number(tsForm.hours) <= 0) { showToast('Hours must be greater than 0', 'warning'); return; }
    setIsSaving(true);
    try {
      await projectService.logTime({
        employeeId: user.id,
        projectId: tsForm.projectId,
        taskId: tsForm.taskId || undefined,
        date: tsForm.date,
        hours: Number(tsForm.hours),
        description: tsForm.description,
        status: 'SUBMITTED',
      });
      showToast('Time logged', 'success');
      setShowTimesheetModal(false);
      setTsForm(emptyTs);
      await loadTimesheets();
    } catch (e: any) { showToast(e.message || 'Failed to log time', 'error'); }
    finally { setIsSaving(false); }
  };

  const handleApproveTimesheet = async (id: string) => {
    try {
      await projectService.updateTimesheetStatus(id, 'APPROVED');
      setTimesheets(prev => prev.map(t => t.id === id ? { ...t, status: 'APPROVED' } : t));
      showToast('Timesheet approved', 'success');
    } catch { showToast('Failed to approve', 'error'); }
  };

  // ── Tasks for selected project in timesheet modal ──
  const tsProjectTasks = tasks.filter(t => t.projectId === tsForm.projectId);

  const getProjectName = (id: string) => projects.find(p => p.id === id)?.name || id;
  const getClientName = (id?: string) => clients.find(c => c.id === id)?.name || '—';
  const getEmployeeName = (id?: string) => employees.find(e => e.id === id)?.name || '—';

  const totalHours = timesheets.reduce((sum, t) => sum + (t.hours || 0), 0);

  // ──────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Briefcase className="text-primary" size={24} />
            Project Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {projects.length} project{projects.length !== 1 ? 's' : ''} · {clients.length} client{clients.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => { setShowClientModal(true); setClientForm(emptyClient); }} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
              <Building2 size={15} /> Client
            </button>
            <button onClick={() => { setShowProjectModal(true); setEditingProject(null); setProjectForm(emptyProject); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm shadow-primary/20 transition-all active:scale-95">
              <Plus size={16} /> New Project
            </button>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {(['PROJECTS', 'TASKS', 'TIMESHEETS'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); }}
            className={`flex items-center gap-2 px-5 py-3 font-semibold text-sm transition-colors whitespace-nowrap relative ${activeTab === tab ? 'text-primary' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab === 'PROJECTS' && <Briefcase size={15} />}
            {tab === 'TASKS' && <CheckSquare size={15} />}
            {tab === 'TIMESHEETS' && <Clock size={15} />}
            {tab === 'PROJECTS' ? 'Projects' : tab === 'TASKS' ? 'Tasks' : 'Timesheets'}
            {activeTab === tab && <div className="absolute bottom-0 inset-x-0 h-0.5 bg-primary rounded-t-full" />}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={32} /></div>
      ) : (
        <>
          {/* ── Projects Tab ── */}
          {activeTab === 'PROJECTS' && (
            <div>
              {projects.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Briefcase size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No projects yet</p>
                  {isAdmin && <p className="text-sm mt-1">Create your first project to get started.</p>}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {projects.map(p => (
                    <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-all group">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-900 text-base truncate">{p.name}</h3>
                          {p.clientId && <p className="text-xs text-primary font-medium mt-0.5">{getClientName(p.clientId)}</p>}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingProject(p); setProjectForm({ name: p.name, description: p.description || '', clientId: p.clientId || '', startDate: p.startDate || '', endDate: p.endDate || '', status: p.status, budget: p.budget?.toString() || '' }); setShowProjectModal(true); }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100">
                              <Edit2 size={13} className="text-slate-500" />
                            </button>
                            <button onClick={() => handleDeleteProject(p.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50">
                              <Trash2 size={13} className="text-red-400" />
                            </button>
                          </div>
                        )}
                      </div>
                      {p.description && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{p.description}</p>}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-50">
                        <span className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${PROJECT_STATUS_COLORS[p.status]}`}>
                          {p.status.replace('_', ' ')}
                        </span>
                        <div className="flex items-center gap-2">
                          {p.budget && (
                            <span className="text-xs text-slate-400 flex items-center gap-0.5">
                              <DollarSign size={11} />₹{Number(p.budget).toLocaleString('en-IN')}
                            </span>
                          )}
                          <button
                            onClick={() => { setSelectedProject(p); setActiveTab('TASKS'); }}
                            className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline"
                          >
                            View Tasks <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tasks Tab ── */}
          {activeTab === 'TASKS' && (
            <div className="space-y-4">
              {/* Project filter bar */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setSelectedProject(null); loadTasks(); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${!selectedProject ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  All Projects
                </button>
                {projects.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProject(p); loadTasks(p.id); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${selectedProject?.id === p.id ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    {p.name}
                  </button>
                ))}
                {isAdmin && (
                  <button
                    onClick={() => { setShowTaskModal(true); setTaskForm({ ...emptyTask, projectId: selectedProject?.id || '' }); }}
                    className="ml-auto flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
                  >
                    <Plus size={14} /> New Task
                  </button>
                )}
              </div>

              {tasks.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CheckSquare size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No tasks found</p>
                  {isAdmin && <p className="text-sm mt-1">Create a task in a project to track work.</p>}
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  {/* Kanban-style columns for smaller sets */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-100">
                    {(['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as Task['status'][]).map(status => {
                      const colTasks = tasks.filter(t => t.status === status);
                      const colLabel = status.replace('_', ' ');
                      return (
                        <div key={status} className="bg-white p-4">
                          <div className="flex items-center gap-2 mb-3">
                            {TASK_STATUS_ICONS[status]}
                            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{colLabel}</span>
                            <span className="ml-auto text-xs bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
                          </div>
                          <div className="space-y-2">
                            {colTasks.map(task => (
                              <div key={task.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-primary/30 hover:bg-white transition-all cursor-pointer group">
                                <p className="text-sm font-semibold text-slate-800 leading-tight">{task.title}</p>
                                {task.description && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>}
                                <div className="flex items-center justify-between mt-2.5">
                                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase ${PRIORITY_COLORS[task.priority]}`}>
                                    {task.priority}
                                  </span>
                                  {task.dueDate && (
                                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                      <Calendar size={10} />{new Date(task.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                    </span>
                                  )}
                                </div>
                                {task.assignedTo && (
                                  <p className="text-[10px] text-slate-400 mt-1.5 truncate">
                                    👤 {getEmployeeName(task.assignedTo)}
                                  </p>
                                )}
                                {/* Quick status advance */}
                                {status !== 'DONE' && (
                                  <button
                                    onClick={() => {
                                      const next: Task['status'][] = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'];
                                      const idx = next.indexOf(status);
                                      handleUpdateTaskStatus(task.id, next[idx + 1]);
                                    }}
                                    className="mt-2 text-[10px] text-primary font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    → Move to {status === 'TODO' ? 'In Progress' : status === 'IN_PROGRESS' ? 'In Review' : 'Done'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Timesheets Tab ── */}
          {activeTab === 'TIMESHEETS' && (
            <div className="space-y-4">
              {/* Stats bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Hours', val: `${totalHours.toFixed(1)}h`, color: 'text-primary' },
                  { label: 'Entries', val: timesheets.length, color: 'text-slate-700' },
                  { label: 'Approved', val: timesheets.filter(t => t.status === 'APPROVED').length, color: 'text-emerald-600' },
                  { label: 'Pending', val: timesheets.filter(t => t.status === 'SUBMITTED').length, color: 'text-amber-600' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{s.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => { setShowTimesheetModal(true); setTsForm(emptyTs); }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-semibold shadow-sm transition-all active:scale-95"
                >
                  <Plus size={14} /> Log Time
                </button>
              </div>

              {timesheets.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Clock size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No timesheets logged yet</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Project</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Description</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Hours</th>
                        <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        {isAdmin && <th className="px-5 py-3.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Action</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {timesheets.map(t => (
                        <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                          <td className="px-5 py-3.5 font-medium text-slate-700">{new Date(t.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                          <td className="px-5 py-3.5 text-slate-600">{getProjectName(t.projectId)}</td>
                          <td className="px-5 py-3.5 text-slate-500 text-xs hidden md:table-cell max-w-[200px] truncate">{t.description || '—'}</td>
                          <td className="px-5 py-3.5 font-bold text-slate-800">{t.hours}h</td>
                          <td className="px-5 py-3.5">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${
                              t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                              t.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                              t.status === 'SUBMITTED' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>{t.status}</span>
                          </td>
                          {isAdmin && (
                            <td className="px-5 py-3.5">
                              {t.status === 'SUBMITTED' && (
                                <button onClick={() => handleApproveTimesheet(t.id)} className="text-xs text-emerald-600 font-semibold hover:underline flex items-center gap-1">
                                  <CheckCircle2 size={13} /> Approve
                                </button>
                              )}
                            </td>
                          )}
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

      {/* Project Modal */}
      {showProjectModal && (
        <Modal title={editingProject ? 'Edit Project' : 'New Project'} onClose={() => { setShowProjectModal(false); setEditingProject(null); }}>
          <Field label="Project Name" required>
            <input className={inputCls} placeholder="e.g. Pixenox Website Redesign" value={projectForm.name} onChange={e => setProjectForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={3} placeholder="Brief description..." value={projectForm.description} onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Client">
              <select className={selectCls} value={projectForm.clientId} onChange={e => setProjectForm(f => ({ ...f, clientId: e.target.value }))}>
                <option value="">No Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className={selectCls} value={projectForm.status} onChange={e => setProjectForm(f => ({ ...f, status: e.target.value as Project['status'] }))}>
                {(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start Date"><input type="date" className={inputCls} value={projectForm.startDate} onChange={e => setProjectForm(f => ({ ...f, startDate: e.target.value }))} /></Field>
            <Field label="End Date"><input type="date" className={inputCls} value={projectForm.endDate} onChange={e => setProjectForm(f => ({ ...f, endDate: e.target.value }))} /></Field>
          </div>
          <Field label="Budget (₹)">
            <input type="number" className={inputCls} placeholder="0" value={projectForm.budget} onChange={e => setProjectForm(f => ({ ...f, budget: e.target.value }))} />
          </Field>
          <button
            onClick={handleSaveProject}
            disabled={isSaving}
            className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {editingProject ? 'Save Changes' : 'Create Project'}
          </button>
        </Modal>
      )}

      {/* Client Modal */}
      {showClientModal && (
        <Modal title="Add Client" onClose={() => setShowClientModal(false)}>
          <Field label="Company / Client Name" required>
            <input className={inputCls} placeholder="e.g. Acme Corp" value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Contact Person">
            <input className={inputCls} placeholder="Full name" value={clientForm.contactPerson} onChange={e => setClientForm(f => ({ ...f, contactPerson: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email"><input type="email" className={inputCls} placeholder="email@example.com" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))} /></Field>
            <Field label="Phone"><input className={inputCls} placeholder="+91 000 0000000" value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))} /></Field>
          </div>
          <Field label="Address">
            <input className={inputCls} placeholder="City, Country" value={clientForm.address} onChange={e => setClientForm(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <button onClick={handleSaveClient} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Add Client
          </button>
        </Modal>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <Modal title="Create Task" onClose={() => setShowTaskModal(false)}>
          <Field label="Task Title" required>
            <input className={inputCls} placeholder="What needs to be done?" value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Description">
            <textarea className={inputCls} rows={2} placeholder="More details..." value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" required>
              <select className={selectCls} value={taskForm.projectId} onChange={e => setTaskForm(f => ({ ...f, projectId: e.target.value }))}>
                <option value="">Select project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select className={selectCls} value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value as Task['priority'] }))}>
                {(['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Assign To">
              <select className={selectCls} value={taskForm.assignedTo} onChange={e => setTaskForm(f => ({ ...f, assignedTo: e.target.value }))}>
                <option value="">Unassigned</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </Field>
            <Field label="Due Date"><input type="date" className={inputCls} value={taskForm.dueDate} onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))} /></Field>
          </div>
          <button onClick={handleSaveTask} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Create Task
          </button>
        </Modal>
      )}

      {/* Timesheet Modal */}
      {showTimesheetModal && (
        <Modal title="Log Time" onClose={() => setShowTimesheetModal(false)}>
          <Field label="Date" required>
            <input type="date" className={inputCls} value={tsForm.date} onChange={e => setTsForm(f => ({ ...f, date: e.target.value }))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Project" required>
              <select className={selectCls} value={tsForm.projectId} onChange={e => setTsForm(f => ({ ...f, projectId: e.target.value, taskId: '' }))}>
                <option value="">Select project</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </Field>
            <Field label="Hours Worked" required>
              <input type="number" min="0.5" max="24" step="0.5" className={inputCls} placeholder="e.g. 6" value={tsForm.hours} onChange={e => setTsForm(f => ({ ...f, hours: e.target.value }))} />
            </Field>
          </div>
          {tsProjectTasks.length > 0 && (
            <Field label="Task (optional)">
              <select className={selectCls} value={tsForm.taskId} onChange={e => setTsForm(f => ({ ...f, taskId: e.target.value }))}>
                <option value="">No specific task</option>
                {tsProjectTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </Field>
          )}
          <Field label="Description">
            <textarea className={inputCls} rows={3} placeholder="What did you work on?" value={tsForm.description} onChange={e => setTsForm(f => ({ ...f, description: e.target.value }))} />
          </Field>
          <button onClick={handleLogTime} disabled={isSaving} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary-hover transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
            Submit Timesheet
          </button>
        </Modal>
      )}

    </div>
  );
};

export default Projects;
