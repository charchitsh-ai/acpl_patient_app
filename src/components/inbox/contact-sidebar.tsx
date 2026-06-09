"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
  Phone,
  Mail,
  Copy,
  Check,
  Tag as TagIcon,
  DollarSign,
  StickyNote,
  Plus,
  ChevronLeft,
  ChevronRight,
  User,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

interface ContactSidebarProps {
  contact: Contact | null;
  /** Controls panel open/closed state (desktop collapsible) */
  isOpen?: boolean;
  /** Callback to toggle the panel */
  onToggle?: () => void;
}

export function ContactSidebar({ contact, isOpen = true, onToggle }: ContactSidebarProps) {
  const [copied, setCopied] = useState(false);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const fetchContactData = useCallback(async () => {
    if (!contact) return;

    const supabase = createClient();

    // Fetch deals, notes, and tags in parallel
    const [dealsRes, notesRes, tagsRes] = await Promise.all([
      supabase
        .from("deals")
        .select("*, stage:pipeline_stages(*)")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_notes")
        .select("*")
        .eq("contact_id", contact.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("contact_tags")
        .select("id, tag_id, tags(*)")
        .eq("contact_id", contact.id),
    ]);

    if (dealsRes.data) setDeals(dealsRes.data);
    if (notesRes.data) setNotes(notesRes.data);
    if (tagsRes.data) {
      const mapped = tagsRes.data
        .filter((ct: Record<string, unknown>) => ct.tags)
        .map((ct: Record<string, unknown>) => ({
          ...(ct.tags as Tag),
          contact_tag_id: ct.id as string,
        }));
      setTags(mapped);
    }
  }, [contact]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote]);

  // ── Collapsed strip ────────────────────────────────────────────────
  // When the panel is closed we render only a thin toggle strip so the
  // user can expand it without the panel taking up real estate.
  if (!isOpen) {
    return (
      <div className="flex h-full w-12 flex-col items-center border-l border-slate-800/80 bg-slate-900/95">
        <button
          type="button"
          onClick={onToggle}
          title="Open contact panel"
          aria-label="Open contact details panel"
          className="mt-3 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {/* Rotated label for visual cue */}
        <span
          className="mt-6 select-none text-[9px] font-semibold uppercase tracking-widest text-slate-600"
          style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
        >
          Contact
        </span>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────
  if (!contact) {
    return (
      <div className="flex h-full w-full flex-col border-l border-slate-800/80 bg-slate-900/95">
        {/* Toggle button */}
        <div className="flex shrink-0 items-center justify-end border-b border-slate-800/60 px-3 py-2.5">
          <button
            type="button"
            onClick={onToggle}
            title="Collapse contact panel"
            aria-label="Collapse contact details panel"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-800/60 ring-1 ring-slate-700/40">
            <User className="h-6 w-6 text-slate-500" />
          </div>
          <p className="mt-3 text-sm font-medium text-slate-400">No contact selected</p>
          <p className="mt-1 text-xs text-slate-600">
            Select a conversation to view contact details
          </p>
        </div>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-full flex-col border-l border-slate-800/80 bg-slate-900/95">
      {/* ── Panel header with collapse toggle ──────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-800/60 px-3 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          Contact Details
        </span>
        <button
          type="button"
          onClick={onToggle}
          title="Collapse contact panel"
          aria-label="Collapse contact details panel"
          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-5">

          {/* ── Contact Card ──────────────────────────────────────── */}
          <div className="flex flex-col items-center text-center">
            {/* Avatar with gradient and ring */}
            <div className="relative">
              <div
                className={cn(
                  "flex h-16 w-16 items-center justify-center rounded-full text-lg font-bold text-white shadow-lg ring-2 ring-primary/30",
                  contact.avatar_url
                    ? "bg-slate-700"
                    : "bg-gradient-to-br from-primary/80 to-emerald-600/80",
                )}
              >
                {contact.avatar_url ? (
                  <img
                    src={contact.avatar_url}
                    alt={displayName}
                    className="h-16 w-16 rounded-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              {/* Online indicator */}
              <span className="absolute bottom-0.5 right-0.5 h-3.5 w-3.5 rounded-full border-2 border-slate-900 bg-emerald-500 shadow-sm shadow-emerald-500/40" />
            </div>

            <h3 className="mt-3 text-sm font-semibold text-white leading-tight">
              {displayName}
            </h3>
            {contact.company && (
              <p className="mt-0.5 text-xs text-slate-400">{contact.company}</p>
            )}
          </div>

          {/* ── Contact Info ──────────────────────────────────────── */}
          <div className="space-y-1.5">
            <button
              onClick={handleCopyPhone}
              className="group flex w-full items-center gap-2.5 rounded-xl border border-slate-800/60 bg-slate-800/30 px-3 py-2.5 text-sm text-slate-300 transition-all hover:border-slate-700 hover:bg-slate-800/60"
              aria-label="Copy phone number"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10">
                <Phone className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="flex-1 text-left text-xs font-medium tabular-nums text-slate-200">
                {contact.phone}
              </span>
              {copied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/60 bg-slate-800/30 px-3 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/10">
                  <Mail className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <span className="truncate text-xs text-slate-300">{contact.email}</span>
              </div>
            )}
          </div>

          {/* ── Tags ──────────────────────────────────────────────── */}
          <SectionBlock icon={<TagIcon className="h-3.5 w-3.5" />} title="Tags" accentColor="text-violet-400">
            <div className="flex flex-wrap gap-1.5">
              {tags.length === 0 ? (
                <p className="text-xs text-slate-600">No tags assigned</p>
              ) : (
                tags.map((tag) => (
                  <span
                    key={tag.contact_tag_id}
                    className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                    style={{
                      backgroundColor: `${tag.color}18`,
                      color: tag.color,
                      boxShadow: `0 0 0 1px ${tag.color}30`,
                    }}
                  >
                    {tag.name}
                  </span>
                ))
              )}
            </div>
          </SectionBlock>

          {/* ── Active Deals ──────────────────────────────────────── */}
          <SectionBlock icon={<DollarSign className="h-3.5 w-3.5" />} title="Active Deals" accentColor="text-amber-400">
            <div className="space-y-2">
              {deals.length === 0 ? (
                <p className="text-xs text-slate-600">No active deals</p>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.id}
                    className="rounded-xl border border-slate-800/60 bg-slate-800/40 px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-white leading-tight">
                        {deal.title}
                      </p>
                      {deal.stage && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                          style={{
                            backgroundColor: `${deal.stage.color}18`,
                            color: deal.stage.color,
                          }}
                        >
                          {deal.stage.name}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-emerald-400">
                      <TrendingUp className="h-3 w-3" />
                      {deal.currency ?? "$"}
                      {deal.value.toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SectionBlock>

          {/* ── Notes ─────────────────────────────────────────────── */}
          <SectionBlock icon={<StickyNote className="h-3.5 w-3.5" />} title="Notes" accentColor="text-yellow-400">
            <div className="space-y-2">
              {/* Add note input */}
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      handleAddNote();
                    }
                  }}
                  placeholder="Add a note… (⌘ Enter to save)"
                  rows={2}
                  aria-label="New note"
                  className="flex-1 resize-none rounded-xl border border-slate-700/60 bg-slate-800/50 px-3 py-2 text-xs text-white placeholder-slate-500 outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                />
                <Button
                  size="sm"
                  className="h-auto self-end rounded-xl bg-primary px-2 py-2 hover:bg-primary/90 disabled:opacity-40"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                  aria-label="Save note"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Notes list */}
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-xl border border-slate-800/60 bg-slate-800/30 px-3 py-2.5"
                >
                  <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-300">
                    {note.note_text}
                  </p>
                  <p className="mt-1.5 text-[10px] text-slate-600">
                    {format(new Date(note.created_at), "MMM d, yyyy · HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          </SectionBlock>

        </div>
      </div>
    </div>
  );
}

// ── Reusable section block ───────────────────────────────────────────
interface SectionBlockProps {
  icon: React.ReactNode;
  title: string;
  accentColor: string;
  children: React.ReactNode;
}

function SectionBlock({ icon, title, accentColor, children }: SectionBlockProps) {
  return (
    <div>
      <div className={cn("mb-2.5 flex items-center gap-2", accentColor)}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">
          {title}
        </span>
        <div className="h-px flex-1 bg-slate-800/80" />
      </div>
      {children}
    </div>
  );
}
