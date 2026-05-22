import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  MessageSquare,
  Paperclip,
  Sparkles,
} from "lucide-react";
import { useAuth } from "../features/auth/AuthContext";
import ChatReportChart from "../components/ChatReportChart";
import ChatMarkdown from "../components/ChatMarkdown";
import ChatTypingIndicator from "../components/ChatTypingIndicator";
import ChatComposer from "../components/ChatComposer";
import { listOrcamentosByUserId } from "../features/orcamentos/orcamentoRepository";
import type { Orcamento } from "../features/orcamentos/orcamentoTypes";
import {
  aiReportChat,
  downloadAiAttachment,
  type AiReportAttachment,
  type AiReportChart,
  type ReportChatMessage,
} from "../services/api";
import { prepareItemsForAiReport } from "../features/orcamentos/prepareItemsForAiReport";

type UiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: AiReportChart | null;
  attachments?: AiReportAttachment[];
};

const SUGGESTIONS = [
  "Crie uma tabela com os 5 itens mais caros",
  "Gere um gráfico de pizza da curva ABC",
  "Resumo executivo deste orçamento",
  "Liste todos os itens da curva C com valores",
];

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function AttachmentChips({ attachments }: { attachments: AiReportAttachment[] }) {
  if (!attachments.length) return null;

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
      {attachments.map((att) => (
        <button
          key={att.filename}
          type="button"
          onClick={() => {
            downloadAiAttachment(att);
            toast.success("Download iniciado", { description: att.filename });
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50"
        >
          {att.filename.endsWith(".csv") ? (
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
          ) : att.mime_type.includes("pdf") || att.filename.endsWith(".pdf") ? (
            <FileText className="h-4 w-4 text-red-600" />
          ) : (
            <FileText className="h-4 w-4 text-blue-600" />
          )}
          <span className="max-w-[200px] truncate">{att.filename}</span>
          <Download className="h-3.5 w-3.5 text-slate-400" />
        </button>
      ))}
    </div>
  );
}

const Reports: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const loadOrcamentos = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingList(true);
    try {
      const data = await listOrcamentosByUserId(user.uid);
      const completed = data.filter(
        (o) => o.status === "completed" && Array.isArray(o.items) && o.items.length > 0,
      );
      setOrcamentos(completed);
      const preselect = (location.state as { uploadId?: string } | null)?.uploadId;
      setSelectedId((current) => {
        if (preselect && completed.some((o) => o.uploadId === preselect)) return preselect;
        if (current && completed.some((o) => o.uploadId === current)) return current;
        return completed[0]?.uploadId ?? "";
      });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar orçamentos");
    } finally {
      setLoadingList(false);
    }
  }, [user?.uid, location.state]);

  useEffect(() => {
    void loadOrcamentos();
  }, [loadOrcamentos]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [messages, sending]);

  const selected = useMemo(
    () => orcamentos.find((o) => o.uploadId === selectedId),
    [orcamentos, selectedId],
  );

  const preparedItems = useMemo(
    () => (selected?.items?.length ? prepareItemsForAiReport(selected.items) : []),
    [selected],
  );

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !selected?.items?.length) return;

    const userMsg: UiChatMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    const history: ReportChatMessage[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const result = await aiReportChat(history, preparedItems, {
        filename: selected.filename,
        uploadId: selected.uploadId,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: result.reply || "Análise concluída.",
          chart: result.chart ?? undefined,
          attachments: result.attachments ?? [],
        },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro na IA";
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          content: `Não foi possível analisar o orçamento.\n\n**Erro:** ${msg}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-0px)] min-h-0 flex-col bg-[#f7f7f8] lg:h-screen">
      <header className="shrink-0 border-b border-slate-200/80 bg-white px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Relatórios IA</h1>
            <p className="text-xs text-slate-500">
              Chat com memória de contexto · tabelas Markdown · gráficos interativos
            </p>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-slate-200 bg-white p-3 lg:w-60 lg:border-b-0 lg:border-r">
          <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Orçamento ativo
          </p>
          {loadingList ? (
            <div className="flex items-center gap-2 px-1 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando…
            </div>
          ) : orcamentos.length === 0 ? (
            <p className="px-1 text-sm text-slate-500">
              <button
                type="button"
                className="font-medium text-violet-600 hover:underline"
                onClick={() => navigate("/orcamento")}
              >
                Criar orçamento
              </button>
            </p>
          ) : (
            <ul className="max-h-36 space-y-0.5 overflow-y-auto lg:max-h-[calc(100vh-7rem)]">
              {orcamentos.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(o.uploadId);
                      setMessages([]);
                    }}
                    className={`w-full rounded-lg px-2.5 py-2 text-left text-sm transition ${
                      selectedId === o.uploadId
                        ? "bg-violet-600 text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span className="block truncate font-medium text-[13px]">
                      {o.filename || o.uploadId}
                    </span>
                    <span
                      className={`text-[11px] ${
                        selectedId === o.uploadId ? "text-violet-200" : "text-slate-400"
                      }`}
                    >
                      {o.itemsFound ?? o.items.length} itens
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <section className="flex min-h-0 flex-1 flex-col">
          {selected && (
            <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white/80 px-4 py-2 text-xs text-slate-600 backdrop-blur-sm">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              <span className="truncate font-medium">
                {selected.filename || selected.uploadId}
              </span>
            </div>
          )}

          <div
            ref={scrollContainerRef}
            className="min-h-0 flex-1 overflow-y-auto scroll-smooth px-4 py-6"
          >
            <div className="mx-auto max-w-3xl space-y-6">
              {messages.length === 0 && selected && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
                  <p className="mb-4 text-sm text-slate-600">
                    Pergunte sobre <strong>{selected.filename}</strong>. Exemplos:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void sendMessage(s)}
                        disabled={sending}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition hover:border-violet-300 hover:bg-violet-50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <p className="mt-4 flex items-center justify-center gap-1 text-[11px] text-slate-400">
                    <Paperclip className="h-3 w-3" />
                    Enter envia · Shift+Enter nova linha
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex w-full ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[min(100%,42rem)] ${
                      m.role === "user"
                        ? "rounded-2xl rounded-br-md bg-violet-600 px-4 py-3 text-white shadow-md shadow-violet-600/20"
                        : "rounded-2xl rounded-bl-md border border-slate-200/90 bg-white px-4 py-4 shadow-sm"
                    }`}
                  >
                    {m.role === "user" ? (
                      <ChatMarkdown content={m.content} variant="user" />
                    ) : (
                      <>
                        <ChatMarkdown content={m.content} variant="assistant" />
                        {m.chart && (m.chart.data?.length ?? 0) > 0 && (
                          <ChatReportChart chart={m.chart} />
                        )}
                        {m.attachments && m.attachments.length > 0 && (
                          <AttachmentChips attachments={m.attachments} />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {sending && <ChatTypingIndicator />}
              <div ref={chatEndRef} className="h-1" />
            </div>
          </div>

          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4">
            <ChatComposer
              value={input}
              onChange={setInput}
              onSubmit={() => void sendMessage(input)}
              disabled={!selected || sending}
              placeholder={
                selected
                  ? "Pergunte sobre o orçamento… (Enter para enviar)"
                  : "Selecione um orçamento"
              }
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Reports;
