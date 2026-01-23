import { Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import NovoOrcamento from "./pages/NovoOrcamento";
import ValidacaoOrcamento from "./pages/ValidacaoOrcamento";

const App = () => {
return (
<Routes>
{/* Rota principal */}
<Route path="/" element={<Dashboard />} />
<Route path="/orcamento" element={<NovoOrcamento />} />
<Route path="/validacao" element={<ValidacaoOrcamento />} />

{/* Fallback */}
<Route path="*" element={<Navigate to="/" replace />} />
</Routes>
);
};


export default App
