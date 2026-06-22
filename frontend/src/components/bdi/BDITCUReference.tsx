import React from "react";
import { ExternalLink } from "lucide-react";
import { PRESET_TCU_OBRAS } from "../../constants/bdiPresets";
import { formatBDIPercent } from "../../utils/bdiCalculator";

const BDITCUReference: React.FC = () => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Referência TCU</h3>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[280px] text-xs">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-2 pr-2">Componente</th>
              <th className="py-2 pr-2 text-right">Valor %</th>
              <th className="py-2">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {PRESET_TCU_OBRAS.componentes.map((c) => (
              <tr key={c.id} className="border-b border-slate-100">
                <td className="py-2 pr-2 text-slate-800">{c.nome}</td>
                <td className="py-2 pr-2 text-right tabular-nums">
                  {formatBDIPercent(c.valor).replace("%", "")}%
                </td>
                <td className="py-2 capitalize text-slate-500">{c.categoria.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <a
        href="https://portal.tcu.gov.br/jurisprudencia/acordao/2622-2013"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
      >
        Acórdão TCU 2622/2013
        <ExternalLink className="h-3 w-3" />
      </a>
      <p className="mt-2 text-xs text-slate-500">
        Valores de referência. Consulte seu contador para ISS local.
      </p>
    </div>
  );
};

export default BDITCUReference;
