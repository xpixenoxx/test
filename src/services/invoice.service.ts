import { supabase } from './supabase';
import { Invoice, InvoiceItem } from '../types';
import { resolveOrgId } from './api.client';

const mapInvoice = (r: any): Invoice => ({
  id: r.id,
  organizationId: r.organization_id,
  clientId: r.client_id,
  projectId: r.project_id,
  invoiceNumber: r.invoice_number,
  date: r.date,
  dueDate: r.due_date,
  status: r.status,
  currency: r.currency,
  subtotal: r.subtotal,
  taxAmount: r.tax_amount,
  totalAmount: r.total_amount,
  notes: r.notes,
  created: r.created,
  updated: r.updated,
  items: r.items ? r.items.map(mapInvoiceItem) : undefined,
});

const mapInvoiceItem = (r: any): InvoiceItem => ({
  id: r.id,
  invoiceId: r.invoice_id,
  description: r.description,
  quantity: r.quantity,
  unitPrice: r.unit_price,
  amount: r.amount,
});

export const invoiceService = {
  getInvoices: async (): Promise<Invoice[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('organization_id', orgId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapInvoice);
  },

  createInvoice: async (payload: Omit<Invoice, 'id' | 'organizationId' | 'status' | 'created' | 'updated' | 'items' | 'subtotal' | 'totalAmount'>, items: Omit<InvoiceItem, 'id' | 'invoiceId' | 'amount'>[]): Promise<Invoice> => {
    const orgId = await resolveOrgId();
    
    // Calculate totals
    const subtotal = items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const taxAmount = payload.taxAmount || 0;
    const totalAmount = subtotal + taxAmount;

    // 1. Insert Invoice
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        organization_id: orgId,
        client_id: payload.clientId,
        project_id: payload.projectId || null,
        invoice_number: payload.invoiceNumber,
        date: payload.date,
        due_date: payload.dueDate,
        status: 'DRAFT',
        currency: payload.currency,
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: payload.notes,
      })
      .select()
      .single();
      
    if (invoiceError) throw invoiceError;

    // 2. Insert Items
    if (items.length > 0) {
      const itemsToInsert = items.map(item => ({
        invoice_id: invoiceData.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        amount: item.quantity * item.unitPrice
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    }

    // Fetch complete invoice with items
    const { data: completeInvoice, error: fetchError } = await supabase
      .from('invoices')
      .select('*, items:invoice_items(*)')
      .eq('id', invoiceData.id)
      .single();

    if (fetchError) throw fetchError;
    return mapInvoice(completeInvoice);
  },

  updateInvoiceStatus: async (id: string, status: Invoice['status']): Promise<void> => {
    const { error } = await supabase
      .from('invoices')
      .update({ status, updated: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
  },

  getNextInvoiceNumber: async (): Promise<string> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('invoices')
      .select('invoice_number')
      .eq('organization_id', orgId)
      .order('created', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code !== 'PGRST116') throw error;
    
    const year = new Date().getFullYear();
    if (!data) return `INV-${year}-001`;
    
    const lastNumStr = data.invoice_number;
    const match = lastNumStr.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10) + 1;
      return `INV-${year}-${num.toString().padStart(3, '0')}`;
    }
    return `INV-${year}-001`;
  }
};
