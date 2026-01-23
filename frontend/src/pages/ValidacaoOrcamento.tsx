import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf'; // <--- Imports do PDF
import { 
  ArrowLeft, 
  AlertCircle, 
  Check, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Loader2
} from 'lucide-react';

// --- CONFIGURAÇÃO OBRIGATÓRIA DO WORKER (PARA VITE) ---
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// --- INTERFACES ---
interface ItemOrcamento {
  id: number;
  code: string;
  description: string;
  unit: string;
  qty: number;
  unitPrice: number;
}

// --- MOCK DATA ---
const initialItems: ItemOrcamento[] = [
  { id: 1, code: "01.01.001", description: "Escavação mecânica de solo de 1ª categoria", unit: "m³", qty: 450.00, unitPrice: 15.50 },
  { id: 2, code: "01.01.002", description: "Concreto armado fck=25MPa para fundação", unit: "m³", qty: 85.00, unitPrice: 450.00 },
  { id: 3, code: "01.02.001", description: "Aço CA-50 para armação estrutural", unit: "kg", qty: 8500.00, unitPrice: 8.90 },
  { id: 4, code: "02.01.001", description: "Alvenaria de bloco cerâmico 14x19x29cm", unit: "m²", qty: 1250.00, unitPrice: 65.00 },
  { id: 5, code: "02.02.001", description: "Chapisco para parede interna", unit: "m²", qty: 2400.00, unitPrice: 12.00 },
  { id: 6, code: "02.02.002", description: "Reboco interno com argamassa", unit: "m²", qty: 2400.00, unitPrice: 28.50 },
  { id: 7, code: "03.01.001", description: "Piso cerâmico 60x60cm", unit: "m²", qty: 580.00, unitPrice: 85.00 },
  { id: 8, code: "03.02.001", description: "Pintura látex PVA duas demãos", unit: "m²", qty: 3200.00, unitPrice: 18.00 },
  { id: 9, code: "04.01.001", description: "Instalação elétrica ponto de tomada", unit: "un", qty: 120.00, unitPrice: 45.00 },
  { id: 10, code: "04.02.001", description: "Instalação hidráulica ponto de água fria", unit: "un", qty: 45.00, unitPrice: 120.00 },
];

export default function ValidacaoOrcamento() {
  const navigate = useNavigate();
  const location = useLocation(); // <--- Para pegar o arquivo enviado
  
  // States da Planilha
  const [items, setItems] = useState<ItemOrcamento[]>(initialItems);
  const [totalGeral, setTotalGeral] = useState(0);

  // States do PDF Viewer
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.0); // Zoom

  // 1. Recuperar o arquivo ao carregar a tela
  useEffect(() => {
    // Se veio arquivo da navegação, usamos ele
    if (location.state?.file) {
      setPdfFile(location.state.file);
    } else {
      // Opcional: Se não tiver arquivo (ex: refresh na página), redirecionar ou mostrar erro
      // navigate('/orcamento'); 
      console.warn("Nenhum arquivo encontrado no estado da rota");
    }
  }, [location, navigate]);

  // Recalcula total
  useEffect(() => {
    const total = items.reduce((acc, item) => acc + (item.qty * item.unitPrice), 0);
    setTotalGeral(total);
  }, [items]);

  // Handlers da Tabela
  const handleChange = (id: number, field: keyof ItemOrcamento, value: string | number) => {
    setItems(prevItems => prevItems.map(item => {
      if (item.id === id) return { ...item, [field]: value };
      return item;
    }));
  };

  const handleDelete = (id: number) => {
    if (window.confirm("Tem certeza que deseja remover este item?")) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const formatMoney = (value: number) => {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Handlers do PDF
  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  return (
    <div className="flex flex-col h-screen bg-white font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shrink-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500 transition">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-semibold text-gray-900 leading-tight">Projeto Residencial Vila Nova</h1>
            <p className="text-xs text-gray-500 flex items-center gap-1">
              Validação • {items.length} itens extraídos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            className="bg-[#0F52BA] hover:bg-blue-800 text-white px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition shadow-sm"
            onClick={() => alert(`Dados confirmados! Total: R$ ${formatMoney(totalGeral)}`)}
          >
            <Check className="w-4 h-4" />
            Confirmar
          </button>
        </div>
      </header>

      {/* SPLIT VIEW */}
      <main className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
        
        {/* --- ESQUERDA: PDF VIEWER REAL --- */}
        <div className="w-5/12 bg-slate-100 border-r border-gray-200 flex flex-col relative lg:flex">
          
          {/* Toolbar do PDF */}
          <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 z-10">
            <span className="text-xs font-semibold text-gray-500 uppercase">PDF Original</span>
            
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setScale(s => Math.max(0.5, s - 0.1))}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Diminuir Zoom"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono w-12 text-center text-gray-600">{(scale * 100).toFixed(0)}%</span>
              <button 
                onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Aumentar Zoom"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-600">
                Pág {pageNumber} de {numPages || '--'}
              </span>
              <button 
                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                className="p-1.5 hover:bg-gray-100 rounded text-gray-600 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Área de Renderização do PDF */}
          <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/50">
            {pdfFile ? (
              <Document
                file={pdfFile}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="flex items-center gap-2 text-gray-500 mt-10">
                    <Loader2 className="animate-spin w-5 h-5" /> Carregando PDF...
                  </div>
                }
                error={
                  <div className="text-red-500 mt-10 text-sm">
                    Erro ao carregar PDF. Tente enviar novamente.
                  </div>
                }
                className="shadow-lg"
              >
                <Page 
                  pageNumber={pageNumber} 
                  scale={scale} 
                  renderTextLayer={false} 
                  renderAnnotationLayer={false}
                  className="bg-white" // Garante fundo branco
                />
              </Document>
            ) : (
              <div className="text-center text-gray-400 mt-20">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>Nenhum arquivo carregado.</p>
              </div>
            )}
          </div>
        </div>

        {/* --- DIREITA: TABELA EDITÁVEL (Mantida Igual) --- */}
        <div className="w-full lg:w-7/12 bg-white flex flex-col h-full overflow-hidden">
          
          {/* Header Tabela */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-end bg-white shrink-0">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Planilha Extraída</h2>
            <div className="text-right">
              <span className="text-xs text-gray-500 font-medium uppercase">Total Geral</span>
              <p className="text-lg font-bold text-[#0F52BA] transition-all duration-300">
                R$ {formatMoney(totalGeral)}
              </p>
            </div>
          </div>

          {/* Corpo Tabela com Scroll Independente */}
          <div className="flex-1 overflow-y-auto pb-20">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider w-24">Código</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Descrição</th>
                  <th className="px-2 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center w-14">Un.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">Qtd.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-28">Valor Unit.</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-28 bg-gray-100">Total</th>
                  <th className="px-2 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-blue-50/30 transition group">
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={item.code}
                        onChange={(e) => handleChange(item.id, 'code', e.target.value)}
                        className="w-full bg-transparent font-mono text-xs text-gray-600 focus:outline-none focus:text-blue-600 border-b border-transparent focus:border-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="text" 
                        value={item.description}
                        onChange={(e) => handleChange(item.id, 'description', e.target.value)}
                        className="w-full bg-transparent text-sm text-gray-800 focus:outline-none border-b border-transparent focus:border-blue-500"
                      />
                    </td>
                    <td className="px-2 py-3 text-center">
                      <input 
                        type="text" 
                        value={item.unit}
                        onChange={(e) => handleChange(item.id, 'unit', e.target.value)}
                        className="w-full text-center bg-gray-50 rounded text-xs font-medium text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 py-1"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input 
                        type="number" 
                        step="0.01"
                        value={item.qty}
                        onChange={(e) => handleChange(item.id, 'qty', parseFloat(e.target.value) || 0)}
                        className="w-full text-right bg-transparent text-sm font-medium text-gray-700 focus:outline-none border-b border-transparent focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 border-b border-transparent focus-within:border-blue-500 transition-colors">
                        <span className="text-xs text-gray-400">R$</span>
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-20 text-right bg-transparent text-sm font-medium text-gray-700 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right bg-gray-50/50">
                      <span className="text-sm font-bold text-gray-800">
                        {formatMoney(item.qty * item.unitPrice)}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-center">
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="text-gray-300 hover:text-red-500 transition p-1 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}