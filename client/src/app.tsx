import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import Layout from './components/Layout';
import NotFound from './pages/NotFound/NotFound';
import SupplierDashboardPage from './pages/SupplierDashboardPage/SupplierDashboardPage';
import LoginPage from './pages/LoginPage';

export default function AppRoutes() {
  const { isLoggedIn } = useAuth();

  if (!isLoggedIn) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<SupplierDashboardPage />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}