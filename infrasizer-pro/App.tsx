
import React, { useState } from 'react';
import Dashboard from './pages/Dashboard';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import { AdminAuthProvider, useAdminAuth } from './contexts/AdminAuthContext';

const AppContent: React.FC = () => {
  const { isAuthenticated } = useAdminAuth();
  const [currentView, setCurrentView] = useState<'main' | 'admin'>('main');

  // Show admin login if trying to access admin but not authenticated
  if (currentView === 'admin' && !isAuthenticated) {
    return <AdminLogin />;
  }

  // Show admin panel if authenticated and on admin view
  if (currentView === 'admin' && isAuthenticated) {
    return <AdminPanel />;
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
