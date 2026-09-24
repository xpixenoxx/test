
import React, { useState, useEffect, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SearchProvider } from './context/SearchContext';
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext';
import { ToastProvider } from './context/ToastContext';
import MainLayout from './layouts/MainLayout';
import SearchDialog from './components/search/SearchDialog';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyWithReload } from './utils/lazyWithReload';
import { supabase } from './services/supabase';
import { sessionManager } from './services/session/sessionManager';

// Eager: pages needed for first paint
import Login from './pages/Login';
import Setup from './pages/Setup';
import { VerifyAccount } from './pages/VerifyAccount';
import { ResetPassword } from './pages/ResetPassword';
import { SuspendedPage } from './components/subscription';
import RegisterOrganization from './pages/RegisterOrganization';

// Lazy: authenticated pages loaded on demand after login.
const Dashboard = lazyWithReload(() => import('./pages/Dashboard'));
const EmployeeDirectory = lazyWithReload(() => import('./pages/EmployeeDirectory'));
const Attendance = lazyWithReload(() => import('./pages/Attendance'));
const AttendanceLogs = lazyWithReload(() => import('./pages/AttendanceLogs'));
const Leave = lazyWithReload(() => import('./pages/Leave'));
const Projects = lazyWithReload(() => import('./pages/Projects'));
const Payroll = lazyWithReload(() => import('./pages/Payroll'));
const Expenses = lazyWithReload(() => import('./pages/Expenses'));
const Assets = lazyWithReload(() => import('./pages/Assets'));
const Documents = lazyWithReload(() => import('./pages/Documents'));
const Invoices = lazyWithReload(() => import('./pages/Invoices'));
const Settings = lazyWithReload(() => import('./pages/Settings'));
const Reports = lazyWithReload(() => import('./pages/Reports'));
const Organization = lazyWithReload(() => import('./pages/Organization'));
const SuperAdmin = lazyWithReload(() => import('./pages/SuperAdmin'));
const PerformanceReview = lazyWithReload(() => import('./pages/PerformanceReview'));
const Announcements = lazyWithReload(() => import('./pages/Announcements'));
const AdminNotifications = lazyWithReload(() => import('./pages/AdminNotifications'));
import { getCurrentRoute, navigateToRoute, replaceRoute } from './utils/deeplink';
import { PushPermissionPrompt } from './components/PushPermissionPrompt';

const AppContent: React.FC = () => {
  const { user, isLoading, isConfigured, setConfigured, login, logout } = useAuth();
  const { subscription, isLoading: isSubscriptionLoading } = useSubscription();
  const [currentPath, setCurrentPath] = useState('dashboard');
  const [navParams, setNavParams] = useState<any>(null);

  // Auth flow state
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);

  // Check URL for verification token on mount
  useEffect(() => {
    let token: string | null = null;

    // 1. Check Search Params (Standard: /?token=...)
    token = new URLSearchParams(window.location.search).get('token');

    // 2. Check Hash Params (Fallback: /#/?token=...)
    if (!token && window.location.hash.includes('?')) {
      const hashQuery = window.location.hash.split('?')[1];
      token = new URLSearchParams(hashQuery).get('token');
    }

    // 3. Check PocketBase default format: /_/#/auth/confirm-verification/{TOKEN}
    if (!token && window.location.hash.includes('/auth/confirm-verification/')) {
      const match = window.location.hash.match(/\/auth\/confirm-verification\/([^/?#]+)/);
      if (match && match[1]) {
        token = match[1];
      }
    }

    if (token) {
      setVerificationToken(token);
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      return;
    }

    // Check for password reset redirect
    const queryReset = new URLSearchParams(window.location.search).get('reset') === '1';
    const hashRecovery = window.location.hash.includes('type=recovery');
    if (queryReset || hashRecovery) {
      setShowPasswordReset(true);
      if (queryReset) {
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Listen for Supabase auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowPasswordReset(true);
      }
      if (event === 'SIGNED_OUT') {
        const snap = sessionManager.getSnapshot();
        if (snap.user) {
          sessionManager.setCurrentUser(null);
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // Deep link: listen for hash changes (back/forward, direct URL navigation, bookmarks)
  useEffect(() => {
    const handleDeepLinkHashChange = () => {
      const route = getCurrentRoute();
      if (route && user) {
        const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
        let resolvedParams = route.params;
        if (route.path === 'attendance' && !resolvedParams) {
          // quick-office = WFH (primary), quick-factory = Office/Field (secondary)
          if (hash === '/attendance/quick-office') resolvedParams = { autoStart: 'WFH' };
          else if (hash === '/attendance/quick-factory') resolvedParams = { autoStart: 'OFFICE' };
          else if (hash === '/attendance/finish') resolvedParams = { autoStart: 'FINISH' };
        }
        setCurrentPath(route.path);
        setNavParams(resolvedParams);
      }
    };
    window.addEventListener('hashchange', handleDeepLinkHashChange);
    return () => window.removeEventListener('hashchange', handleDeepLinkHashChange);
  }, [user]);

  // On auth: read initial hash for deep linking (bookmark, shared link)
  useEffect(() => {
    if (user && !isLoading) {
      const route = getCurrentRoute();
      if (route) {
        // Resolve attendance shortcut params from hash
        const hash = window.location.hash.replace(/^#/, '').replace(/\/+$/, '');
        let resolvedParams = route.params;
        if (route.path === 'attendance' && !resolvedParams) {
          if (hash === '/attendance/quick-office') resolvedParams = { autoStart: 'WFH' };
          else if (hash === '/attendance/quick-factory') resolvedParams = { autoStart: 'OFFICE' };
          else if (hash === '/attendance/finish') resolvedParams = { autoStart: 'FINISH' };
        }
        setCurrentPath(route.path);
        setNavParams(resolvedParams);
      } else if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
        // No deep link in URL — sync URL to default state (dashboard)
        replaceRoute('dashboard', null);
      }
    }
  }, [user, isLoading]);

  // Push subscription handled via PushPermissionPrompt (soft-gate, user-initiated)

  const handleNavigate = (path: string, params?: any) => {
    if (path === 'attendance-quick-office') {
      // WFH = primary check-in mode
      setCurrentPath('attendance');
      setNavParams({ autoStart: 'WFH' });
      navigateToRoute('attendance', { autoStart: 'WFH' });
    } else if (path === 'attendance-quick-factory') {
      // Office/Field = secondary check-in mode
      setCurrentPath('attendance');
      setNavParams({ autoStart: 'OFFICE' });
      navigateToRoute('attendance', { autoStart: 'OFFICE' });
    } else if (path === 'attendance-finish') {
      setCurrentPath('attendance');
      setNavParams({ autoStart: 'FINISH' });
      navigateToRoute('attendance', { autoStart: 'FINISH' });
    } else {
      setCurrentPath(path);
      setNavParams(params || null);
      navigateToRoute(path, params || null);
    }
  };

  if (!isConfigured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  // Verification Flow
  if (verificationToken) {
    return <VerifyAccount token={verificationToken} onFinished={() => { setVerificationToken(null); }} />;
  }

  // Password Reset Flow
  if (showPasswordReset) {
    return <ResetPassword onFinished={() => { setShowPasswordReset(false); }} />;
  }

  if (isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  // Unauthenticated — show Registration or Login
  if (!user) {
    if (showRegistration) {
      return (
        <RegisterOrganization
          onBack={() => setShowRegistration(false)}
          onSuccess={(_email) => {
            setShowRegistration(false);
            // Optionally, pre-fill email in Login if we wanted to
          }}
        />
      );
    }
    return <Login onLoginSuccess={login} onRegisterClick={() => setShowRegistration(true)} />;
  }

  // Check if Super Admin
  const isSuperAdmin = user.role === 'SUPER_ADMIN';

  // Priority 2.5: Check if organization is suspended (show lockout screen)
  // Wait for subscription to load before checking
  if (!isSuperAdmin && !isSubscriptionLoading && subscription?.isBlocked) {
    return <SuspendedPage onLogout={logout} />;
  }

  // Authenticated App
  const renderContent = () => {
    // Super Admin has a dedicated dashboard
    if (isSuperAdmin && (currentPath === 'dashboard' || currentPath === 'super-admin')) {
      return <SuperAdmin user={user} onNavigate={handleNavigate} />;
    }

    switch (currentPath) {
      case 'dashboard': return <Dashboard user={user} onNavigate={handleNavigate} />;
      case 'super-admin': return <SuperAdmin user={user} onNavigate={handleNavigate} />;
      case 'profile': return <Settings user={user} onBack={() => handleNavigate('dashboard')} />;
      case 'employees': return <EmployeeDirectory user={user} selectedEmployeeId={navParams?.selectedEmployeeId} />;
      case 'attendance':
        return (
          <ErrorBoundary>
            <Attendance
              user={user}
              autoStart={navParams?.autoStart}
              onFinish={() => handleNavigate('dashboard')}
            />
          </ErrorBoundary>
        );
      case 'attendance-logs': return <AttendanceLogs user={user} viewMode="MY" filterEmployeeId={navParams?.filterEmployeeId} />;
      case 'attendance-audit': return <AttendanceLogs user={user} viewMode="AUDIT" />;
      case 'leave': return <Leave user={user} autoOpen={navParams?.autoOpen} openLeaveId={navParams?.openLeaveId} />;
      case 'projects': return <Projects user={user} />;
      case 'payroll': return <Payroll user={user} />;
      case 'expenses': return <Expenses user={user} />;
      case 'assets': return <Assets user={user} />;
      case 'documents': return <Documents user={user} />;
      case 'invoices': return <Invoices user={user} />;
      case 'announcements': return <Announcements user={user} />;
      case 'admin-notifications': return <AdminNotifications user={user} />;
      case 'performance-review': return <PerformanceReview user={user} />;
      case 'settings': return <Settings user={user} />;
      case 'reports': return <Reports user={user} />;
      case 'organization': return <Organization initialTab={navParams?.tab} />;
      default: return <Dashboard user={user} onNavigate={handleNavigate} />;
    }
  };

  const suspenseFallback = (
    <div className="h-screen w-full flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-primary" size={48} />
    </div>
  );

  const pushPrompt = !isSuperAdmin ? (
    <PushPermissionPrompt userId={user.id} organizationId={user.organizationId as string | undefined} />
  ) : null;

  if (currentPath === 'attendance') {
    return (
      <>
        <Suspense fallback={suspenseFallback}>{renderContent()}</Suspense>
        {pushPrompt}
      </>
    );
  }

  return (
    <MainLayout currentPath={currentPath} onNavigate={handleNavigate}>
      <Suspense fallback={suspenseFallback}>{renderContent()}</Suspense>
      {pushPrompt}
    </MainLayout>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ThemeProvider>
          <ToastProvider>
            <SearchProvider>
              <AppContent />
              <SearchDialog />
              <PWAUpdateBanner />
            </SearchProvider>
          </ToastProvider>
        </ThemeProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
};

export default App;
