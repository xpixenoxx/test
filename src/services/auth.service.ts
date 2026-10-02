import { supabase, isSupabaseConfigured } from './supabase';
import { User } from '../types';
import { organizationService } from './organization.service';
import { sessionManager } from './session/sessionManager';
import { apiClient } from './api.client';

// Build the app User object from a Supabase profile row
const profileToUser = (profile: Record<string, any>): User => ({
  id: profile.id,
  employeeId: profile.employee_id || '',
  email: profile.email || '',
  name: profile.name || 'User',
  role: (profile.role || 'EMPLOYEE').toString().toUpperCase() as any,
  department: profile.department || 'Unassigned',
  designation: profile.designation || 'Staff',
  teamId: profile.team_id || undefined,
  organizationId: profile.organization_id || undefined,
  avatar: profile.avatar
    ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.avatar}`
    : undefined,
});

export const authService = {
  async login(email: string, pass: string): Promise<{ user: User | null; error?: string }> {
    if (!isSupabaseConfigured()) return { user: null, error: 'Supabase not configured.' };

    const normalizedEmail = email.trim().toLowerCase();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: pass,
    });

    if (authError || !authData.user) {
      return { user: null, error: authError?.message || 'Login failed.' };
    }

    // Fetch profile row
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return { user: null, error: 'Account profile not found. Contact support.' };
    }

    if (!profile.verified) {
      await supabase.auth.signOut();
      return { user: null, error: 'Account not verified. Please check your email.' };
    }

    if (profile.status === 'INACTIVE') {
      await supabase.auth.signOut();
      return { user: null, error: 'Your account has been deactivated. Please contact your administrator.' };
    }

    const appUser = profileToUser({ ...profile, email: authData.user.email });
    apiClient.setOrganizationId(profile.organization_id);
    apiClient.setAuthRole(profile.role);
    return { user: appUser };
  },

  async logout() {
    // sessionManager.forceLogout() is the single exit path that calls
    // supabase.auth.signOut() — do not duplicate the call here (frozen
    // module invariant: only sessionManager may call signOut).
    await sessionManager.forceLogout('USER_INITIATED');
    organizationService.clearCache();
    apiClient.notify();
  },

  async finalizePasswordReset(_token: string, newPassword: string): Promise<boolean> {
    // Supabase handles token via magic link in URL — user lands back in app
    // already authenticated; we just update the password.
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) { console.error('[Auth] Password reset failed:', error.message); return false; }
    return true;
  },

  async requestVerificationEmail(email: string): Promise<boolean> {
    const { error } = await supabase.auth.resend({ type: 'signup', email });
    if (error) { console.error('[Auth] Resend verification failed:', error.message); return false; }
    return true;
  },

  async requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/?reset=1`,
    });
    if (error) { console.error('[Auth] Password reset request failed:', error.message); return { ok: false, error: error.message }; }
    return { ok: true };
  },

  async registerOrganization(data: {
    orgName: string;
    adminName: string;
    email: string;
    password: string;
    country: string;
    address?: string;
    logo?: File | null;
    turnstileToken?: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured()) return { success: false, error: 'System offline' };

    const password = data.password;

    try {
      // Step 1: Create the organization row first
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: data.orgName,
          country: data.country || 'IN',
          address: data.address || null,
          subscription_status: 'TRIAL',
          trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (orgError || !orgData) {
        // RLS may block anon insert — fallback: sign up user first then create org
        console.warn('[Auth] Org insert failed (RLS), trying signup-first flow:', orgError?.message);
      }

      const orgId = orgData?.id;

      // Step 2: Sign up the user with metadata
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password,
        options: {
          data: {
            name: data.adminName,
            org_name: data.orgName,
            org_id: orgId || null,
            role: 'ADMIN',
          },
          // Skip email confirmation for self-hosted / internal apps
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      data.password = ''; // Clear password from memory

      if (signUpError) {
        // Cleanup org if user creation failed
        if (orgId) await supabase.from('organizations').delete().eq('id', orgId);
        return { success: false, error: signUpError.message };
      }

      if (!authData.user) {
        if (orgId) await supabase.from('organizations').delete().eq('id', orgId);
        return { success: false, error: 'Account creation failed. Please try again.' };
      }

      const userId = authData.user.id;

      // Step 3: If org wasn't created yet (RLS blocked anon), create it now that user exists
      let finalOrgId = orgId;
      if (!finalOrgId) {
        const { data: newOrg } = await supabase
          .from('organizations')
          .insert({
            name: data.orgName,
            country: data.country || 'IN',
            address: data.address || null,
            subscription_status: 'TRIAL',
            trial_end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          })
          .select('id')
          .single();
        finalOrgId = newOrg?.id;
      }

      // Step 4: Update the profile with org, role, verified=true
      if (finalOrgId) {
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name: data.adminName,
            email: data.email,
            organization_id: finalOrgId,
            role: 'ADMIN',
            verified: true,
            status: 'ACTIVE',
            designation: 'Admin',
            department: 'Management',
            joining_date: new Date().toISOString().split('T')[0],
          }, { onConflict: 'id' });
      }

      return { success: true };
    } catch (err: any) {
      data.password = '';
      console.error('[Auth] Registration error:', err?.message);
      return { success: false, error: err?.message || 'Registration failed. Please try again.' };
    }
  },

  // Fetch the current user's profile from Supabase (used by sessionManager shim)
  async getCurrentUser(): Promise<User | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!profile) return null;
    // Keep apiClient org ID warm for page-refresh case (login() not called)
    apiClient.setOrganizationId(profile.organization_id ?? undefined);
    apiClient.setAuthRole(profile.role ?? undefined);
    return profileToUser({ ...profile, email: user.email });
  },
};
