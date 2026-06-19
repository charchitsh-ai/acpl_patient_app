"use client";

import { useMemo, useState } from "react";
import {
  Bot,
  Check,
  ClipboardList,
  Clock3,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserRound,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type BotTone = "friendly" | "direct" | "premium";

interface IntentRule {
  id: string;
  name: string;
  keywords: string;
  reply: string;
  enabled: boolean;
}

interface ChatMessage {
  id: string;
  role: "visitor" | "bot" | "system";
  text: string;
  matchedIntent?: string;
}

const DEFAULT_RULES: IntentRule[] = [
  {
    id: "alliance-franchise",
    name: "Alliance / Franchise Lead",
    keywords: "franchise, alliance, partner, investment, business, territory, district, state, city",
    reply:
      "AYKA Care has City, District, and State Alliance models. To qualify your lead, please share your name, city or target territory, current occupation, and investment range. Our expansion team will guide you with the right model.",
    enabled: true,
  },
  {
    id: "clinic-software",
    name: "Clinic Software Lead",
    keywords: "software, clinic, doctor, hospital, ayka expert, ayka life, saas, prescription, appointment",
    reply:
      "AYKA Expert helps clinics manage appointments, digital prescriptions, billing, patient records, telemedicine, and reports. Please share doctor or clinic name, city, specialty, number of doctors, and the best time for a demo.",
    enabled: true,
  },
  {
    id: "pricing",
    name: "Plans and Pricing",
    keywords: "price, pricing, cost, plan, package, subscription, lite, premium, elite",
    reply:
      "AYKA Expert has Lite, Premium, and Elite plans for different clinic sizes. Tell me whether you are a solo clinic, multi-doctor clinic, or multi-branch setup, and I will route you to the right sales advisor.",
    enabled: true,
  },
  {
    id: "demo",
    name: "Demo / Sales Call",
    keywords: "demo, call, meeting, walkthrough, talk, callback, contact",
    reply:
      "I can help schedule a sales call. Please share your name, WhatsApp number, city, interest area, and a preferred callback time.",
    enabled: true,
  },
  {
    id: "patient-service",
    name: "Patient Service Inquiry",
    keywords: "appointment, patient, consult, consultation, treatment, health checkup, doctor appointment",
    reply:
      "For patient service inquiries, please share patient name, city, required service or specialty, and preferred appointment time. Our team will connect you with the right care support.",
    enabled: true,
  },
];

const STARTER_MESSAGES: ChatMessage[] = [
  {
    id: "hello",
    role: "bot",
    text: "Welcome to AYKA Care. I can help with Alliance/franchise opportunities, clinic software demos, pricing, and patient service inquiries. What are you interested in today?",
  },
];

const QUALIFICATION_FIELDS = [
  "Name",
  "Phone / WhatsApp number",
  "City or target territory",
  "Interest: Alliance, clinic software, or patient service",
  "Occupation or clinic specialty",
  "Budget / plan interest",
  "Preferred callback time",
];

const TEST_PROMPTS = [
  "I want franchise details for Patna",
  "Need clinic software demo for 3 doctors",
  "What is the pricing for AYKA Expert?",
  "Book a callback tomorrow",
];

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function splitKeywords(value: string) {
  return value
    .split(",")
    .map((keyword) => keyword.trim().toLowerCase())
    .filter(Boolean);
}

function tonePrefix(tone: BotTone) {
  switch (tone) {
    case "direct":
      return "";
    case "premium":
      return "Certainly. ";
    default:
      return "Sure. ";
  }
}

export function ChatbotBuilder() {
  const [enabled, setEnabled] = useState(true);
  const [handoff, setHandoff] = useState(true);
  const [businessName, setBusinessName] = useState("AYKA Care");
  const [welcomeMessage, setWelcomeMessage] = useState(
    "Welcome to AYKA Care. I can help with Alliance/franchise opportunities, clinic software demos, pricing, and patient service inquiries. What are you interested in today?",
  );
  const [fallbackReply, setFallbackReply] = useState(
    "I can still capture your details for the AYKA Care team. Please share your name, phone number, city, and what you need help with.",
  );
  const [tone, setTone] = useState<BotTone>("friendly");
  const [rules, setRules] = useState<IntentRule[]>(DEFAULT_RULES);
  const [messages, setMessages] = useState<ChatMessage[]>(STARTER_MESSAGES);
  const [draft, setDraft] = useState("");

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);

  function updateRule(id: string, patch: Partial<IntentRule>) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  }

  function addRule() {
    const next: IntentRule = {
      id: createId("intent"),
      name: "New sales intent",
      keywords: "keyword, lead, inquiry",
      reply:
        "Thanks for your interest in AYKA Care. Please share your name, city, phone number, and requirement so our sales team can follow up.",
      enabled: true,
    };

    setRules((current) => [...current, next]);
  }

  function removeRule(id: string) {
    setRules((current) => current.filter((rule) => rule.id !== id));
  }

  function resetChat() {
    setMessages([
      {
        id: createId("welcome"),
        role: "bot",
        text: welcomeMessage,
      },
    ]);
  }

  function findReply(input: string) {
    const normalized = input.toLowerCase();
    const match = activeRules.find((rule) =>
      splitKeywords(rule.keywords).some((keyword) => normalized.includes(keyword)),
    );

    if (!match) {
      return {
        text: handoff ? `${fallbackReply} I will mark this for human follow-up.` : fallbackReply,
        matchedIntent: undefined,
      };
    }

    return {
      text: `${tonePrefix(tone)}${match.reply}`,
      matchedIntent: match.name,
    };
  }

  function sendMessage() {
    const text = draft.trim();
    if (!text) return;

    const reply = enabled
      ? findReply(text)
      : {
          text: "The chatbot is currently paused. A teammate will need to reply manually.",
          matchedIntent: undefined,
        };

    setMessages((current) => [
      ...current,
      { id: createId("visitor"), role: "visitor", text },
      {
        id: createId("bot"),
        role: enabled ? "bot" : "system",
        text: reply.text,
        matchedIntent: reply.matchedIntent,
      },
    ]);
    setDraft("");
  }

  const coverageLabel =
    activeRules.length === 0
      ? "No active intents"
      : `${activeRules.length} active intent${activeRules.length === 1 ? "" : "s"}`;

  return (
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="size-5" />
            </div>
            <h1 className="text-2xl font-bold text-white">Chatbot</h1>
            <Badge className="border-primary/30 bg-primary/10 text-primary">
              Builder
            </Badge>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">
            Configure AYKA Care&apos;s first-response sales bot for WhatsApp, qualify leads,
            and test the handoff script before wiring it into automations.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">Bot status</p>
            <p className="text-xs text-slate-400">{enabled ? "Replies are enabled" : "Replies are paused"}</p>
          </div>
          <Switch checked={enabled} onCheckedChange={(value) => setEnabled(!!value)} />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-h-0 space-y-5">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Sparkles className="size-4 text-primary" />
                Bot behavior
              </CardTitle>
              <CardDescription className="text-slate-400">
                Set the default voice and fallback path for sales and lead-generation chats.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-slate-300">Business name</Label>
                <Input
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Tone</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["friendly", "direct", "premium"] as BotTone[]).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTone(option)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                        tone === option
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:text-white",
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label className="text-slate-300">Welcome message</Label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(event) => setWelcomeMessage(event.target.value)}
                  rows={3}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <div className="space-y-2 lg:col-span-2">
                <Label className="text-slate-300">Fallback reply</Label>
                <Textarea
                  value={fallbackReply}
                  onChange={(event) => setFallbackReply(event.target.value)}
                  rows={3}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
                <span>
                  <span className="block text-sm font-medium text-white">Human handoff</span>
                  <span className="block text-xs text-slate-400">
                    Mark unmatched or high-intent inquiries for the AYKA sales team.
                  </span>
                </span>
                <Switch checked={handoff} onCheckedChange={(value) => setHandoff(!!value)} />
              </label>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Target className="size-4 text-primary" />
                  Sales intent rules
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Match WhatsApp keywords, qualify the lead, and route the conversation.
                </CardDescription>
              </div>
              <Button onClick={addRule} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Plus className="size-4" />
                Add intent
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {rules.map((rule) => (
                <div key={rule.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(value) => updateRule(rule.id, { enabled: !!value })}
                      />
                      <Badge
                        className={cn(
                          rule.enabled
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-slate-700 bg-slate-800 text-slate-400",
                        )}
                      >
                        {rule.enabled ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRule(rule.id)}
                      aria-label="Delete intent"
                      className="text-slate-400 hover:bg-red-950/40 hover:text-red-300"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Intent name</Label>
                      <Input
                        value={rule.name}
                        onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                        className="border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-slate-300">Keywords</Label>
                      <Input
                        value={rule.keywords}
                        onChange={(event) => updateRule(rule.id, { keywords: event.target.value })}
                        className="border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                    <div className="space-y-2 lg:col-span-2">
                      <Label className="text-slate-300">Bot reply</Label>
                      <Textarea
                        value={rule.reply}
                        onChange={(event) => updateRule(rule.id, { reply: event.target.value })}
                        rows={3}
                        className="border-slate-700 bg-slate-800 text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="flex min-h-[680px] flex-col gap-5 xl:min-h-0">
          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Launch checklist</CardTitle>
              <CardDescription className="text-slate-400">
                What is ready before connecting this to AYKA Care WhatsApp.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ChecklistRow done={enabled} label="Bot is enabled" />
              <ChecklistRow done={activeRules.length > 0} label={coverageLabel} />
              <ChecklistRow done={handoff} label="Human handoff is configured" />
              <ChecklistRow done={welcomeMessage.trim().length > 0} label="Welcome message is set" />
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <ClipboardList className="size-4 text-primary" />
                Lead capture fields
              </CardTitle>
              <CardDescription className="text-slate-400">
                Details the bot should collect before sales handoff.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {QUALIFICATION_FIELDS.map((field) => (
                  <li
                    key={field}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-sm text-slate-300"
                  >
                    <Check className="size-3.5 text-primary" />
                    {field}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card className="flex min-h-0 flex-1 flex-col border-slate-800 bg-slate-900">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div>
                <CardTitle className="text-white">Simulator</CardTitle>
              <CardDescription className="text-slate-400">
                  Test common AYKA Care sales inquiries in real time.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={resetChat}
                aria-label="Reset chat"
                className="text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <RotateCcw className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3">
                <div className="mb-1 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Bot className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{businessName || "Chatbot"}</p>
                      <p className="text-xs text-slate-400">{enabled ? "Online" : "Paused"}</p>
                    </div>
                  </div>
                  <Clock3 className="size-4 text-slate-500" />
                </div>

                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex gap-2",
                      message.role === "visitor" ? "justify-end" : "justify-start",
                    )}
                  >
                    {message.role !== "visitor" && (
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Bot className="size-3.5" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[78%] rounded-lg px-3 py-2 text-sm leading-5",
                        message.role === "visitor"
                          ? "bg-primary text-primary-foreground"
                          : message.role === "system"
                            ? "border border-amber-500/30 bg-amber-500/10 text-amber-100"
                            : "bg-slate-800 text-slate-100",
                      )}
                    >
                      <p>{message.text}</p>
                      {message.matchedIntent && (
                        <p className="mt-2 text-[11px] text-primary">Matched: {message.matchedIntent}</p>
                      )}
                    </div>
                    {message.role === "visitor" && (
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-300">
                        <UserRound className="size-3.5" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  sendMessage();
                }}
              >
                <Input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Try: I want franchise details"
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
                <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="size-4" />
                </Button>
              </form>

              <div className="flex flex-wrap gap-2">
                {TEST_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setDraft(prompt)}
                    className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-primary/50 hover:text-white"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <span
        className={cn(
          "flex size-5 shrink-0 items-center justify-center rounded-full border",
          done
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
            : "border-slate-700 bg-slate-800 text-slate-500",
        )}
      >
        {done && <Check className="size-3" />}
      </span>
      <span className={cn("text-sm", done ? "text-slate-200" : "text-slate-500")}>{label}</span>
    </div>
  );
}
