import { supabase } from './supabase';
import { Document } from '../types';
import { resolveOrgId } from './api.client';

const mapDocument = (r: any): Document => ({
  id: r.id,
  organizationId: r.organization_id,
  name: r.name,
  category: r.category,
  fileUrl: r.file_url,
  fileType: r.file_type,
  sizeBytes: r.size_bytes,
  ownerId: r.owner_id,
  uploadedBy: r.uploaded_by,
  created: r.created,
  updated: r.updated,
});

export const documentService = {
  // Get company documents (owner_id is null)
  getCompanyDocuments: async (): Promise<Document[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId)
      .is('owner_id', null)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDocument);
  },

  // Get employee's own documents
  getMyDocuments: async (employeeId: string): Promise<Document[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId)
      .eq('owner_id', employeeId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDocument);
  },

  // Admin: Get all documents for a specific employee
  getEmployeeDocuments: async (employeeId: string): Promise<Document[]> => {
    const orgId = await resolveOrgId();
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('organization_id', orgId)
      .eq('owner_id', employeeId)
      .order('created', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDocument);
  },

  uploadDocument: async (
    file: File,
    name: string,
    category: string,
    ownerId: string | null,
    uploaderId: string
  ): Promise<Document> => {
    const orgId = await resolveOrgId();
    
    // In a real app, upload file to Supabase Storage.
    // For this prototype, we'll create a fake URL.
    const fakeUrl = `https://example.com/docs/${Date.now()}_${file.name}`;

    const { data, error } = await supabase
      .from('documents')
      .insert({
        organization_id: orgId,
        name: name,
        category: category,
        file_url: fakeUrl,
        file_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        owner_id: ownerId,
        uploaded_by: uploaderId
      })
      .select()
      .single();
    if (error) throw error;
    return mapDocument(data);
  },

  deleteDocument: async (id: string): Promise<void> => {
    const { error } = await supabase.from('documents').delete().eq('id', id);
    if (error) throw error;
  }
};
