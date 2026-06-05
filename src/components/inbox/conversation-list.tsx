"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/types";
import { Search, ChevronDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

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

const FILTER_OPTIONS: { label: string; value: ConversationStatus | "all" }[] = [
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
  const [filter, setFilter] = useState<ConversationStatus | "all">("all");
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

  const activeFilter = FILTER_OPTIONS.find((o) => o.value === filter);

  return (
    // w-full on mobile so the list occupies the whole viewport when it's
    // the single pane showing; fixed 320px on desktop where it shares the
    // row with the thread + contact sidebar.
    <div className="flex h-full w-full flex-col border-r border-slate-800/80 bg-slate-900/95 lg:w-80">
      {/* Search + Filter */}
      <div className="space-y-3 border-b border-slate-800/60 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={search}
            onChange={handleSearchChange}
            placeholder="Search conversations..."
            className="h-9 border-slate-700/60 bg-slate-800/60 pl-9 text-sm text-white placeholder-slate-500 transition-all focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20"
          />
        </div>

        <div className="flex items-center justify-between">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center h-7 gap-1 px-2.5 text-[11px] font-semibold text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/80 transition-all border border-slate-800 bg-slate-900/50 shadow-sm">
                <span>Filter: {activeFilter?.label ?? "All"}</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="border-slate-700 bg-slate-800/95 shadow-xl backdrop-blur-md"
            >
              {FILTER_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => setFilter(opt.value)}
                  className={cn(
                    "text-xs px-3 py-1.5 transition-colors cursor-pointer",
                    filter === opt.value
                      ? "text-emerald-400 font-semibold bg-emerald-500/10"
                      : "text-slate-300 hover:bg-slate-700/50"
                  )}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-[10px] text-slate-500 font-medium">
            {filtered.length} active
          </span>
        </div>
      </div>

      {/* Conversation Items */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-slate-500">No conversations found</p>
          </div>
        ) : (
          <div className="flex flex-col">
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
    <div className="px-2 py-1">
      <button
        onClick={handleClick}
        className={cn(
          "relative flex w-full items-start gap-3 rounded-xl p-3 text-left transition-all duration-200",
          "hover:bg-slate-800/40 hover:shadow-sm active:scale-[0.99]",
          isActive
            ? "bg-slate-800/80 shadow-md ring-1 ring-slate-700/50 backdrop-blur-sm"
            : "bg-transparent"
        )}
      >
        {/* Left Active Marker Accent */}
        {isActive && (
          <div className="absolute left-0 top-3 bottom-3 w-1.5 rounded-r-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        )}

        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            "flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold shadow-inner",
            isActive ? "ring-2 ring-emerald-500/30" : "ring-1 ring-slate-800",
            contact?.avatar_url
              ? "bg-slate-800"
              : "bg-gradient-to-br from-emerald-600/80 to-teal-800/80 text-white"
          )}>
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
          {/* Status Indicator inside Avatar */}
          <span
            className={cn(
              "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-900 shadow-sm",
              STATUS_COLORS[conversation.status]
            )}
            title={conversation.status}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "truncate text-sm font-medium transition-colors",
              isActive ? "text-white font-semibold" : "text-slate-200"
            )}>
              {displayName}
            </span>
            <span className="shrink-0 text-[10px] font-medium text-slate-500 tabular-nums">
              {timeAgo}
            </span>
          </div>
          
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className={cn(
              "truncate text-xs",
              isActive ? "text-slate-300" : "text-slate-400"
            )}>
              {conversation.last_message_text || "No messages yet"}
            </p>
            
            {conversation.unread_count > 0 && (
              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-emerald-500/20">
                {conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
