/**
 * Starter flow templates.
 *
 * Three pre-canned flows users can clone with one click instead of
 * building from scratch. Each template is a plain JS object describing
 * the same shape `/api/flows` PUT accepts — name, trigger config,
 * entry_node_id, fallback_policy, nodes[] — keyed by a stable
 * `slug`.
 *
 * The clone path (`/api/flows` POST with `template_slug`) creates a
 * NEW flow_row + flow_nodes rows for the user. `node_key`s are kept
 * verbatim (they're stable strings, not UUIDs, so cloning never
 * needs to rewrite edge references).
 *
 * Choosing a single static module over a DB-backed gallery for v1
 * because: (a) the set is small and changes with code releases, not
 * data; (b) keeps templates portable across self-hosted instances
 * without migrations; (c) editing in source is the lowest-friction
 * way to add the next template.
 */

import type {
  CollectInputNodeConfig,
  ConditionNodeConfig,
  HandoffNodeConfig,
  KeywordTriggerConfig,
  SendButtonsNodeConfig,
  SendListNodeConfig,
  SendMessageNodeConfig,
  StartNodeConfig,
} from "./types";

export type FlowTemplateNodeType =
  | "start"
  | "send_message"
  | "send_buttons"
  | "send_list"
  | "collect_input"
  | "condition"
  | "set_tag"
  | "handoff"
  | "end";

export interface FlowTemplateNode {
  node_key: string;
  node_type: FlowTemplateNodeType;
  config:
    | StartNodeConfig
    | SendMessageNodeConfig
    | SendButtonsNodeConfig
    | SendListNodeConfig
    | CollectInputNodeConfig
    | ConditionNodeConfig
    | HandoffNodeConfig
    | Record<string, unknown>;
}

export interface FlowTemplate {
  slug: string;
  name: string;
  description: string;
  /** Used by the gallery to surface a relevant icon. lucide-react name. */
  icon: "MessageSquare" | "HelpCircle" | "UserPlus";
  trigger_type: "keyword" | "first_inbound_message" | "manual";
  trigger_config: KeywordTriggerConfig | Record<string, unknown>;
  entry_node_id: string;
  nodes: FlowTemplateNode[];
}

// ============================================================
// 1. Welcome menu — the example from the owner's brief
// ============================================================
const WELCOME_MENU: FlowTemplate = {
  slug: "welcome_menu",
  name: "Welcome menu",
  description:
    "Greet customers who type a keyword and route them to the right agent based on whether they're new or existing.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: ["support", "help", "hi"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_buttons",
      config: {
        text: "Hi! 👋 Welcome to support. Are you an existing customer or new here?",
        footer_text: "Tap a button below to continue.",
        buttons: [
          {
            reply_id: "existing",
            title: "Existing customer",
            next_node_key: "existing_handoff",
          },
          {
            reply_id: "new",
            title: "New customer",
            next_node_key: "new_handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "existing_handoff",
      node_type: "handoff",
      config: {
        note: "Existing customer needs assistance — please check account history before replying.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "new_handoff",
      node_type: "handoff",
      config: {
        note: "New customer — share pricing + onboarding link.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 2. FAQ bot — list-message answers, fully automated
// ============================================================
const FAQ_BOT: FlowTemplate = {
  slug: "faq_bot",
  name: "FAQ bot",
  description:
    "Answer common questions about AYKA Alliance Franchise and AYKA Expert SaaS Clinic Management.",
  icon: "HelpCircle",
  trigger_type: "keyword",
  trigger_config: {
    keywords: ["faq", "help", "question", "pricing", "details"],
    match_type: "contains",
  },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "topics" },
    },
    {
      node_key: "topics",
      node_type: "send_list",
      config: {
        text: "Please select a topic from the FAQ categories below to get instant information:",
        button_label: "View FAQs",
        sections: [
          {
            title: "Franchise Alliance FAQ",
            rows: [
              {
                reply_id: "franchise_fee",
                title: "Franchise Fees & Models",
                next_node_key: "faq_franchise_fee",
              },
              {
                reply_id: "franchise_reqs",
                title: "Alliance Requirements",
                next_node_key: "faq_franchise_reqs",
              },
              {
                reply_id: "franchise_benefits",
                title: "Commissions & Benefits",
                next_node_key: "faq_franchise_benefits",
              },
            ],
          },
          {
            title: "Doctor SaaS FAQ",
            rows: [
              {
                reply_id: "saas_features",
                title: "SaaS Software Features",
                next_node_key: "faq_saas_features",
              },
              {
                reply_id: "saas_pricing",
                title: "SaaS Plans & Pricing",
                next_node_key: "faq_saas_pricing",
              },
            ],
          },
          {
            title: "Support",
            rows: [
              {
                reply_id: "human",
                title: "Talk to our Team",
                next_node_key: "human_handoff",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "faq_franchise_fee",
      node_type: "send_message",
      config: {
        text: "🏢 *AYKA Care Alliance Investment Models:*\n\n1. *City Flagship Alliance:* ₹50,000 Franchise Fee. Ideal for local execution.\n2. *District Alliance:* ₹9 Lakhs (includes setup cost, working capital, and ₹3.5L franchise fee).\n3. *State Alliance:* ₹20 Lakhs (includes setup cost, working capital, and ₹8L franchise fee).\n\nAll models include exclusive territory rights. 📌",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "faq_franchise_reqs",
      node_type: "send_message",
      config: {
        text: "📋 *AYKA Care Alliance Requirements:*\n\n- Medical background or qualifications are *NOT* mandatory.\n- AYKA Care provides training, SOPs, marketing, and the tech platform.\n- District Alliance: Min. 150 sq. ft. office space recommended.\n- State Alliance: Min. 250 sq. ft. office space required.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "faq_franchise_benefits",
      node_type: "send_message",
      config: {
        text: "💰 *Commissions & Alliance Benefits:*\n\n- *City Alliance:* 25%-35% on B2B services | 25% on patient services.\n- *District Alliance:* 15% on B2B services | 15% on patient services.\n- *State Alliance:* 10% on B2B services | 10% on patient services.\n\nBreakeven is typically 90-120 days for City Alliance and 9-12 months for District/State models.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "faq_saas_features",
      node_type: "send_message",
      config: {
        text: "💻 *AYKA Expert Clinic Software Features:*\n\n- Real-time Appointment Scheduling (online & walk-in)\n- Interactive Digital Prescriptions (Hindi + English)\n- Billing, Invoices & Payment Tracking\n- Patient Record Management (EMR)\n- Integrated HD Telemedicine Video Consultations\n- Pharmacy & Lab Entry modules (Premium/Elite plans)",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "faq_saas_pricing",
      node_type: "send_message",
      config: {
        text: "⚡ *AYKA Expert SaaS Plans (GST Extra):*\n\n- *AYKA Lite (1 Doc):* ₹999 (3-mo) | ₹1,999 (6-mo) | ₹2,999 (12-mo)\n- *AYKA Premium (Up to 3 Docs):* ₹1,999 (3-mo) | ₹3,999 (6-mo) | ₹5,999 (12-mo)\n- *AYKA Elite (Enterprise):* ₹3,999 (3-mo) | ₹7,999 (6-mo) | ₹14,999 (12-mo)\n\nAdditional doctors in Premium can be added at ₹499/mo.",
        next_node_key: "end",
      } as SendMessageNodeConfig,
    },
    {
      node_key: "human_handoff",
      node_type: "handoff",
      config: {
        note: "Lead requested custom assistance / human handoff from FAQ Bot.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "end",
      node_type: "end",
      config: {},
    },
  ],
};

// ============================================================
// 3. Lead capture — collect_input chain, ends in a handoff
// ============================================================
const LEAD_CAPTURE: FlowTemplate = {
  slug: "lead_capture",
  name: "Lead capture",
  description:
    "Greet first-time inbounds, ask whether they want Franchise or Doctor SaaS, and capture their lead details.",
  icon: "UserPlus",
  trigger_type: "first_inbound_message",
  trigger_config: {},
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "greet_new" },
    },
    {
      node_key: "greet_new",
      node_type: "send_buttons",
      config: {
        text: "Welcome to AYKA Care! 👋\n\nHow can we help you today? Please choose one of the options below:",
        footer_text: "Select a path:",
        buttons: [
          {
            reply_id: "path_franchise",
            title: "Franchise / Alliance",
            next_node_key: "lead_name_franchise",
          },
          {
            reply_id: "path_doctor",
            title: "Doctor / Clinic SaaS",
            next_node_key: "lead_name_doctor",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "lead_name_franchise",
      node_type: "collect_input",
      config: {
        prompt_text: "Great! Please enter your full name to start the Franchise registration:",
        var_key: "lead_name",
        next_node_key: "lead_occupation_franchise",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "lead_occupation_franchise",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your current occupation / business?",
        var_key: "lead_occupation",
        next_node_key: "lead_city_franchise",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "lead_city_franchise",
      node_type: "collect_input",
      config: {
        prompt_text: "Which city/state are you looking to secure rights for?",
        var_key: "lead_city",
        next_node_key: "confirm_lead_franchise",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "confirm_lead_franchise",
      node_type: "send_buttons",
      config: {
        text: "Thank you {{vars.lead_name}}! We have captured your interest for the AYKA Care Alliance model.\n\n📍 Targeted Territory: {{vars.lead_city}}\n💼 Occupation: {{vars.lead_occupation}}\n\n👉 *Next Step:* Visit our Alliance portal to view detailed projections and calculations:\nhttps://aykaalliance.in",
        footer_text: "Choose an action:",
        buttons: [
          {
            reply_id: "visit_alliance_web",
            title: "Visit Portal",
            next_node_key: "handoff_franchise",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "handoff_franchise",
      node_type: "handoff",
      config: {
        note: "New Lead (Franchise Path) — Name: {{vars.lead_name}}, Occupation: {{vars.lead_occupation}}, Territory: {{vars.lead_city}}.",
      } as HandoffNodeConfig,
    },
    {
      node_key: "lead_name_doctor",
      node_type: "collect_input",
      config: {
        prompt_text: "Great! Please enter your full name (with Dr. prefix if applicable):",
        var_key: "lead_name",
        next_node_key: "lead_specialty_doctor",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "lead_specialty_doctor",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your medical specialty / area of practice?",
        var_key: "lead_specialty",
        next_node_key: "lead_city_doctor",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "lead_city_doctor",
      node_type: "collect_input",
      config: {
        prompt_text: "Which city is your clinic located in?",
        var_key: "lead_city",
        next_node_key: "lead_phone_type_doctor",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "lead_phone_type_doctor",
      node_type: "send_buttons",
      config: {
        text: "Which contact number should our team use to reach you?",
        footer_text: "Choose an option:",
        buttons: [
          {
            reply_id: "same_num",
            title: "Same WhatsApp Number",
            next_node_key: "save_lead_same_phone",
          },
          {
            reply_id: "alt_num",
            title: "Alternate Number",
            next_node_key: "ask_lead_alt_phone",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "save_lead_same_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Perfect! We will use this WhatsApp number to connect. Please reply with 'OK' to confirm and complete registration:",
        var_key: "lead_phone",
        next_node_key: "confirm_lead_doctor",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_lead_alt_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your alternate contact number:",
        var_key: "lead_phone",
        next_node_key: "confirm_lead_doctor",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "confirm_lead_doctor",
      node_type: "send_buttons",
      config: {
        text: "Thank you Dr. {{vars.lead_name}}! 🩺\n\nYour Registration is successful.\n\n📞 Contact: {{vars.lead_phone}}\n📍 City: {{vars.lead_city}}\n🎓 Specialty: {{vars.lead_specialty}}\n\n👉 *Next Step:* Click below to download the AYKA Expert App or visit our website to complete your profile.",
        footer_text: "Choose an action:",
        buttons: [
          {
            reply_id: "visit_expert_web",
            title: "Download & Visit App",
            next_node_key: "handoff_doctor",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "handoff_doctor",
      node_type: "handoff",
      config: {
        note: "New Lead (Doctor Path) — Name: Dr. {{vars.lead_name}}, Specialty: {{vars.lead_specialty}}, City: {{vars.lead_city}}, Contact: {{vars.lead_phone}}.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 4. AYKA Expert — Doctor Telemedicine & SaaS Registration
// ============================================================
const AYKA_EXPERT: FlowTemplate = {
  slug: "ayka_expert",
  name: "AYKA Expert Registration",
  description: "Register doctors/clinics for Telemedicine or request a SaaS Clinic Management Software demo.",
  icon: "UserPlus",
  trigger_type: "keyword",
  trigger_config: { keywords: ["doctor", "expert", "saas", "clinic", "telemedicine"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "greet" },
    },
    {
      node_key: "greet",
      node_type: "send_buttons",
      config: {
        text: "Welcome to AYKA Care Expert Network! 🩺\n\nHow would you like to partner with us today?",
        footer_text: "Select an option below to proceed:",
        buttons: [
          {
            reply_id: "telemedicine",
            title: "Join Telemedicine",
            next_node_key: "ask_doc_name",
          },
          {
            reply_id: "saas_plans",
            title: "Explore SaaS Plans",
            next_node_key: "show_saas_menu",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "show_saas_menu",
      node_type: "send_list",
      config: {
        text: "Select an AYKA LIFE SaaS Plan to view complete details, durational pricing, and features:",
        button_label: "Choose SaaS Plan",
        sections: [
          {
            title: "Clinic SaaS Models",
            rows: [
              {
                reply_id: "lite_plan",
                title: "AYKA Lite (Solo Clinic)",
                next_node_key: "features_lite",
              },
              {
                reply_id: "premium_plan",
                title: "AYKA Premium (3 Docs)",
                next_node_key: "features_premium",
              },
              {
                reply_id: "elite_plan",
                title: "AYKA Elite (Enterprise)",
                next_node_key: "features_elite",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "features_lite",
      node_type: "send_buttons",
      config: {
        text: "🟢 *AYKA LIFE Lite Plan*\n_Solo & Small Clinics (16 Features Included)_\n\n• Appointment Scheduling & Reminders\n• Digital Prescriptions (Hindi + English)\n• Billing, Invoicing & Payment Tracking\n• Patient Feedback & Reviews\n• Clinic Landing Page & Telemedicine\n\n*Durations & Pricing:*\n- *3 Months:* ₹999 (MRP ₹3,499) Save 71%\n- *6 Months:* ₹1,999 (MRP ₹5,999) Save 67%\n- *12 Months:* ₹2,999 (MRP ₹9,999) Save 57%\n_(+ GST extra)_",
        footer_text: "Would you like to book a demo for Lite?",
        buttons: [
          {
            reply_id: "demo_lite",
            title: "Book Demo",
            next_node_key: "ask_saas_name",
          },
          {
            reply_id: "back_to_saas",
            title: "Back to Plans",
            next_node_key: "show_saas_menu",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "features_premium",
      node_type: "send_buttons",
      config: {
        text: "⚡ *AYKA LIFE Premium Plan*\n_Multi-Doctor Clinics (20 Features Included)_\n\n• Everything in Lite (Up to 3 Doctors)\n• Advanced Financial Reports\n• Inventory & Pharmacy module\n• Lab Entry Module\n• Priority Support\n• *Add-On:* ₹499/doctor/mo (above 3 docs)\n\n*Durations & Pricing:*\n- *3 Months:* ₹1,999 (MRP ₹5,499) Save 64%\n- *6 Months:* ₹3,999 (MRP ₹9,999) Save 60%\n- *12 Months:* ₹5,999 (MRP ₹12,999) Save 54%\n_(+ GST extra)_",
        footer_text: "Would you like to book a demo for Premium?",
        buttons: [
          {
            reply_id: "demo_prem",
            title: "Book Demo",
            next_node_key: "ask_saas_name",
          },
          {
            reply_id: "back_to_saas2",
            title: "Back to Plans",
            next_node_key: "show_saas_menu",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "features_elite",
      node_type: "send_buttons",
      config: {
        text: "👑 *AYKA LIFE Elite Plan*\n_Multi-Branch Networks (23 Features Included)_\n\n• Everything in Premium\n• Centralised Scheduling & Multi-Branch Ops\n• AYKA EXPERT Marketplace\n• Dedicated Relationship Manager\n• Unlimited Users (No caps on staff)\n\n*Durations & Pricing:*\n- *3 Months:* ₹3,999 (MRP ₹9,999) Save 60%\n- *6 Months:* ₹7,999 (MRP ₹19,999) Save 60%\n- *12 Months:* ₹14,999 (MRP ₹24,999) Save 40%\n_(+ GST extra)_",
        footer_text: "Would you like to book a demo for Elite?",
        buttons: [
          {
            reply_id: "demo_elite",
            title: "Book Demo",
            next_node_key: "ask_saas_name",
          },
          {
            reply_id: "back_to_saas3",
            title: "Back to Plans",
            next_node_key: "show_saas_menu",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "ask_doc_name",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your full name (with Dr. prefix if applicable):",
        var_key: "doc_name",
        next_node_key: "ask_doc_specialty",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_doc_specialty",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your medical specialty / area of practice?",
        var_key: "doc_specialty",
        next_node_key: "ask_doc_city",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_doc_city",
      node_type: "collect_input",
      config: {
        prompt_text: "Which city is your clinic located in?",
        var_key: "doc_city",
        next_node_key: "ask_doc_phone_type",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_doc_phone_type",
      node_type: "send_buttons",
      config: {
        text: "Which contact number should our team use to reach you?",
        footer_text: "Choose an option:",
        buttons: [
          {
            reply_id: "same_num",
            title: "Same WhatsApp Number",
            next_node_key: "save_doc_same_phone",
          },
          {
            reply_id: "alt_num",
            title: "Alternate Number",
            next_node_key: "ask_doc_alt_phone",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "save_doc_same_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Perfect! We will use this WhatsApp number to connect. Please reply with 'OK' to confirm and complete registration:",
        var_key: "doc_phone",
        next_node_key: "confirm_details",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_doc_alt_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your alternate contact number:",
        var_key: "doc_phone",
        next_node_key: "confirm_details",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "confirm_details",
      node_type: "send_buttons",
      config: {
        text: "Thank you Dr. {{vars.doc_name}}! 🩺\n\nYour Telemedicine registration is successful.\n\n📞 Contact: {{vars.doc_phone}}\n📍 City: {{vars.doc_city}}\n🎓 Specialty: {{vars.doc_specialty}}\n\n👉 *Next Step:* Click below to download the AYKA Expert App or visit our website to complete your profile.",
        footer_text: "Choose an action:",
        buttons: [
          {
            reply_id: "visit_expert_web",
            title: "Download & Visit App",
            next_node_key: "handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "ask_saas_name",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your full name (with Dr. prefix if applicable):",
        var_key: "doc_name",
        next_node_key: "ask_saas_specialty",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_saas_specialty",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your medical specialty / area of practice?",
        var_key: "doc_specialty",
        next_node_key: "ask_saas_city",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_saas_city",
      node_type: "collect_input",
      config: {
        prompt_text: "Which city is your clinic located in?",
        var_key: "doc_city",
        next_node_key: "ask_saas_phone_type",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_saas_phone_type",
      node_type: "send_buttons",
      config: {
        text: "Which contact number should our team use to reach you for the SaaS demo?",
        footer_text: "Choose an option:",
        buttons: [
          {
            reply_id: "same_num_saas",
            title: "Same WhatsApp Number",
            next_node_key: "save_saas_same_phone",
          },
          {
            reply_id: "alt_num_saas",
            title: "Alternate Number",
            next_node_key: "ask_saas_alt_phone",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "save_saas_same_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Perfect! We will use this WhatsApp number. Please reply with 'OK' to confirm and request the demo:",
        var_key: "doc_phone",
        next_node_key: "confirm_saas_details",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_saas_alt_phone",
      node_type: "collect_input",
      config: {
        prompt_text: "Please enter your alternate contact number:",
        var_key: "doc_phone",
        next_node_key: "confirm_saas_details",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "confirm_saas_details",
      node_type: "send_buttons",
      config: {
        text: "Thank you Dr. {{vars.doc_name}}! ⚡\n\nYour Clinic SaaS Demo request has been recorded. Our team will contact you shortly to schedule the session.\n\n📞 Contact: {{vars.doc_phone}}\n📍 City: {{vars.doc_city}}\n🎓 Specialty: {{vars.doc_specialty}}\n\n👉 *Next Step:* Explore our features and modules live on our portal.",
        footer_text: "Choose an action:",
        buttons: [
          {
            reply_id: "visit_saas_web",
            title: "Visit aykaexpert.in",
            next_node_key: "handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New Expert Lead — Name: Dr. {{vars.doc_name}}, Specialty: {{vars.doc_specialty}}, City: {{vars.doc_city}}, Contact: {{vars.doc_phone}}. Telemedicine/SaaS Link sent.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// 5. AYKA Life — Franchise Model Lead Capturing
// ============================================================
const AYKA_LIFE_FRANCHISE: FlowTemplate = {
  slug: "ayka_life_franchise",
  name: "AYKA Life Franchise Model",
  description: "Capture leads for State, District, and City Alliance models.",
  icon: "MessageSquare",
  trigger_type: "keyword",
  trigger_config: { keywords: ["franchise", "ayka life", "investment", "alliance", "partner"], match_type: "contains" },
  entry_node_id: "start",
  nodes: [
    {
      node_key: "start",
      node_type: "start",
      config: { next_node_key: "welcome" },
    },
    {
      node_key: "welcome",
      node_type: "send_list",
      config: {
        text: "Welcome to AYKA Care Expansion Program! 🚀\n\nWe offer three powerful Alliance models across India to transform healthcare.\n\nSelect a model to view complete investment structure, commissions, and register interest:",
        button_label: "Alliance Models",
        sections: [
          {
            title: "Select Alliance Model",
            rows: [
              {
                reply_id: "city_alliance",
                title: "City Alliance (₹3,000)",
                next_node_key: "info_city",
              },
              {
                reply_id: "district_alliance",
                title: "District Alliance (₹9 Lakhs)",
                next_node_key: "info_district",
              },
              {
                reply_id: "state_alliance",
                title: "State Alliance (₹20 Lakhs)",
                next_node_key: "info_state",
              },
            ],
          },
        ],
      } as SendListNodeConfig,
    },
    {
      node_key: "info_city",
      node_type: "send_buttons",
      config: {
        text: "🏢 *AYKA City Alliance*\n• *Total Investment:* ₹3,000\n• *Franchise Fee:* ₹50,000\n• *Working Capital / Setup Cost:* N/A / NIL\n• *Commission:* 25%-35% B2B Services | 25% Patient Services\n• *Breakeven:* 90-120 Days\n• *Office:* Not Required (100% Remote)",
        footer_text: "Would you like to register interest for City Alliance?",
        buttons: [
          {
            reply_id: "yes_city",
            title: "Register Interest",
            next_node_key: "ask_investor_name",
          },
          {
            reply_id: "back_city",
            title: "Go Back",
            next_node_key: "welcome",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "info_district",
      node_type: "send_buttons",
      config: {
        text: "🤝 *AYKA District Alliance*\n• *Total Investment:* ₹9 Lakhs\n• *Franchise Fee:* ₹3.5 Lakhs\n• *Working Capital:* ₹3.5 Lakhs\n• *Setup Cost:* Applicable\n• *Commission:* 15% B2B Services | 15% Patient Services\n• *Breakeven:* 9-12 Months\n• *Office:* Min. 150 sq. ft. recommended",
        footer_text: "Would you like to register interest for District Alliance?",
        buttons: [
          {
            reply_id: "yes_dist",
            title: "Register Interest",
            next_node_key: "ask_investor_name",
          },
          {
            reply_id: "back_dist",
            title: "Go Back",
            next_node_key: "welcome",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "info_state",
      node_type: "send_buttons",
      config: {
        text: "👑 *AYKA State Alliance*\n• *Total Investment:* ₹20 Lakhs\n• *Franchise Fee:* ₹8 Lakhs\n• *Working Capital:* ₹8.5 Lakhs\n• *Setup Cost:* ₹2.5 Lakhs\n• *Commission:* 10% B2B Services | 10% Patient Services\n• *Breakeven:* 9-12 Months\n• *Office:* Min. 250 sq. ft. required",
        footer_text: "Would you like to register interest for State Alliance?",
        buttons: [
          {
            reply_id: "yes_state",
            title: "Register Interest",
            next_node_key: "ask_investor_name",
          },
          {
            reply_id: "back_state",
            title: "Go Back",
            next_node_key: "welcome",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "ask_investor_name",
      node_type: "collect_input",
      config: {
        prompt_text: "Great! Please enter your full name:",
        var_key: "investor_name",
        next_node_key: "ask_investor_occupation",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_investor_occupation",
      node_type: "collect_input",
      config: {
        prompt_text: "What is your current occupation / business?",
        var_key: "investor_occupation",
        next_node_key: "ask_investor_city",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "ask_investor_city",
      node_type: "collect_input",
      config: {
        prompt_text: "Which city/state are you looking to secure Alliance rights for?",
        var_key: "investor_target_location",
        next_node_key: "completion",
      } as CollectInputNodeConfig,
    },
    {
      node_key: "completion",
      node_type: "send_buttons",
      config: {
        text: "Thank you {{vars.investor_name}}! We have captured your interest for the AYKA Care Alliance model.\n\n📍 Targeted Territory: {{vars.investor_target_location}}\n💼 Occupation: {{vars.investor_occupation}}\n\n👉 *Next Step:* Visit our Alliance portal to view detailed projections and calculations:\nhttps://aykaalliance.in",
        footer_text: "Choose an action:",
        buttons: [
          {
            reply_id: "visit_alliance_web",
            title: "Visit Portal",
            next_node_key: "handoff",
          },
        ],
      } as SendButtonsNodeConfig,
    },
    {
      node_key: "handoff",
      node_type: "handoff",
      config: {
        note: "New Alliance Lead — Name: {{vars.investor_name}}, Occupation: {{vars.investor_occupation}}, Territory: {{vars.investor_target_location}}. Projections link sent.",
      } as HandoffNodeConfig,
    },
  ],
};

// ============================================================
// Registry
// ============================================================

const TEMPLATES: Record<string, FlowTemplate> = {
  welcome_menu: WELCOME_MENU,
  faq_bot: FAQ_BOT,
  lead_capture: LEAD_CAPTURE,
  ayka_expert: AYKA_EXPERT,
  ayka_life_franchise: AYKA_LIFE_FRANCHISE,
};

export function getFlowTemplate(slug: string): FlowTemplate | null {
  return TEMPLATES[slug] ?? null;
}

export function listFlowTemplates(): FlowTemplate[] {
  return Object.values(TEMPLATES);
}

