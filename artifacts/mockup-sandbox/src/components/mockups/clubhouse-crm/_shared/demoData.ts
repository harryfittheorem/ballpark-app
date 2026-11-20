import {
  Activity, Ban, CalendarClock, CircleHelp, Clock3, FileText, Flag, GitBranch,
  Inbox, Layers3, ListChecks, MessageCircle, Send, Settings2, ShieldCheck, Tag,
  UserRound, Users, Workflow, Zap
} from "lucide-react";

export type View = "Overview" | "Contacts" | "Conversations" | "Opportunities" | "Workflows" | "Templates" | "Reports" | "Tags & Audiences" | "Settings" | "Exception review";
export type Thread = { id: number; adult: string; athlete: string; initials: string; preview: string; time: string; location: string; unread?: boolean; assigned: string; consent: "Eligible" | "Opted out" | "Review"; messages: { from: string; text: string; time: string; kind?: "internal" | "scheduled" }[]; tags: string[]; phone: string };
export type NodeKind = "trigger" | "condition" | "wait" | "reply timeout" | "SMS" | "internal action" | "tag-add" | "tag-remove" | "goal exit";
export type FlowNode = { id: number; kind: NodeKind; title: string; detail: string; timing?: string };

export const NAV: { name: View; icon: typeof Inbox; count?: string }[] = [
  { name: "Overview", icon: Activity }, { name: "Conversations", icon: Inbox, count: "4" },
  { name: "Contacts", icon: Users }, { name: "Opportunities", icon: Layers3 },
  { name: "Workflows", icon: Workflow, count: "2" }, { name: "Templates", icon: FileText },
  { name: "Reports", icon: ListChecks }, { name: "Tags & Audiences", icon: Tag },
  { name: "Settings", icon: Settings2 }, { name: "Exception review", icon: CircleHelp },
];
export const LOCATIONS = ["North Loop · Austin", "Cedar Park · Austin", "Round Rock · Austin"];
export const sampleThreads: Thread[] = [
  { id: 1, adult: "Mara Chen", athlete: "Eli Chen", initials: "MC", preview: "Could we move Eli's evaluation to Thursday?", time: "9:42a", location: LOCATIONS[0], unread: true, assigned: "You", consent: "Eligible", phone: "(512) 555-0184", tags: ["Evaluation booked", "Interested · camps"], messages: [
    { from: "Mara Chen", text: "Hi! Eli is feeling better. Could we move his evaluation to Thursday afternoon?", time: "9:42 AM" },
    { from: "You", text: "Of course. I’ll check Thursday availability and get right back to you.", time: "9:44 AM" },
    { from: "You · private note", text: "Check with Coach Devon before offering a slot. Original visit was Tuesday.", time: "9:46 AM", kind: "internal" }
  ] },
  { id: 2, adult: "Jordan Alvarez", athlete: "Sofia & Mateo", initials: "JA", preview: "Thanks, we’ll be there at 5:30.", time: "9:18a", location: LOCATIONS[0], assigned: "Devon", consent: "Eligible", phone: "(512) 555-0119", tags: ["Member", "Two athletes"], messages: [
    { from: "Jordan Alvarez", text: "Thanks, we’ll be there at 5:30. Sofia is excited to try the new HitTrax.", time: "9:18 AM" },
    { from: "Clubhouse · North Loop", text: "Thursday works. I have you down for 5:30 PM with Coach Devon.", time: "9:04 AM" }
  ] },
  { id: 3, adult: "Priya Shah", athlete: "Nikhil Shah", initials: "PS", preview: "STOP", time: "Yesterday", location: LOCATIONS[0], assigned: "Unassigned", consent: "Opted out", phone: "(512) 555-0141", tags: ["Evaluation"], messages: [
    { from: "Priya Shah", text: "STOP", time: "Yesterday · 4:12 PM" },
    { from: "System", text: "Opt-out recorded for SMS. Future outreach is blocked.", time: "Yesterday · 4:12 PM", kind: "internal" }
  ] },
  { id: 4, adult: "Evan Brooks", athlete: "Tessa Brooks", initials: "EB", preview: "Which location is this for?", time: "Yesterday", location: LOCATIONS[0], assigned: "You", consent: "Review", phone: "(512) 555-0170", tags: ["New lead"], messages: [
    { from: "Evan Brooks", text: "We have two kids in different programs. Which evaluation is this for?", time: "Yesterday · 3:28 PM" },
    { from: "You · private note", text: "Shared household number. Confirm the guardian and athlete before replying.", time: "Yesterday · 3:30 PM", kind: "internal" }
  ] },
  { id: 5, adult: "Nina Patel", athlete: "Arjun Patel", initials: "NP", preview: "We'd love details on summer camp.", time: "Mon", location: LOCATIONS[1], assigned: "Leah", consent: "Eligible", phone: "(737) 555-0163", tags: ["Interested · camps"], messages: [{ from: "Nina Patel", text: "We'd love details on summer camp.", time: "Mon · 10:16 AM" }] },
];
export const families = [
  { adult: "Mara Chen", initials: "MC", athletes: "Eli Chen", location: "North Loop", membership: "Prospect", tags: ["Evaluation booked", "Interested · camps"], last: "Today, 9:42 AM", status: "Active" },
  { adult: "Jordan Alvarez", initials: "JA", athletes: "Sofia Alvarez · Mateo Alvarez", location: "North Loop", membership: "Member", tags: ["Member", "Two athletes"], last: "Today, 9:18 AM", status: "Active" },
  { adult: "Priya Shah", initials: "PS", athletes: "Nikhil Shah", location: "North Loop", membership: "Prospect", tags: ["Evaluation"], last: "Yesterday", status: "Opted out" },
  { adult: "Evan Brooks", initials: "EB", athletes: "Tessa Brooks · Kai Brooks", location: "North Loop", membership: "Lead", tags: ["New lead"], last: "Yesterday", status: "Review" },
  { adult: "Nina Patel", initials: "NP", athletes: "Arjun Patel", location: "Cedar Park", membership: "Member", tags: ["Interested · camps"], last: "Monday", status: "Active" },
  { adult: "Theo Rivera", initials: "TR", athletes: "June Rivera", location: "North Loop", membership: "Lead", tags: ["New lead", "Trial"], last: "Friday", status: "Active" },
];
export const DEALS = [
  { name: "Eli Chen · Evaluation", family: "Mara Chen", stage: "Evaluation booked", value: "$0", owner: "Devon", due: "Thu, 4:30 PM", tags: ["Baseball", "Sibling context"] },
  { name: "Sofia Alvarez · Skills plan", family: "Jordan Alvarez", stage: "Proposal", value: "$189/mo", owner: "You", due: "Today", tags: ["Member", "Renewal"] },
  { name: "Mateo Alvarez · Trial", family: "Jordan Alvarez", stage: "New inquiry", value: "$0", owner: "Leah", due: "Tomorrow", tags: ["Trial"] },
  { name: "Nikhil Shah · Evaluation", family: "Priya Shah", stage: "Needs follow-up", value: "$0", owner: "Unassigned", due: "Overdue", tags: ["Opt-out review"] },
  { name: "Tessa Brooks · Camp", family: "Evan Brooks", stage: "New inquiry", value: "$240", owner: "You", due: "Fri", tags: ["Summer camp"] },
  { name: "Arjun Patel · Membership", family: "Nina Patel", stage: "Won", value: "$169/mo", owner: "Leah", due: "Jun 2", tags: ["Member"] },
];
export const STAGES = ["New inquiry", "Needs follow-up", "Evaluation booked", "Proposal", "Won"];
export const DEFAULT_FLOW: FlowNode[] = [
  { id: 1, kind: "trigger", title: "New evaluation lead", detail: "Trigger · opportunity created at this location", timing: "On opportunity created" },
  { id: 2, kind: "condition", title: "Guardian eligible for SMS?", detail: "Consent = eligible · recipient is an adult", timing: "At enrollment and execution" },
  { id: 3, kind: "SMS", title: "Send a personal introduction", detail: "SMS · approved template · location sender", timing: "Next eligible local time" },
  { id: 4, kind: "wait", title: "Wait 2 days", detail: "Respect local quiet hours · recalculate on reschedule", timing: "2 days · appointment-relative" },
  { id: 5, kind: "reply timeout", title: "Any reply from guardian?", detail: "Branch · human takeover stops automation", timing: "Wait until reply or timeout" },
  { id: 6, kind: "internal action", title: "Create staff follow-up task", detail: "No outreach · due next business day", timing: "Next business day" },
  { id: 7, kind: "goal exit", title: "Evaluation booked", detail: "Exit when authoritative booking is recorded", timing: "On booking event" },
];
export const CATALOG: { kind: NodeKind; label: string; icon: typeof Zap }[] = [
  { kind: "trigger", label: "Trigger", icon: Zap }, { kind: "condition", label: "Condition", icon: GitBranch },
  { kind: "wait", label: "Wait / date", icon: Clock3 }, { kind: "reply timeout", label: "Reply timeout", icon: MessageCircle },
  { kind: "SMS", label: "SMS reply", icon: Send }, { kind: "internal action", label: "Internal action", icon: ListChecks },
  { kind: "tag-add", label: "Add tag", icon: Tag }, { kind: "tag-remove", label: "Remove tag", icon: Ban },
  { kind: "goal exit", label: "Goal / exit", icon: Flag },
];
export const TEMPLATE_TEXT = "Hi {{guardian_first}}, it’s the Clubhouse North Loop team. We’re looking forward to {{athlete_first}}’s evaluation. Reply here if you need to adjust the time.";
export const EXCEPTIONS = [
  ["Empty queue", "No conversations match this queue. Try widening the filter or check another staff view.", "Clear filters"],
  ["Channel unconfigured", "SMS sender is not connected for Cedar Park. Drafts stay local; no fallback sender is used.", "Open location settings"],
  ["Forbidden action", "Instructor access is limited to assigned guardian context. Billing and direct-to-athlete messages are hidden.", "Review role boundaries"],
  ["Opt-out", "Priya Shah opted out yesterday. Queued and new SMS are blocked at execution, regardless of tags.", "View suppression record"],
  ["Ambiguous guardian", "Shared phone matches two adults. Confirm the intended guardian before any outward reply.", "Request ownership review"],
  ["Offline draft", "Draft saved on this device only. It has not been sent or queued.", "Keep editing"],
  ["Stale ownership", "Devon reassigned this thread while you were composing. Your draft is preserved for review.", "Re-check ownership"],
  ["Rescheduled visit", "The evaluation moved to Thursday. Existing reminder timing must recalculate before a run continues.", "Inspect run"],
  ["Duplicate trigger", "This event already enrolled a run. Idempotency key prevented a duplicate entry.", "Open run history"],
  ["Unknown send", "Provider outcome is unknown. Do not retry until the event is investigated.", "Investigate event"],
  ["AI unavailable", "Summary service is unavailable. The complete manual thread remains usable.", "Try summary again"],
  ["Stale summary", "Summary is older than the latest inbound message. Review the source thread before using it.", "Refresh evidence"],
  ["Insufficient evidence", "No verified source supports a promise about pricing or availability.", "Write manually"],
  ["Approval declined", "A reviewer declined this workflow proposal. Nothing was published.", "View reviewer note"],
];
export function initials(name: string) { return name.split(" ").map(p => p[0]).slice(0, 2).join(""); }
export function classForStatus(s: string) { return s === "Active" || s === "Eligible" || s === "Won" ? "green" : s === "Opted out" ? "red" : s === "Review" ? "blue" : "neutral"; }
