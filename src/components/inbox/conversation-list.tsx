"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, MessageSquarePlus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  /**
   * Increment to force the fetch effect below to refire. The parent
   * bumps this on realtime reconnect / tab visibility → visible so the
   * list catches up on any events sent while the WS was disconnected
   * or the tab was throttled. Optional so existing callers keep working.
   */
  resyncToken?: number;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-slate-500",
};

type FilterValue = ConversationStatus | "all";

const FILTER_TABS: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Pending", value: "pending" },
  { label: "Closed", value: "closed" },
];

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
}: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [loading, setLoading] = useState(true);

  // Keep the latest callback in a ref so the fetch effect below can
  // have a stable, empty-dep identity. Previously the fetch useCallback
  // depended on `onConversationsLoaded`, which depends on the parent's
  // `deepLinkConvId` — so every URL change (including one the parent
  // triggered via router.replace after a click) caused a fresh
  // conversations fetch. That extra refetch was the trigger for the
  // deep-link auto-select running a second time and wiping the active
  // thread's messages.
  // Mutation lives in an effect (not render) per React 19's refs rule;
  // the fetch runs once on mount so it's fine to read the slightly
  // older value — the very next render updates the ref for any
  // subsequent async completion.
  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contact:contacts(*)")
        .order("last_message_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        // Supabase errors have non-enumerable properties — log fields explicitly
        console.error("Failed to fetch conversations:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(data ?? []);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
    // `resyncToken` is included so the parent can force a refetch when
    // the realtime channel reconnects or the tab regains focus — catches
    // up on any events sent while the WS was disconnected or throttled.
  }, [resyncToken]);

  const filtered = useMemo(() => {
    let result = conversations;

    if (filter !== "all") {
      result = result.filter((c) => c.status === filter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => {
        const name = c.contact?.name?.toLowerCase() ?? "";
        const phone = c.contact?.phone?.toLowerCase() ?? "";
        const lastMsg = c.last_message_text?.toLowerCase() ?? "";
        return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
      });
    }

    return result;
  }, [conversations, filter, search]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value);
    },
    []
  );

  const handleSelect = useCallback(
    (conv: Conversation) => {
      onSelect(conv);
    },
    [onSelect]
  );

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full w-full flex-col border-r border-slate-800/80 bg-slate-900/98">

      {/* ── Panel header ─────────────────────────────────────────── */}
      <div className="shrink-0 border-b border-slate-800/60 px-4 py-3">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Conversations</h2>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              {filtered.length}
            </span>
            <button
              type="button"
              title="New conversation"
              aria-label="Start new conversation"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <MessageSquarePlus className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-8 border-slate-700/60 bg-slate-800/60 pl-8 text-xs text-white placeholder-slate-500 transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
        </div>

        {/* ── Pill filter tabs ───────────────────────────────────── */}
        <div className="mt-2.5 flex gap-1" role="tablist" aria-label="Filter conversations">
          {FILTER_TABS.map((tab) => {
            const count =
              tab.value === "all"
                ? conversations.length
                : conversations.filter((c) => c.status === tab.value).length;
            const isActive = filter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setFilter(tab.value)}
                className={cn(
                  "flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold transition-all",
                  isActive
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-slate-500 hover:bg-slate-800/60 hover:text-slate-300"
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1 tabular-nums",
                      isActive ? "text-primary/80" : "text-slate-600"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Conversation Items ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar" role="list" aria-label="Conversation list">
        {loading ? (
          <ConversationListSkeleton />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/60 ring-1 ring-slate-700/40">
              <Search className="h-5 w-5 text-slate-600" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-500">
              {search ? "No results found" : "No conversations yet"}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {search
                ? "Try a different search term"
                : "Conversations will appear here when contacts message you"}
            </p>
          </div>
        ) : (
          <div className="flex flex-col py-1" role="list">
            {filtered.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isActive={conv.id === activeConversationId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Skeleton loading ──────────────────────────────────────────────────
function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-px py-2 px-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
          <div className="skeleton h-11 w-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-3/4 rounded-full" />
            <div className="skeleton h-2.5 w-full rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Conversation Item ─────────────────────────────────────────────────
interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const displayName = contact?.name || contact?.phone || "Unknown";
  const initials = displayName.charAt(0).toUpperCase();

  const handleClick = useCallback(() => {
    onSelect(conversation);
  }, [onSelect, conversation]);

  const timeAgo = conversation.last_message_at
    ? formatDistanceToNow(new Date(conversation.last_message_at), {
        addSuffix: true,
      })
        .replace("about ", "")
        .replace("less than a minute ago", "just now")
    : "";

  return (
    <div className="px-2 py-0.5" role="listitem">
      <button
        onClick={handleClick}
        aria-current={isActive ? "true" : undefined}
        className={cn(
          "relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all duration-150",
          "hover:bg-slate-800/40 active:scale-[0.99]",
          isActive
            ? "bg-slate-800/80 shadow-md ring-1 ring-slate-700/50"
            : "bg-transparent",
        )}
      >
        {/* Active left accent bar */}
        {isActive && (
          <div className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-primary shadow-[0_0_8px_var(--color-primary)]" />
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shadow-inner",
              isActive
                ? "ring-2 ring-primary/30"
                : "ring-1 ring-slate-800",
              contact?.avatar_url
                ? "bg-slate-800"
                : "bg-gradient-to-br from-primary/70 to-emerald-600/70 text-white",
            )}
          >
            {contact?.avatar_url ? (
              <img
                src={contact.avatar_url}
                alt={displayName}
                className="h-11 w-11 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          {/* Status dot */}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 shadow-sm",
              STATUS_COLORS[conversation.status],
            )}
            title={conversation.status}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={cn(
                "truncate text-sm transition-colors",
                isActive
                  ? "font-semibold text-white"
                  : "font-medium text-slate-200",
              )}
            >
              {displayName}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-500 tabular-nums">
              {timeAgo}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                "truncate text-xs leading-relaxed",
                conversation.unread_count > 0
                  ? "font-medium text-slate-200"
                  : isActive
                  ? "text-slate-300"
                  : "text-slate-500",
              )}
            >
              {conversation.last_message_text || "No messages yet"}
            </p>

            {conversation.unread_count > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm shadow-primary/30">
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
