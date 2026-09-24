import { supabase } from './supabase';
import { Project, Task, Timesheet, Client } from '../types';
import { resolveOrgId } from './api.client';

// Helper to map snake_case Supabase rows to camelCase types
const mapClient = (r: any): Client => ({
  id: r.id,
  name: r.name,
  contactPerson: r.contact_person,
  email: r.email,
  phone: r.phone,
  address: r.address,
  status: r.status,
  organizationId: r.organization_id,
});

const mapProject = (r: any): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  clientId: r.client_id,
  startDate: r.start_date,
  endDate: r.end_date,
  status: r.status,
  managerId: r.manager_id,
  budget: r.budget,
  organizationId: r.organization_id,
  created: r.created,
  updated: r.updated,
} as any);

const mapTask = (r: any): Task => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  description: r.description,
  assignedTo: r.assigned_to,
  status: r.status,
  priority: r.priority,
  dueDate: r.due_date,
  organizationId: r.organization_id,
  created: r.created,
  updated: r.updated,
} as any);

const mapTimesheet = (r: any): Timesheet => ({
  id: r.id,
  employeeId: r.employee_id,
  projectId: r.project_id,
  taskId: r.task_id,
  date: r.date,
  hours: r.hours,
  description: r.description,
  status: r.status,
  organizationId: r.organization_id,
  created: r.created,
  updated: r.updated,
} as any);

export const projectService = {
  // ── Clients ────────────────────────────────────────────────
  getClients: async (): Promise<Client[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', id)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapClient);
  },

  createClient: async (payload: Omit<Client, 'id' | 'organizationId'>): Promise<Client> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: payload.name,
        contact_person: payload.contactPerson,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        status: payload.status || 'ACTIVE',
        organization_id: id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapClient(data);
  },

  updateClient: async (clientId: string, payload: Partial<Client>): Promise<void> => {
    const { error } = await supabase
      .from('clients')
      .update({
        name: payload.name,
        contact_person: payload.contactPerson,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        status: payload.status,
        updated: new Date().toISOString(),
      })
      .eq('id', clientId);
    if (error) throw error;
  },

  deleteClient: async (clientId: string): Promise<void> => {
    const { error } = await supabase.from('clients').delete().eq('id', clientId);
    if (error) throw error;
  },

  // ── Projects ───────────────────────────────────────────────
  getProjects: async (): Promise<Project[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('organization_id', id)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapProject);
  },

  createProject: async (payload: Omit<Project, 'id' | 'organizationId'>): Promise<Project> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: payload.name,
        description: payload.description,
        client_id: payload.clientId || null,
        start_date: payload.startDate || null,
        end_date: payload.endDate || null,
        status: payload.status || 'PLANNING',
        manager_id: payload.managerId || null,
        budget: payload.budget || null,
        organization_id: id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapProject(data);
  },

  updateProject: async (projectId: string, payload: Partial<Project>): Promise<void> => {
    const { error } = await supabase
      .from('projects')
      .update({
        name: payload.name,
        description: payload.description,
        client_id: payload.clientId,
        start_date: payload.startDate,
        end_date: payload.endDate,
        status: payload.status,
        manager_id: payload.managerId,
        budget: payload.budget,
        updated: new Date().toISOString(),
      })
      .eq('id', projectId);
    if (error) throw error;
  },

  deleteProject: async (projectId: string): Promise<void> => {
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw error;
  },

  // ── Tasks ──────────────────────────────────────────────────
  getAllTasks: async (): Promise<Task[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', id)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  getTasksByProject: async (projectId: string): Promise<Task[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('organization_id', id)
      .eq('project_id', projectId)
      .order('priority');
    if (error) throw error;
    return (data || []).map(mapTask);
  },

  createTask: async (payload: Omit<Task, 'id' | 'organizationId'>): Promise<Task> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: payload.projectId,
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assignedTo || null,
        status: payload.status || 'TODO',
        priority: payload.priority || 'MEDIUM',
        due_date: payload.dueDate || null,
        organization_id: id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapTask(data);
  },

  updateTask: async (taskId: string, payload: Partial<Task>): Promise<void> => {
    const { error } = await supabase
      .from('tasks')
      .update({
        title: payload.title,
        description: payload.description,
        assigned_to: payload.assignedTo,
        status: payload.status,
        priority: payload.priority,
        due_date: payload.dueDate,
        updated: new Date().toISOString(),
      })
      .eq('id', taskId);
    if (error) throw error;
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);
    if (error) throw error;
  },

  // ── Timesheets ─────────────────────────────────────────────
  getMyTimesheets: async (employeeId: string): Promise<Timesheet[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('organization_id', id)
      .eq('employee_id', employeeId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTimesheet);
  },

  getAllTimesheets: async (): Promise<Timesheet[]> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('timesheets')
      .select('*')
      .eq('organization_id', id)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapTimesheet);
  },

  logTime: async (payload: Omit<Timesheet, 'id' | 'organizationId'>): Promise<Timesheet> => {
    const id = await resolveOrgId();
    const { data, error } = await supabase
      .from('timesheets')
      .insert({
        employee_id: payload.employeeId,
        project_id: payload.projectId,
        task_id: payload.taskId || null,
        date: payload.date,
        hours: payload.hours,
        description: payload.description,
        status: payload.status || 'SUBMITTED',
        organization_id: id,
      })
      .select()
      .single();
    if (error) throw error;
    return mapTimesheet(data);
  },

  updateTimesheetStatus: async (timesheetId: string, status: Timesheet['status']): Promise<void> => {
    const { error } = await supabase
      .from('timesheets')
      .update({ status, updated: new Date().toISOString() })
      .eq('id', timesheetId);
    if (error) throw error;
  },

  deleteTimesheet: async (timesheetId: string): Promise<void> => {
    const { error } = await supabase.from('timesheets').delete().eq('id', timesheetId);
    if (error) throw error;
  },
};
