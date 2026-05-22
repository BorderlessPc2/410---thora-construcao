import React from "react";

const ChatTypingIndicator: React.FC = () => (
  <div className="flex justify-start">
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="flex gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:0ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:300ms]" />
      </div>
      <span className="text-sm text-slate-500">Analisando orçamento…</span>
    </div>
  </div>
);

export default ChatTypingIndicator;
