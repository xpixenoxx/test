import { supabase } from './supabase';
import { Expense } from '../types';
import { resolveOrgId } from './api.client';

const mapExpense = (r: any): Expense => ({
  id: r.id,
  organizationId: r.organization_id,
  employeeId: r.employee_id,
  category: r.category,
  amount: r.amount,
  currency: r.currency,
  date: r.date,
  merchant: r.merchant,
  description: r.description,
  receiptUrl: r.receipt_url,
  status: r.status,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  reimbursedAt: r.reimbursed_at,
  created: r.created,
  updated: r.updated,
});

export const expenseService = {
  getExpenses: async (): Promise<Expense[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('organization_id', orgId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapExpense);
  },

  getMyExpenses: async (employeeId: string): Promise<Expense[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('expenses')
      .select('*')
      .eq('organization_id', orgId)
      .eq('employee_id', employeeId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapExpense);
  },

  createExpense: async (payload: Omit<Expense, 'id' | 'organizationId' | 'status' | 'created' | 'updated'>): Promise<Expense> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        organization_id: orgId,
        employee_id: payload.employeeId,
        category: payload.category,
        amount: payload.amount,
        currency: payload.currency,
        date: payload.date,
        merchant: payload.merchant,
        description: payload.description,
        receipt_url: payload.receiptUrl,
        status: 'PENDING',
      })
      .select()
      .single();
    if (error) throw error;
    return mapExpense(data);
  },

  updateExpense: async (id: string, payload: Partial<Omit<Expense, 'id' | 'organizationId' | 'created' | 'updated'>>): Promise<Expense> => {
    const updates: any = {};
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.amount !== undefined) updates.amount = payload.amount;
    if (payload.currency !== undefined) updates.currency = payload.currency;
    if (payload.date !== undefined) updates.date = payload.date;
    if (payload.merchant !== undefined) updates.merchant = payload.merchant;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.receiptUrl !== undefined) updates.receipt_url = payload.receiptUrl;
    
    updates.updated = new Date().toISOString();

    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapExpense(data);
  },

  deleteExpense: async (id: string): Promise<void> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
  },

  updateStatus: async (id: string, status: Expense['status'], approverId?: string): Promise<Expense> => {
    const updates: any = { status, updated: new Date().toISOString() };
    if (status === 'APPROVED' || status === 'REJECTED') {
      updates.approved_by = approverId;
      updates.approved_at = new Date().toISOString();
    }
    if (status === 'REIMBURSED') {
      updates.reimbursed_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapExpense(data);
  }
};
