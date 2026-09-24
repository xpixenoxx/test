import { supabase } from './supabase';
import { Asset } from '../types';
import { resolveOrgId } from './api.client';

const mapAsset = (r: any): Asset => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  category: r.category,
  serialNumber: r.serial_number,
  status: r.status,
  assignedTo: r.assigned_to,
  assignedAt: r.assigned_at,
  condition: r.condition,
  purchaseDate: r.purchase_date,
  purchaseCost: r.purchase_cost,
  notes: r.notes,
  created: r.created,
  updated: r.updated,
});

export const assetService = {
  getAssets: async (): Promise<Asset[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('organization_id', orgId)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapAsset);
  },

  getMyAssets: async (employeeId: string): Promise<Asset[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('assets')
      .select('*')
      .eq('organization_id', orgId)
      .eq('assigned_to', employeeId)
      .order('name');
    if (error) throw error;
    return (data || []).map(mapAsset);
  },

  createAsset: async (payload: Omit<Asset, 'id' | 'organizationId' | 'status' | 'created' | 'updated'>): Promise<Asset> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('assets')
      .insert({
        organization_id: orgId,
        name: payload.name,
        category: payload.category,
        serial_number: payload.serialNumber,
        status: payload.assignedTo ? 'ALLOCATED' : 'AVAILABLE',
        assigned_to: payload.assignedTo,
        assigned_at: payload.assignedTo ? new Date().toISOString() : null,
        condition: payload.condition,
        purchase_date: payload.purchaseDate,
        purchase_cost: payload.purchaseCost,
        notes: payload.notes,
      })
      .select()
      .single();
    if (error) throw error;
    return mapAsset(data);
  },

  updateAsset: async (id: string, payload: Partial<Omit<Asset, 'id' | 'organizationId' | 'created' | 'updated'>>): Promise<Asset> => {
    const updates: any = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.category !== undefined) updates.category = payload.category;
    if (payload.serialNumber !== undefined) updates.serial_number = payload.serialNumber;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.assignedTo !== undefined) updates.assigned_to = payload.assignedTo;
    if (payload.assignedAt !== undefined) updates.assigned_at = payload.assignedAt;
    if (payload.condition !== undefined) updates.condition = payload.condition;
    if (payload.purchaseDate !== undefined) updates.purchase_date = payload.purchaseDate;
    if (payload.purchaseCost !== undefined) updates.purchase_cost = payload.purchaseCost;
    if (payload.notes !== undefined) updates.notes = payload.notes;
    
    updates.updated = new Date().toISOString();

    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapAsset(data);
  },

  deleteAsset: async (id: string): Promise<void> => {
    const { error } = await supabase.from('assets').delete().eq('id', id);
    if (error) throw error;
  },

  assignAsset: async (id: string, employeeId: string | null): Promise<Asset> => {
    const updates: any = {
      assigned_to: employeeId,
      assigned_at: employeeId ? new Date().toISOString() : null,
      status: employeeId ? 'ALLOCATED' : 'AVAILABLE',
      updated: new Date().toISOString()
    };
    const { data, error } = await supabase
      .from('assets')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return mapAsset(data);
  }
};
