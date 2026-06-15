import React from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import NotFound from './pages/NotFound/NotFound';
import SupplierDashboardPage from './pages/SupplierDashboardPage/SupplierDashboardPage';
import SystemConfigPage from './pages/SystemConfigPage';
import LoginPage from './pages/LoginPage';

export default function AppRoutes() {
  const { isLoggedIn, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Routes><Route path="*" element={<LoginPage />} /></Routes>;
  }

  const isConfig = location.pathname === '/config';

  return (
    <div className="min-h-screen bg-background">
      {/* Top Nav */}
      <div className="sticky top-0 z-10 bg-white border-b border-border px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <div className="w-7 h-7 rounded-md bg-primary text-white font-extrabold grid place-items-center text-xs mr-2">恋</div>
          <button
            onClick={() => navigate('/')}
            className={`px-3 py-1.5 rounded-md text-sm transition-colors ${!isConfig ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
          >
            画师库
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/config')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${isConfig ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              系统配置
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{user?.username} ({isAdmin ? '管理员' : '仅查看'})</span>
          <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground">退出</button>
        </div>
      </div>

      <Routes>
        <Route index element={<SupplierDashboardPage />} />
        <Route path="/config" element={<SystemConfigPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}