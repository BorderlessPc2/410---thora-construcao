import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NovoOrcamento from "./pages/NovoOrcamento";
import ValidacaoOrcamento from "./pages/ValidacaoOrcamento";
import CurvaABC from "./pages/CurvaABC";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import { ProtectedApp } from "./features/auth/ProtectedApp";

const App = () => {
  return (
    <Routes>
      {/* Público */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      {/* App protegido */}
      <Route element={<ProtectedApp />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/analise-orcamento" element={<NovoOrcamento />} />
        <Route path="/orcamento" element={<Navigate to="/analise-orcamento" replace />} />
        <Route path="/validacao/:uploadId" element={<ValidacaoOrcamento />} />
        <Route path="/validacao" element={<Navigate to="/analise-orcamento" replace />} />
        <Route path="/curva-abc/:uploadId" element={<CurvaABC />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
