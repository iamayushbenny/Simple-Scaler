
import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';
import { initRemoteConfig, initRemotePlatformConfig } from './services/configLoader';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAdminAuth();
  const [currentView, setCurrentView] = useState<'main' | 'admin'>('main');
  const [configReady, setConfigReady] = useState(false);

  // Fetch remote config once at boot — non-blocking, app renders with cached/defaults if slow
  useEffect(() => {
    Promise.all([initRemoteConfig(), initRemotePlatformConfig()])
      .finally(() => setConfigReady(true));
  }, []);

  // Wait for remote config before rendering — prevents stale-default calculations
  if (!configReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-500">Loading configuration…</p>
        </div>
      </div>
    );
  }

  // Show admin login if trying to access admin but not authenticated
  if (currentView === 'admin' && !isAuthenticated) {
    return <AdminLogin />;
  }

  // Show admin panel if authenticated and on admin view
  if (currentView === 'admin' && isAuthenticated) {
    return <AdminPanel onBack={() => setCurrentView('main')} />;
  }

  // Show main dashboard with admin access button
  return (
    <div className="antialiased">
      <Dashboard onAdminClick={() => setCurrentView('admin')} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AdminAuthProvider>
      <AppContent />
    </AdminAuthProvider>
  );
};

export default App;
