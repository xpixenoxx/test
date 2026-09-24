
import { supabase, isSupabaseConfigured, getSupabaseStorageUrl } from './supabase';
import { apiClient, dedupe, resolveOrgId } from './api.client';
import { Employee } from '../types';

let cachedEmployees: Employee[] | null = null;
let empCacheTimestamp = 0;
const EMP_CACHE_TTL = 2 * 60 * 1000;

const SUPABASE_FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : null;

function mapProfileToEmployee(r: any): Employee {
  return {
    id: r.id,
    employeeId: r.employee_id || '',
    lineManagerId: r.line_manager_id || undefined,
    teamId: r.team_id || undefined,
    shiftId: r.shift_id || undefined,
    organizationId: r.organization_id,
    name: r.name || 'No Name',
    email: r.email || r.work_email || '',
    role: (r.role || 'EMPLOYEE').toUpperCase(),
    department: r.department || 'Unassigned',
    designation: r.designation || 'Staff',
    avatar: r.avatar ? getSupabaseStorageUrl('avatars', r.avatar) : undefined,
    joiningDate: r.joining_date || '',
    mobile: r.mobile || '',
    emergencyContact: r.emergency_contact || '',
    salary: r.salary || 0,
    status: r.status || 'ACTIVE',
    employmentType: r.employment_type || 'PERMANENT',
    location: r.location || '',
    workType: r.work_type || 'OFFICE',
    verified: !!r.verified,
  } as any;
}

export const employeeService = {
  clearCache() {
    cachedEmployees = null;
    empCacheTimestamp = 0;
  },

  async getEmployees(): Promise<Employee[]> {
    if (cachedEmployees && Date.now() - empCacheTimestamp < EMP_CACHE_TTL) return cachedEmployees;

    const orgId = await resolveOrgId();
    return dedupe(`employees:${orgId ?? 'none'}`, async () => {
      if (!isSupabaseConfigured()) {
        console.warn('[EmployeeService] Supabase not configured');
        return [];
      }
      try {
        let query = supabase
          .from('profiles')
          .select('*')
          .order('created', { ascending: false });

        if (orgId) query = query.eq('organization_id', orgId);

        const { data, error } = await query;
        if (error) throw error;

        console.log(`[EmployeeService] Fetched ${data?.length ?? 0} employees`);
        const result = (data ?? []).map(mapProfileToEmployee);
        cachedEmployees = result;
        empCacheTimestamp = Date.now();
        return result;
      } catch (e: any) {
        console.error('[EmployeeService] Failed to fetch employees:', e?.message || e);
        return [];
      }
    });
  },

  async addEmployee(emp: Partial<Employee>) {
    if (!isSupabaseConfigured()) throw new Error('System offline');

    const password = (emp as any).password;
    if (!password) throw new Error('Password is required');
    if (!emp.email) throw new Error('Email is required');
    if (!emp.name) throw new Error('Name is required');

    // Call the SECURITY DEFINER RPC — runs as DB superuser so it can create
    // auth.users directly without affecting the current admin session.
    const { data, error } = await supabase.rpc('admin_create_employee', {
      p_email: emp.email,
      p_password: password,
      p_name: emp.name,
      p_role: (emp.role || 'EMPLOYEE').toUpperCase(),
      p_department: emp.department || 'Unassigned',
      p_designation: emp.designation || 'Staff',
      p_employee_id: emp.employeeId || null,
      p_mobile: emp.mobile || null,
      p_joining_date: emp.joiningDate || new Date().toISOString().split('T')[0],
      p_line_manager_id: emp.lineManagerId || null,
      p_team_id: emp.teamId || null,
      p_shift_id: emp.shiftId || null,
      p_employment_type: emp.employmentType || 'PERMANENT',
      p_work_type: emp.workType || 'OFFICE',
    });

    if (error) throw new Error(error.message);
    if (data && !data.success) throw new Error(data.error || 'Failed to create employee');

    const userId = data?.userId;

    // Upload avatar if provided (separate step, non-blocking)
    if (userId && emp.avatar && typeof emp.avatar === 'string' && emp.avatar.startsWith('data:')) {
      try {
        const blob = await (await fetch(emp.avatar)).blob();
        const path = `${userId}/avatar.webp`;
        await supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: 'image/webp' });
        // Update profile with avatar path
        await supabase.from('profiles').update({ avatar: path }).eq('id', userId);
      } catch (e) {
        console.warn('[EmployeeService] Avatar upload failed (non-fatal):', e);
      }
    }

    employeeService.clearCache();
    apiClient.notify();
  },

  async updateProfile(id: string, updates: Partial<Employee> | any) {
    if (!isSupabaseConfigured()) return;

    const payload: any = {};
    if (updates.name !== undefined)        payload.name = updates.name;
    if (updates.role !== undefined)        payload.role = updates.role.toUpperCase();
    if (updates.department !== undefined)  payload.department = updates.department;
    if (updates.designation !== undefined) payload.designation = updates.designation;
    if (updates.employeeId !== undefined)  payload.employee_id = updates.employeeId;
    if (updates.mobile !== undefined)      payload.mobile = updates.mobile;
    if (updates.joiningDate !== undefined) payload.joining_date = updates.joiningDate;
    if (updates.employmentType !== undefined) payload.employment_type = updates.employmentType;
    if (updates.workType !== undefined)    payload.work_type = updates.workType;
    if (updates.salary !== undefined)      payload.salary = updates.salary;
    if (updates.location !== undefined)    payload.location = updates.location;
    if (updates.emergencyContact !== undefined) payload.emergency_contact = updates.emergencyContact;

    const lmId = updates.lineManagerId ?? updates.line_manager_id;
    if (lmId !== undefined) payload.line_manager_id = lmId === '' ? null : lmId;

    const tId = updates.teamId ?? updates.team_id;
    if (tId !== undefined) payload.team_id = tId === '' ? null : tId;

    const sId = updates.shiftId ?? updates.shift_id;
    if (sId !== undefined) payload.shift_id = sId === '' ? null : sId;

    // Avatar upload to storage
    if (updates.avatar && typeof updates.avatar === 'string' && updates.avatar.startsWith('data:')) {
      try {
        const blob = await (await fetch(updates.avatar)).blob();
        const path = `${id}/avatar.webp`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(path, blob, { upsert: true, contentType: 'image/webp' });
        if (!uploadErr) payload.avatar = path;
      } catch (e) {
        console.warn('[EmployeeService] Avatar upload failed:', e);
      }
    }

    // Self-service password change via supabase.auth.updateUser.
    // Only works for the currently authenticated user changing their own password.
    if (updates.password) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) {
        throw new Error('No active session. Please log in again.');
      }

      // Verify current password before allowing change
      if (updates.oldPassword) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: session.user.email,
          password: updates.oldPassword,
        });
        if (signInError) {
          throw new Error('Current password is incorrect.');
        }
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: updates.password,
      });
      if (updateError) throw updateError;
    }

    console.log('[EmployeeService] Updating profile:', id, payload);
    const { error } = await supabase.from('profiles').update(payload).eq('id', id);
    if (error) throw error;

    employeeService.clearCache();
    apiClient.notify();
  },

  async deleteEmployee(id: string) {
    if (!isSupabaseConfigured()) return;

    // Soft-delete: mark as INACTIVE and clear sensitive data
    // (Hard-delete of auth.users requires service role key, not available on client)
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'INACTIVE', verified: false })
      .eq('id', id);

    if (error) throw new Error(error.message || 'Failed to delete employee');

    employeeService.clearCache();
    apiClient.notify();
  },

  async offboardEmployee(id: string) {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'INACTIVE' })
      .eq('id', id);

    if (error) throw new Error(error.message || 'Failed to offboard employee');

    employeeService.clearCache();
    apiClient.notify();
  },

  async reactivateEmployee(id: string) {
    if (!isSupabaseConfigured()) return;

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'ACTIVE', verified: true })
      .eq('id', id);

    if (error) throw new Error(error.message || 'Failed to reactivate employee');

    employeeService.clearCache();
    apiClient.notify();
  },
};
