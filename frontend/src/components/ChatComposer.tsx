import React, { useCallback, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { btnAccent } from "./ui/buttonClasses";

interface ChatComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatComposer: React.FC<ChatComposerProps> = ({
  value,
  onChange,
  onSubmit,
  disabled,
  placeholder,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [value, resize]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSubmit();
      }
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl items-end gap-2">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className="max-h-40 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-60"
      />
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className={`${btnAccent} mb-0.5 shrink-0 rounded-2xl px-4 py-3 disabled:opacity-50`}
        aria-label="Enviar mensagem"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
};

export default ChatComposer;
