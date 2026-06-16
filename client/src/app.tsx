import React from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import { MonitorIcon, SmartphoneIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import NotFound from './pages/NotFound/NotFound';
import SupplierDashboardPage from './pages/SupplierDashboardPage/SupplierDashboardPage';
import SystemConfigPage from './pages/SystemConfigPage';
import LoginPage from './pages/LoginPage';

function getInitialViewMode(): 'pc' | 'mobile' {
  const saved = localStorage.getItem('__view_mode');
  if (saved === 'pc' || saved === 'mobile') return saved;
  return window.innerWidth < 768 ? 'mobile' : 'pc';
}

export default function AppRoutes() {
  const { isLoggedIn, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = React.useState<'pc' | 'mobile'>(getInitialViewMode);

  const toggleViewMode = React.useCallback(() => {
    setViewMode((prev) => {
      const next = prev === 'pc' ? 'mobile' : 'pc';
      localStorage.setItem('__view_mode', next);
      return next;
    });
  }, []);

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
          {/* 仅在画师库页显示电脑/手机切换 */}
          {!isConfig && (
            <button
              onClick={toggleViewMode}
              title={viewMode === 'pc' ? '切换到手机模式' : '切换到电脑模式'}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              {viewMode === 'pc' ? (
                <><SmartphoneIcon className="w-3.5 h-3.5" /><span className="hidden sm:inline">手机</span></>
              ) : (
                <><MonitorIcon className="w-3.5 h-3.5" /><span className="hidden sm:inline">电脑</span></>
              )}
            </button>
          )}
          <span className="text-xs text-muted-foreground">{user?.username} ({isAdmin ? '管理员' : '仅查看'})</span>
          <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground">退出</button>
        </div>
      </div>

      <Routes>
        <Route index element={<SupplierDashboardPage viewMode={viewMode} />} />
        <Route path="/config" element={<SystemConfigPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}