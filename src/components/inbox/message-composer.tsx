"use client";

import { useState, useRef, useCallback, KeyboardEvent } from "react";
import { Send, LayoutTemplate, Smile, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReplyQuote } from "./reply-quote";

interface ReplyDraft {
  /** Internal UUID of the message being replied to — sent back through onSend. */
  id: string;
  authorLabel: string;
  preview: string;
}

interface MessageComposerProps {
  conversationId: string;
  sessionExpired: boolean;
  onSend: (text: string, replyToId?: string) => void;
  onOpenTemplates: () => void;
  replyTo?: ReplyDraft | null;
  onClearReply?: () => void;
}

export function MessageComposer({
  conversationId,
  sessionExpired,
  onSend,
  onOpenTemplates,
  replyTo,
  onClearReply,
}: MessageComposerProps) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Max 5 lines (~120px)
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || sessionExpired) return;

    setSending(true);
    try {
      onSend(trimmed, replyTo?.id);
      setText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } finally {
      setSending(false);
    }
  }, [text, sending, sessionExpired, onSend, replyTo?.id]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value);
      adjustHeight();
    },
    [adjustHeight]
  );

  const canSend = !!text.trim() && !sessionExpired && !sending;

  return (
    <div
      className="shrink-0 border-t border-slate-800/80 bg-slate-900/98 px-3 py-3 backdrop-blur-sm"
      role="form"
      aria-label="Message composer"
    >
      {/* ── Reply quote preview ──────────────────────────────────── */}
      {replyTo && (
        <div className="mb-2">
          <ReplyQuote
            authorLabel={replyTo.authorLabel}
            preview={replyTo.preview}
            onDismiss={onClearReply}
          />
        </div>
      )}

      {/* ── Session expired banner ───────────────────────────────── */}
      {sessionExpired && (
        <div className="mb-3 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/8 px-3.5 py-2.5">
          <div>
            <p className="text-xs font-semibold text-amber-400">
              24-hour session expired
            </p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">
              Send a template to re-engage this contact
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-xs font-semibold text-amber-400 hover:bg-amber-500/20 hover:text-amber-300"
            onClick={onOpenTemplates}
          >
            <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" />
            Use Template
          </Button>
        </div>
      )}

      {/* ── Input row ────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-end gap-2 rounded-2xl border bg-slate-800/60 px-2 py-2 transition-all",
          sessionExpired
            ? "border-slate-700/30 opacity-60"
            : "border-slate-700/60 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/10",
        )}
      >
        {/* Left action buttons */}
        <div className="flex items-center gap-0.5 pb-0.5">
          <button
            type="button"
            disabled={sessionExpired}
            title="Attach file (coming soon)"
            aria-label="Attach file"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={sessionExpired}
            title="Emoji (coming soon)"
            aria-label="Insert emoji"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Smile className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onOpenTemplates}
            disabled={sessionExpired}
            title="Send template"
            aria-label="Send WhatsApp template"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-700/60 hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <LayoutTemplate className="h-4 w-4" />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={
            sessionExpired
              ? "Session expired — use a template to re-engage"
              : "Type a message… (Enter to send, Shift+Enter for new line)"
          }
          disabled={sessionExpired}
          rows={1}
          aria-label="Message text"
          aria-multiline="true"
          className={cn(
            "flex-1 resize-none bg-transparent py-1.5 text-sm text-white placeholder-slate-500 outline-none",
            sessionExpired && "cursor-not-allowed",
          )}
        />

        {/* Send button */}
        <Button
          size="sm"
          className={cn(
            "mb-0.5 h-9 w-9 shrink-0 rounded-xl p-0 shadow-md transition-all",
            canSend
              ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20"
              : "bg-slate-700/60 text-slate-500 cursor-not-allowed",
          )}
          disabled={!canSend}
          onClick={handleSend}
          aria-label="Send message"
        >
          <Send
            className={cn(
              "h-4 w-4 transition-transform",
              canSend && "translate-x-px -translate-y-px",
            )}
          />
        </Button>
      </div>

      {/* ── Shortcut hint ────────────────────────────────────────── */}
      <p className="mt-1.5 text-center text-[10px] text-slate-700">
        Press <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-500">Enter</kbd> to send
        &nbsp;·&nbsp;
        <kbd className="rounded bg-slate-800 px-1 py-0.5 font-mono text-slate-500">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
