"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Message, MessageReaction } from "@/types";
import {
  Clock,
  Check,
  CheckCheck,
  XCircle,
  FileText,
  MapPin,
  LayoutTemplate,
  ImageOff,
  CornerDownLeft,
} from "lucide-react";
import { format } from "date-fns";
import { ReplyQuote } from "./reply-quote";
import { MessageReactions } from "./message-reactions";

interface MessageBubbleProps {
  message: Message;
  /** Pre-computed quote info for messages that reply to another. */
  reply?: { authorLabel: string; preview: string } | null;
  reactions?: MessageReaction[];
  currentUserId?: string;
  onToggleReaction?: (emoji: string) => void;
}

function StatusIcon({ status }: { status: Message["status"] }) {
  switch (status) {
    case "sending":
      return <Clock className="h-3 w-3 text-slate-400" />;
    case "sent":
      return <Check className="h-3 w-3 text-slate-400" />;
    case "delivered":
      return <CheckCheck className="h-3 w-3 text-slate-400" />;
    case "read":
      return <CheckCheck className="h-3 w-3 text-blue-400" />;
    case "failed":
      return <XCircle className="h-3 w-3 text-red-400" />;
    default:
      return null;
  }
}

function MediaUnavailable({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-slate-700/40 px-3 py-2 text-xs text-slate-300">
      <ImageOff className="h-4 w-4 shrink-0 text-slate-500" />
      <span>{label} unavailable</span>
    </div>
  );
}

function MediaImage({ url, alt }: { url: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadImage = useCallback(async () => {
    if (!url) return;

    // Proxy URLs need auth fetch to create blob URL
    if (url.startsWith("/api/whatsapp/media/")) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load media");
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    } else {
      setSrc(url);
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    loadImage();
    return () => {
      if (src?.startsWith("blob:")) {
        URL.revokeObjectURL(src);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadImage]);

  if (error) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-slate-700">
        <ImageOff className="h-8 w-8 text-slate-500" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-40 w-60 items-center justify-center rounded-lg bg-slate-700">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <img
      src={src ?? ""}
      alt={alt}
      className="max-h-64 max-w-60 rounded-lg object-cover"
      onError={() => setError(true)}
    />
  );
}

function formatMessageText(text: string) {
  if (!text) return "";
  // Escape HTML to prevent injection
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  
  // Replace *bold* with <strong>bold</strong>
  // Replace _italic_ with <em>italic</em>
  // Replace ~strikethrough~ with <del>strikethrough</del>
  // Replace `code` with <code>code</code>
  const formatted = escaped
    .replace(/\*([^*]+)\*/g, "<strong>$1</strong>")
    .replace(/_([^_]+)_/g, "<em>$1</em>")
    .replace(/~([^~]+)~/g, "<del>$1</del>")
    .replace(/`([^`]+)`/g, "<code class='bg-black/30 px-1 py-0.5 rounded text-xs'>$1</code>");
    
  return <span dangerouslySetInnerHTML={{ __html: formatted }} />;
}

function MessageContent({ message }: { message: Message }) {
  switch (message.content_type) {
    case "text":
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed tracking-wide">
          {formatMessageText(message.content_text || "")}
        </p>
      );

    case "image":
      return (
        <div className="space-y-1.5">
          {message.media_url ? (
            <MediaImage url={message.media_url} alt="Shared image" />
          ) : (
            <MediaUnavailable label="Image" />
          )}
          {message.content_text && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {formatMessageText(message.content_text)}
            </p>
          )}
        </div>
      );

    case "video":
      return (
        <div className="space-y-1.5">
          {message.media_url ? (
            <video
              src={message.media_url}
              controls
              className="max-h-64 max-w-60 rounded-lg shadow-inner"
            />
          ) : (
            <MediaUnavailable label="Video" />
          )}
          {message.content_text && (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
              {formatMessageText(message.content_text)}
            </p>
          )}
        </div>
      );

    case "audio":
      return (
        <div>
          {message.media_url ? (
            <audio src={message.media_url} controls className="max-w-60" />
          ) : (
            <MediaUnavailable label="Audio" />
          )}
        </div>
      );

    case "document":
      if (!message.media_url) {
        return <MediaUnavailable label={message.content_text || "Document"} />;
      }
      return (
        <a
          href={message.media_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-xl bg-slate-900/50 border border-slate-800 px-3.5 py-2.5 text-sm hover:bg-slate-950 transition-colors"
        >
          <FileText className="h-5 w-5 shrink-0 text-slate-400" />
          <span className="truncate max-w-[200px] font-medium text-slate-200">
            {message.content_text || "Document"}
          </span>
        </a>
      );

    case "template":
      return (
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
            <LayoutTemplate className="h-3 w-3" />
            Template
          </span>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">
            {formatMessageText(message.content_text || "")}
          </p>
        </div>
      );

    case "location":
      return (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
          <span className="font-medium text-slate-300">{message.content_text || "Location shared"}</span>
        </div>
      );

    case "interactive": {
      return (
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex w-fit items-center gap-1 rounded bg-slate-900/50 border border-slate-800/60 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
            <CornerDownLeft className="h-3 w-3" />
            Button Reply
          </span>
          <p className="whitespace-pre-wrap break-words text-sm font-semibold text-emerald-400 leading-relaxed bg-emerald-500/5 px-2.5 py-1.5 rounded-lg border border-emerald-500/10">
            {message.content_text || "[Interactive reply]"}
          </p>
        </div>
      );
    }

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
          {formatMessageText(message.content_text || "[Unsupported message type]")}
        </p>
      );
  }
}

export function MessageBubble({
  message,
  reply,
  reactions,
  currentUserId,
  onToggleReaction,
}: MessageBubbleProps) {
  const isAgent = message.sender_type === "agent" || message.sender_type === "bot";
  const time = format(new Date(message.created_at), "HH:mm");

  // Row alignment + width cap are owned by <MessageActions> so its hover
  // group matches the bubble's content area, not the full row.
  return (
    <div
      className={cn(
        "flex flex-col min-w-0 w-full",
        isAgent ? "items-end" : "items-start",
      )}
    >
      <div
        className={cn(
          "relative max-w-full min-w-0 rounded-2xl px-3.5 py-2.5 shadow-md",
          isAgent
            ? "rounded-br-sm bg-gradient-to-br from-emerald-600 to-emerald-700 text-white"
            : "rounded-bl-sm bg-slate-800/90 text-slate-100 ring-1 ring-slate-700/50",
        )}
      >
        {reply && (
          <ReplyQuote authorLabel={reply.authorLabel} preview={reply.preview} />
        )}
        <MessageContent message={message} />
        <div
          className={cn(
            "mt-1 flex items-center gap-1",
            isAgent ? "justify-end" : "justify-start",
          )}
        >
          <span className={cn(
            "text-[10px]",
            isAgent ? "text-emerald-100/70" : "text-slate-500"
          )}>{time}</span>
          {isAgent && <StatusIcon status={message.status} />}
        </div>
      </div>
      {reactions && reactions.length > 0 && onToggleReaction && (
        <MessageReactions
          reactions={reactions}
          currentUserId={currentUserId}
          onToggle={onToggleReaction}
        />
      )}
    </div>
  );
}
