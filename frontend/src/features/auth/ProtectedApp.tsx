import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import SidebarLayout from "../../components/SidebarLayout";
import { OrcamentoLinhasProvider } from "../orcamentos/OrcamentoLinhasContext";

export const ProtectedApp: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm text-slate-600">Carregando sessão…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <OrcamentoLinhasProvider>
      <SidebarLayout>
        <Outlet />
      </SidebarLayout>
    </OrcamentoLinhasProvider>
  );
};

