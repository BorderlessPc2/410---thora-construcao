import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMarkdownProps {
  content?: string | null;
  variant?: "user" | "assistant";
}

const ChatMarkdown: React.FC<ChatMarkdownProps> = ({
  content,
  variant = "assistant",
}) => {
  const safe = typeof content === "string" ? content : "";
  if (!safe.trim()) {
    return (
      <p className="text-sm italic text-slate-500">
        Resposta sem texto. Veja o gráfico ou anexos abaixo.
      </p>
    );
  }

  const isUser = variant === "user";

  return (
    <div
      className={`chat-markdown prose prose-sm max-w-none ${
        isUser
          ? "prose-invert prose-p:text-white prose-headings:text-white prose-strong:text-white prose-td:text-white prose-th:text-white"
          : "prose-slate prose-headings:text-slate-900 prose-p:text-slate-800 prose-td:text-slate-800 prose-th:text-slate-700"
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[320px] border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-100 text-slate-700">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-slate-200 px-3 py-2 font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-slate-100 px-3 py-2">{children}</td>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-slate-50/80">{children}</tr>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !className;
            if (inline) {
              return (
                <code
                  className="rounded bg-slate-200/80 px-1 py-0.5 font-mono text-[0.85em] text-slate-800"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block overflow-x-auto rounded-lg bg-slate-900 p-3 font-mono text-xs text-slate-100 ${className ?? ""}`}
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-lg">{children}</pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline-offset-2 hover:underline"
            >
              {children}
            </a>
          ),
        }}
      >
        {safe}
      </ReactMarkdown>
    </div>
  );
};

export default ChatMarkdown;
