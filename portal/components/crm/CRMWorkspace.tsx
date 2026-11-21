"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CRMCommand, CRMEvent, CRMState, CRMThread, CRMView, CRMSlot } from "@/lib/crm/types";
import { PREVIEW_LOCATION } from "@/lib/crm/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select, TextArea } from "@/components/ui/Input";
import "./crm.css";
import CRMPilotPanel from "./CRMPilotPanel";

type LocationOption = { id: string; name: string };
type CRMResponse = { state: CRMState; locations?: LocationOption[]; location_id?: string; error?: string };
const VIEWS: { id: CRMView; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "inbox", label: "Inbox" },
  { id: "pipeline", label: "Pipeline" },
  { id: "workflows", label: "Workflows" },
];
const STAGES = ["New inquiry", "In follow-up", "Evaluation booked"];
const dateTime = (value?: string | null, timezone?: string) => {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", ...(timezone ? { timeZone: timezone } : {}) }).format(date);
};
const shortTime = (value?: string) => value ? dateTime(value).replace(/,/, " ·") : "";

export default function CRMWorkspace({ preview = false }: { preview?: boolean }) {
  const [view, setView] = useState<CRMView>("overview");
  const [state, setState] = useState<CRMState | null>(null);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationId, setLocationId] = useState<string>(preview ? PREVIEW_LOCATION : "");
  const [selectedId, setSelectedId] = useState("");
  const [mobileThread, setMobileThread] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const contextRef = useRef<HTMLElement>(null);
  const contextButtonRef = useRef<HTMLButtonElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [composer, setComposer] = useState<"sms" | "note">("sms");
  const [smsDraft, setSmsDraft] = useState("");
  const [noteDraft, setNoteDraft] = useState("");
  const [callbackReason, setCallbackReason] = useState("");
  const [consentReason, setConsentReason] = useState("");
  const [consentChannel, setConsentChannel] = useState<"sms" | "voice">("sms");
  const [recipientZone, setRecipientZone] = useState("");
  const [verificationEvidence, setVerificationEvidence] = useState("");
  const [verifyFamily, setVerifyFamily] = useState("");
  const [verifyKid, setVerifyKid] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [prospectName, setProspectName] = useState("");
  const [prospectAge, setProspectAge] = useState("");
  const [outcome, setOutcome] = useState<"no-answer" | "completed" | "busy" | "failed">("no-answer");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [workflowText, setWorkflowText] = useState("");
  const [delay, setDelay] = useState("30");
  const [authority, setAuthority] = useState<"draft" | "delegated">("draft");
  const [workflowEnabled, setWorkflowEnabled] = useState(false);
  const [workflowPreview, setWorkflowPreview] = useState(false);
  const [rehearsalText, setRehearsalText] = useState("");

  const reload = useCallback(async (id?: string) => {
    setLoading(true);
    setLoadError("");
    try {
      const chosen = id ?? locationId;
      const query = new URLSearchParams();
      if (preview) query.set("preview", "1");
      if (chosen) query.set("location_id", chosen);
      const response = await fetch(`/api/crm${query.size ? `?${query.toString()}` : ""}`, { credentials: "include", headers: { Accept: "application/json" } });
      const payload = await response.json() as CRMResponse;
      if (!response.ok || payload.error || !payload.state) throw new Error(payload.error || `Could not load CRM (${response.status}).`);
      setState(payload.state);
      setLocations(payload.locations ?? []);
      setLocationId(payload.location_id ?? payload.state.location.id);
      setSelectedId((current) => payload.state.threads.some((thread) => thread.id === current) ? current : (payload.state.threads[0]?.id ?? ""));
      setWorkflowText(payload.state.workflow.wording);
      setDelay(String(payload.state.workflow.delay_minutes));
      setAuthority(payload.state.workflow.authority);
      setWorkflowEnabled(payload.state.workflow.enabled);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The CRM connection could not be reached.");
    } finally {
      setLoading(false);
    }
  }, [locationId, preview]);

  useEffect(() => { void reload(); }, [reload]);

  const thread = useMemo(() => state?.threads.find((item) => item.id === selectedId) ?? null, [state, selectedId]);
  const savedSMS = thread?.sms_draft ?? "", savedNote = thread?.note_draft ?? "", savedSelection = thread?.selection ?? "";
  // A new receipt/takeover revision must not overwrite unsaved staff typing.
  useEffect(() => { setSmsDraft(savedSMS); }, [selectedId, savedSMS]);
  useEffect(() => { setNoteDraft(savedNote); }, [selectedId, savedNote]);
  useEffect(() => { setSelectedSlot(savedSelection); }, [selectedId, savedSelection]);
  const savedParent = thread?.parent ?? "", savedAthlete = thread?.athlete ?? "", savedAge = thread?.age;
  useEffect(() => {
    setGuardianName(savedParent); setProspectName(savedAthlete); setProspectAge(savedAge ? String(savedAge) : "");
    setVerifyFamily(""); setVerifyKid(""); setVerificationEvidence(""); setConsentReason(""); setCallbackReason(""); setRecipientZone("");
  }, [selectedId, savedParent, savedAthlete, savedAge]);

  const sendCommand = useCallback(async (kind: string, options: Partial<CRMCommand> = {}, threadOverride?: CRMThread | null) => {
    const target = threadOverride === undefined ? thread : threadOverride;
    setBusy(true);
    setActionError("");
    try {
      const query = new URLSearchParams();
      if (preview) query.set("preview", "1");
      if (locationId) query.set("location_id", locationId);
      const command: CRMCommand = {
        kind,
        key: crypto.randomUUID(),
        ...(target ? { thread_id: target.id, revision: target.revision } : {}),
        ...options,
      };
      const response = await fetch(`/api/crm${query.size ? `?${query.toString()}` : ""}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ location_id: locationId || undefined, command }),
      });
      const payload = await response.json() as { state?: CRMState; error?: string };
      if (!response.ok || payload.error || !payload.state) {
        if (payload.state) setState(payload.state);
        throw new Error(payload.error || `Action failed (${response.status}).`);
      }
      setState(payload.state);
      setActionError("");
      return true;
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The action was not confirmed. Your draft is still here.");
      return false;
    } finally {
      setBusy(false);
    }
  }, [locationId, preview, thread]);

  const updateLocation = (id: string) => {
    setLocationId(id);
    setSelectedId("");
    setMobileThread(false);
    setSmsDraft("");
    setNoteDraft("");
    setState(null);
    void reload(id);
  };
  const openThread = (id: string) => {
    setSelectedId(id);
    setMobileThread(true);
    setContextOpen(false);
    setView("inbox");
  };
  useEffect(() => { if (contextOpen) contextRef.current?.focus(); }, [contextOpen]);
  const filteredThreads = (state?.threads ?? []).filter((item) => `${item.parent} ${item.athlete} ${item.phone}`.toLowerCase().includes(search.toLowerCase()));
  const withThread = (kind: string, options: Partial<CRMCommand> = {}) => sendCommand(kind, options, thread);
  const saveDraft = async () => {
    if (!thread) return;
    await withThread(composer === "sms" ? "save_sms" : "save_note", { text: composer === "sms" ? smsDraft : noteDraft });
  };
  const sendSms = async () => {
    if (!thread || !smsDraft.trim()) return;
    const ok = await withThread("send", { text: smsDraft.trim() });
    if (ok) setSmsDraft("");
  };
  const latest = (item: CRMThread) => item.events[item.events.length - 1];
  const events = thread?.events ?? [];
  const availableSlots = state?.slots.filter((slot) => slot.available || thread?.offered.includes(slot.id)) ?? [];
  const priorityThreads = (state?.threads ?? []).filter((item) => (item.callback && item.callback.status !== "complete") || item.hold || !item.owner || item.nurture.status === "blocked");
  const dueCallbacks = (state?.threads ?? []).filter((item) => item.callback && item.callback.status !== "complete");
  const bookingThreads = (state?.threads ?? []).filter((item) => item.booking);
  const upcomingThreads = bookingThreads.filter(item => item.booking?.status === "confirmed" && new Date(item.booking.starts_at).getTime() > Date.now());

  const renderThreadRows = (items: CRMThread[], compact = false) => items.length ? items.map((item) => {
    const last = latest(item);
    return <button key={item.id} className={`crm-thread-item ${selectedId === item.id ? "active" : ""}`} onClick={() => openThread(item.id)} aria-pressed={selectedId === item.id}>
      <span className="crm-thread-top"><strong>{item.parent}</strong><span className={`crm-pill ${item.callback ? "alert" : "soft"}`}>{item.callback ? "Callback" : item.stage}</span></span>
      <p>{last?.body || `${item.athlete} · ${item.phone}`}</p>
      <span className="crm-thread-meta"><span>{item.athlete}{compact ? "" : ` · ${item.age}`}</span><span>{shortTime(last?.at)}</span></span>
    </button>;
  }) : <div className="crm-empty"><strong>No conversations here</strong>When a thread needs attention, it will show up in this queue.</div>;

  const heading = (title: string, subtitle: string) => <div className="crm-heading"><div><span className="crm-eyebrow">Infinite Hitting · Staff workspace</span><h1>{title}</h1><p>{subtitle}</p></div></div>;
  const actionFeedback = actionError ? <div className="crm-error" role="alert"><strong>Action not confirmed.</strong> {actionError}<div className="crm-actions" style={{ marginTop: 10 }}><button className="crm-btn quiet" onClick={() => void reload()}>Refresh state</button></div></div> : null;
  const selectSlot = async (slot: CRMSlot) => {
    setSelectedSlot(slot.id);
    if (preview) await withThread("select_slot", { slot_id: slot.id });
  };

  if (loading && !state) return <div className="clubhouse-crm"><div className="crm-shell"><div className="crm-loading" aria-label="Loading Clubhouse CRM" /></div></div>;
  if (loadError && !state) return <div className="clubhouse-crm"><div className="crm-shell"><div className="crm-error" role="alert"><strong>Clubhouse could not connect.</strong><p>{loadError}</p><Button className="crm-btn gold" onClick={() => void reload()}>Retry connection</Button></div></div></div>;

  return <main className="clubhouse-crm">
    <div className="crm-shell">
      <header className="crm-top">
        <div className="crm-brand"><div className="crm-mark" aria-hidden="true">IH</div><div><small>INFINITE HITTING</small><strong>CLUBHOUSE</strong></div></div>
        <div className="crm-top-controls">
          <div className="crm-connection"><span className={`crm-dot ${state?.location.connection?.toLowerCase() === "connected" ? "" : "off"}`} />{state?.location.sender || "Location sender"} · {state?.location.connection || "connection unknown"}</div>
          {!preview && locations.length > 1 ? <Select aria-label="Select facility" value={locationId} onChange={(event) => updateLocation(event.target.value)} className="!min-h-[44px] !w-auto !py-2">{locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}</Select> : <span className="crm-pill soft">{state?.location.name}</span>}
        </div>
      </header>
      {preview && <div className="crm-preview" role="status"><b>Isolated rehearsal</b><span>Practice only · no family contacted · no production records changed</span></div>}
      {locationId && <CRMPilotPanel locationId={locationId} preview={preview} />}
      <nav className="crm-nav" aria-label="CRM sections">{VIEWS.map((item) => <button key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => { setView(item.id); setMobileThread(false); }}>{item.label}</button>)}</nav>
      {loadError && <div className="crm-error" role="alert" style={{ marginBottom: 14 }}>Latest refresh failed: {loadError} <button className="crm-btn quiet" onClick={() => void reload()}>Retry</button></div>}
      {actionFeedback}

      {view === "overview" && <>
        {heading("Today, in the dugout", "The conversations, callbacks and evaluation bookings that need a person.")}
        <div className="crm-stat-grid">
          <Card className="crm-stat"><span className="crm-label">Needs attention</span><b>{priorityThreads.length}</b><span>Threads with an owner, hold or follow-up reason</span></Card>
          <Card className="crm-stat"><span className="crm-label">Callbacks open</span><b>{dueCallbacks.length}</b><span>Assigned follow-up still in progress</span></Card>
          <Card className="crm-stat"><span className="crm-label">Evaluations booked</span><b>{bookingThreads.length}</b><span>Based on persisted bookings</span></Card>
          <Card className="crm-stat"><span className="crm-label">Workflow</span><b style={{ fontSize: 23 }}>{state?.workflow.enabled ? "ACTIVE" : "PAUSED"}</b><span>Version {state?.workflow.version} · {state?.workflow.authority} authority</span></Card>
        </div>
        <div className="crm-overview-grid">
          <Card className="crm-section">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Staff queue</span><h2>Priorities</h2></div><button className="crm-btn quiet" onClick={() => setView("inbox")}>Open inbox</button></div>
            <div className="crm-list">{renderThreadRows(priorityThreads)}</div>
          </Card>
          <Card className="crm-section">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Next step</span><h2>Callbacks</h2></div></div>
            <div className="crm-list">{dueCallbacks.length ? dueCallbacks.map((item) => <div className="crm-row" key={item.id}><div className="crm-row-main"><strong>{item.parent} · {item.athlete}</strong><small>{item.callback?.reason || item.callback?.question || "Staff follow-up"} · Due {dateTime(item.callback?.due, state?.location.timezone)}</small></div><button className="crm-btn" onClick={() => { setView("inbox"); openThread(item.id); }}>Open</button></div>) : <div className="crm-empty"><strong>No open callbacks</strong>New follow-up tasks will be listed here.</div>}</div>
          </Card>
          <Card className="crm-section">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Appointment book</span><h2>Upcoming evaluations</h2></div></div>
            <div className="crm-list">{upcomingThreads.length ? upcomingThreads.map((item) => <div className="crm-row" key={item.id}><div className="crm-row-main"><strong>{item.athlete} · {item.parent}</strong><small>{dateTime(item.booking?.starts_at, state?.location.timezone)} · {item.booking?.status}</small></div><button className="crm-btn" onClick={() => { setView("inbox"); openThread(item.id); }}>Conversation</button></div>) : <div className="crm-empty"><strong>No upcoming evaluations</strong>Future confirmed appointments appear here.</div>}</div>
          </Card>
          <Card className="crm-section">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Workflow watch</span><h2>Exceptions & status</h2></div><button className="crm-btn quiet" onClick={() => setView("workflows")}>Review</button></div>
            {state?.threads.filter((item) => item.nurture.reason || item.hold).slice(0, 4).map((item) => <div className="crm-row" key={item.id}><div className="crm-row-main"><strong>{item.parent}</strong><small>{item.hold ? `Hold: ${item.hold}` : item.nurture.reason}</small></div><button className="crm-btn" onClick={() => { setView("inbox"); openThread(item.id); }}>Inspect</button></div>)}
            {!state?.threads.some((item) => item.nurture.reason || item.hold) && <div className="crm-empty"><strong>No workflow exceptions</strong>Eligibility and holds are read from each conversation.</div>}
          </Card>
        </div>
      </>}

      {view === "inbox" && <>
        {heading("Conversations", "One accountable adult conversation, with the next action always visible.")}
        <section className={`crm-card crm-inbox ${mobileThread ? "mobile-thread" : ""} ${contextOpen ? "context-open" : ""}`} aria-label="Conversation inbox">
          <aside className="crm-queue" aria-label="Conversation queue">
            <Input aria-label="Search conversations" className="crm-search" placeholder="Find a parent or athlete…" value={search} onChange={(event) => setSearch(event.target.value)} />
            <div className="crm-list">{renderThreadRows(filteredThreads)}</div>
          </aside>
          <section className="crm-conversation" aria-label="Selected conversation">
            {thread ? <>
              <div className="crm-convo-head"><div style={{ display: "flex", alignItems: "center", gap: 8 }}><button className="crm-mobile-back" onClick={() => setMobileThread(false)} aria-label="Back to conversation queue">‹ Back</button><div><h2>{thread.parent}</h2><span className="crm-thread-meta">{thread.phone} · {thread.athlete}, age {thread.age}</span></div></div><button ref={contextButtonRef} className="crm-btn crm-context-toggle" aria-controls="crm-context" aria-expanded={contextOpen} onClick={()=>setContextOpen(true)}>Context</button><span className="crm-pill">{thread.stage}</span></div>
              <div className="crm-convo-body" aria-live="polite">
                {events.length ? events.map((event: CRMEvent) => <article key={event.id} className={`crm-event ${event.kind.toLowerCase().includes("out") || event.author.toLowerCase().includes("staff") ? "out" : ""} ${event.kind.toLowerCase().includes("note") ? "crm-event-note" : ""}`}>
                  <div className="crm-bubble">{event.body}</div>
                  <div className="crm-event-info"><span>{event.kind}</span><span>{event.author}</span><span>{event.status}</span><span>{dateTime(event.at, state?.location.timezone)}</span>{event.simulated && <span className="crm-pill alert">Simulated</span>}</div>
                </article>) : <div className="crm-empty"><strong>Conversation is ready</strong>There are no recorded events in this thread yet.</div>}
              </div>
              <div className="crm-compose">
                <div className="crm-compose-tabs" role="tablist" aria-label="Compose type"><button role="tab" aria-selected={composer === "sms"} className={composer === "sms" ? "selected" : ""} onClick={() => setComposer("sms")}>Parent SMS</button><button role="tab" aria-selected={composer === "note"} className={composer === "note" ? "selected" : ""} onClick={() => setComposer("note")}>Private staff note</button></div>
                <TextArea aria-label={composer === "sms" ? "Parent SMS draft" : "Private note draft"} rows={3} className="!resize-y" placeholder={composer === "sms" ? "Write a clear, helpful reply…" : "Add context for the staff team…"} value={composer === "sms" ? smsDraft : noteDraft} onChange={(event) => composer === "sms" ? setSmsDraft(event.target.value) : setNoteDraft(event.target.value)} />
                <div className="crm-compose-bottom"><span className="crm-label">{composer === "sms" ? `${smsDraft.length} characters · save to retain after reload` : "Private note · never sent to parent"}</span><div className="crm-actions"><button className="crm-btn" disabled={busy} onClick={() => void saveDraft()}>Save draft</button>{composer === "sms" ? <button className="crm-btn gold" disabled={busy || !smsDraft.trim() || !thread.consent || thread.hold==="STOP"} title={!thread.consent ? "Consent required" : thread.hold==="STOP" ? "STOP suppression" : "Queue parent SMS for dispatch checks"} onClick={() => void sendSms()}>Queue SMS</button> : <button className="crm-btn gold" disabled={busy || !noteDraft.trim()} onClick={async () => { const ok = await withThread("note", { text: noteDraft.trim() }); if (ok) setNoteDraft(""); }}>Add private note</button>}</div></div>
                {composer === "sms" && (!thread.consent || thread.hold) && <p className="crm-label" style={{ color: "#e8ba75", marginBottom: 0 }}>{thread.hold ? `Sending blocked by hold: ${thread.hold}` : "Sending blocked: consent is not recorded."}</p>}
              </div>
            </> : <div className="crm-empty"><strong>Choose a conversation</strong>Select a parent thread from the queue to review context and respond.</div>}
          </section>
          <aside id="crm-context" ref={contextRef} tabIndex={-1} className="crm-context" aria-label="Conversation context">
            <button className="crm-btn crm-context-back" onClick={()=>{setContextOpen(false);contextButtonRef.current?.focus();}}>Back to conversation</button>
            {thread ? <>
              <div className="crm-context-block"><span className="crm-label">Accountability</span><strong>{thread.owner || "Unassigned"}</strong><p>{thread.hold ? `Automation hold · ${thread.hold}` : "No active hold"} · revision {thread.revision}</p><div className="crm-actions" style={{ marginTop: 9 }}><button className="crm-btn" disabled={busy} onClick={() => void withThread("takeover")}>Take over</button><button className="crm-btn" disabled={busy} onClick={() => void withThread("call")}>Call</button></div></div>
              <div className="crm-context-block"><span className="crm-label">Family & athlete</span><strong>{thread.parent}</strong><p>{thread.athlete} · age {thread.age}<br />{thread.verified ? "Guardian verified" : "Guardian needs verification"}<br/>Recipient timezone: {thread.recipient_timezone||"Unresolved"}</p>{(!thread.verified || !thread.recipient_timezone) && <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                <Input aria-label="Verified parent name" placeholder="Verified parent name" value={guardianName} onChange={e=>setGuardianName(e.target.value)}/>
                <Input aria-label="Athlete name" placeholder="Athlete name" value={prospectName} onChange={e=>setProspectName(e.target.value)}/>
                <Input aria-label="Athlete age" placeholder="Athlete age" type="number" min={1} max={120} value={prospectAge} onChange={e=>setProspectAge(e.target.value)}/>
                <Input aria-label="Guardian verification evidence" placeholder="How was guardian identity verified?" value={verificationEvidence} onChange={e=>setVerificationEvidence(e.target.value)}/><Input aria-label="Recipient timezone" placeholder="Example: America/New_York" value={recipientZone} onChange={e=>setRecipientZone(e.target.value)}/><Input aria-label="Verified family ID, optional" placeholder="Verified family ID (optional)" value={verifyFamily} onChange={(e) => setVerifyFamily(e.target.value)} /><Input aria-label="Verified athlete ID, optional" placeholder="Verified athlete ID (optional)" value={verifyKid} onChange={(e) => setVerifyKid(e.target.value)} /><button className="crm-btn" disabled={busy||!verificationEvidence.trim()||!guardianName.trim()||!prospectName.trim()||!Number(prospectAge)||Number(prospectAge)<1||Number(prospectAge)>120} onClick={() => void withThread("resolve", { text: verificationEvidence, parent_name: guardianName, athlete_name: prospectName, athlete_age: Number(prospectAge), recipient_timezone:recipientZone||undefined, verified_family_id: verifyFamily || undefined, verified_kid_id: verifyKid || undefined })}>Confirm verified guardian</button></div>}</div>
              <div className="crm-context-block"><span className="crm-label">Channel permissions · inquiry only</span><strong>SMS: {thread.consent ? "Recorded" : "Missing"} · Voice: {thread.voice_consent ? "Recorded" : "Missing"}</strong>{(!thread.consent||!thread.voice_consent) && <div style={{ display: "grid", gap: 8, marginTop: 8 }}><Select aria-label="Consent channel" value={consentChannel} onChange={e=>setConsentChannel(e.target.value as "sms"|"voice")}><option value="sms">SMS inquiry permission</option><option value="voice">Staff voice permission</option></Select><Input aria-label="Consent evidence or reason" placeholder="Staff-entered consent evidence" value={consentReason} onChange={(e) => setConsentReason(e.target.value)} /><button className="crm-btn" disabled={busy || !consentReason.trim()} onClick={() => void withThread("consent", { text: consentReason,channel:consentChannel })}>Record consent evidence</button></div>}</div>
              <div className="crm-context-block"><span className="crm-label">Next action</span><strong>{thread.callback ? thread.callback.reason || "Callback requested" : "No callback open"}</strong><p>{thread.callback ? `Assigned: ${thread.callback.owner} · Due ${dateTime(thread.callback.due, state?.location.timezone)} · ${thread.callback.status}` : "Set a reason and follow-up for staff."}</p>{thread.callback?.question && <p>Last parent question: {thread.callback.question}</p>}<div style={{ display: "flex", gap: 7, marginTop: 8 }}><Input aria-label="Callback reason" placeholder="Reason / question" value={callbackReason} onChange={(e) => setCallbackReason(e.target.value)} /><button className="crm-btn" disabled={busy || !callbackReason.trim()} onClick={() => void withThread("callback", { text: callbackReason })}>Set</button></div></div>
              <div className="crm-context-block"><span className="crm-label">Evaluation</span><strong>{thread.booking ? dateTime(thread.booking.starts_at, state?.location.timezone) : "Not booked"}</strong>{thread.booking && <p>{thread.booking.status}</p>}
                <div className="crm-actions" style={{ marginTop: 9 }}><button className="crm-btn" disabled={busy} onClick={() => void withThread("find_slots")}>Find openings</button></div>
                {availableSlots.length > 0 && <div style={{ display: "grid", gap: 7, marginTop: 9 }}>{availableSlots.map((slot) => <div key={slot.id} className="crm-row" style={{ padding: 8, alignItems: "center" }}><div className="crm-row-main"><strong style={{ fontSize: 11 }}>{dateTime(slot.starts_at, state?.location.timezone)}</strong><small>{slot.coach} · {slot.cage}{thread.offered.includes(slot.id) ? " · offered" : ""}</small></div><button className={`crm-btn ${selectedSlot === slot.id ? "gold" : ""}`} style={{ minHeight: 44, padding: "0 9px" }} disabled={busy || !slot.available} onClick={() => void selectSlot(slot)}>{selectedSlot === slot.id ? "Selected" : "Select"}</button></div>)}
                  {selectedSlot && (!thread.booking || thread.booking.status === "cancelled") && <button className="crm-btn gold" disabled={busy || !thread.verified} onClick={() => void withThread("book", { slot_id: selectedSlot })}>Book this evaluation</button>}</div>}
              </div>
              <div className="crm-context-block"><span className="crm-label">Workflow reason</span><strong>{thread.nurture.status}</strong><p>{thread.nurture.reason || `Version ${thread.nurture.version} · next due ${dateTime(thread.nurture.due, state?.location.timezone)}`}</p><div className="crm-actions" style={{ marginTop: 8 }}><button className="crm-btn" disabled={busy} onClick={() => void withThread("assist")}>Prepare assistance</button><button className="crm-btn" disabled={busy} onClick={() => void withThread("dispatch")}>Dispatch due step</button><button className="crm-btn" disabled={busy} onClick={() => void withThread("reconcile")}>Reconcile</button></div></div>
              <div className="crm-context-block"><span className="crm-label">Call outcome</span><Select aria-label="Call outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)}><option value="no-answer">No answer</option><option value="completed">Completed</option><option value="busy">Busy</option><option value="failed">Failed</option></Select><button className="crm-btn" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => void withThread("call_outcome", { outcome })}>Save call outcome</button></div>
              {preview && <div className="crm-context-block"><span className="crm-label">Rehearsal inbound</span><Input aria-label="Simulated incoming parent message" placeholder="Practice incoming text" value={rehearsalText} onChange={(e) => setRehearsalText(e.target.value)} /><button className="crm-btn warn" style={{ width: "100%", marginTop: 8 }} disabled={busy || !rehearsalText.trim()} onClick={() => { void withThread("preview_inbound", { text: rehearsalText }); setRehearsalText(""); }}>Add simulated inbound</button></div>}
            </> : <div className="crm-empty"><strong>Context</strong>Choose a conversation to see its accountable owner, consent, booking and workflow evidence.</div>}
          </aside>
        </section>
      </>}

      {view === "pipeline" && <>
        {heading("Evaluation pipeline", "Move the work forward by opening the conversation. Stage labels reflect persisted thread state.")}
        <div className="crm-pipeline">{STAGES.map((stage) => {
          const items = (state?.threads ?? []).filter((item) => item.stage === stage);
          return <section className="crm-card crm-stage" key={stage}><div className="crm-stage-title"><h2>{stage}</h2><span className="crm-pill soft">{items.length}</span></div>
            {items.length ? items.map((item) => <Card key={item.id} className="crm-deal" padding="sm"><strong>{item.athlete}</strong><p>{item.parent} · age {item.age}</p><div className="crm-thread-meta"><span>{item.owner || "Unassigned"}</span><span>{item.booking ? dateTime(item.booking.starts_at, state?.location.timezone) : item.callback ? `Callback · ${item.callback.status}` : item.nurture.status}</span></div><button className="crm-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => { setView("inbox"); openThread(item.id); }}>Open conversation</button></Card>) : <div className="crm-empty">No conversations in this stage.</div>}
          </section>;
        })}</div>
      </>}

      {view === "workflows" && <>
        {heading("Inquiry follow-up", "A versioned, explainable journey. Draft authority never sends or books on its own.")}
        <div className="crm-workflow-grid">
          <Card className="crm-workflow-body">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Location workflow · v{state?.workflow.version}</span><h2 style={{ margin: "4px 0 0", font: "500 24px var(--font-display),Oswald,sans-serif" }}>New inquiry → evaluation</h2></div><span className={`crm-pill ${workflowEnabled ? "" : "soft"}`}>{workflowEnabled ? "Enabled" : "Paused"}</span></div>
            <div className="crm-flowline"><span className="crm-flow-icon">01</span><div><strong>New inquiry arrives</strong><p>Starts the staff follow-up journey for this location and family conversation.</p></div></div>
            <div className="crm-flowline"><span className="crm-flow-icon">02</span><div><strong>Wait {delay || state?.workflow.delay_minutes} minutes</strong><p>Uses location time zone: {state?.location.timezone}. Eligibility is checked again at action time.</p></div></div>
            <div className="crm-flowline"><span className="crm-flow-icon">03</span><div><strong>Prepare a parent response</strong><p>{workflowText || "No wording configured."}</p></div></div>
            <div className="crm-flowline"><span className="crm-flow-icon">04</span><div><strong>Stop on reply, hold or confirmed booking</strong><p>Consent, active holds, booking and available connection are checked before any outward action.</p></div></div>
            <div className="crm-actions"><button className={`crm-btn ${workflowEnabled ? "warn" : "gold"}`} disabled={busy} onClick={async () => { const enabled = !workflowEnabled; if (await sendCommand("workflow", { text: workflowText, delay_minutes: Number(delay), enabled, authority })) setWorkflowEnabled(enabled); }}>{workflowEnabled ? "Pause workflow" : "Enable workflow"}</button><button className="crm-btn" disabled={busy} onClick={() => void sendCommand("tick")}>Run due checks</button><button className="crm-btn" onClick={() => setWorkflowPreview((value) => !value)}>{workflowPreview ? "Hide eligibility preview" : "Preview eligibility"}</button></div>
            {workflowPreview && <div className="crm-history" aria-live="polite"><span className="crm-label">Eligibility preview · read only</span>{state?.threads.map((item) => {
              const reasons = [!item.consent && "No recorded consent", !item.verified && "Guardian unresolved", item.hold && `On hold: ${item.hold}`, item.booking && "Evaluation booked", state.location.connection === "missing" && "Location connection unavailable"].filter(Boolean);
              return <div className="crm-history-item" key={item.id}><span>{item.parent} · {item.athlete}</span><span>{reasons.length ? reasons.join(" · ") : "Eligible for staff review"}</span></div>;
            })}</div>}
            {state?.workflow.history?.length ? <div className="crm-history"><span className="crm-label">Version history</span>{state.workflow.history.map((item, index) => <div className="crm-history-item" key={`${item.version}-${item.at}-${index}`}><span>v{item.version} · {item.actor} · {item.reason}</span><span>{dateTime(item.at, state.location.timezone)}</span></div>)}</div> : null}
          </Card>
          <Card className="crm-workflow-body">
            <div className="crm-section-head"><div><span className="crm-eyebrow">Working copy</span><h2 style={{ margin: "4px 0 0", font: "500 24px var(--font-display),Oswald,sans-serif" }}>Wording & authority</h2></div></div>
            <div style={{ display: "grid", gap: 14 }}>
              <TextArea label="Parent-facing wording" aria-label="Workflow parent-facing wording" rows={5} value={workflowText} onChange={(e) => setWorkflowText(e.target.value)} placeholder="Write the approved first follow-up…" />
              <Input label="Delay before follow-up (minutes)" aria-label="Delay in minutes" type="number" min={0} value={delay} onChange={(e) => setDelay(e.target.value)} />
              <Select label="Action authority" aria-label="Workflow authority" value={authority} onChange={(e) => setAuthority(e.target.value as typeof authority)}><option value="draft">Draft · staff reviews each action</option><option value="delegated">Delegated · within approved policy</option></Select>
              <p className="crm-label">Workflow edits are persisted as a new version. Delegated authority does not override consent, human holds, booking state, recipient verification or location connection.</p>
              <button className="crm-btn gold" disabled={busy || !workflowText.trim() || !Number.isFinite(Number(delay))} onClick={() => void sendCommand("workflow", { text: workflowText, delay_minutes: Number(delay), enabled: workflowEnabled, authority })}>Save new version</button>
            </div>
          </Card>
          <Card className="crm-workflow-body" style={{ gridColumn: "1 / -1" }}>
            <div className="crm-section-head"><div><span className="crm-eyebrow">Staff only · no parent outreach</span><h2>Internal reevaluations</h2></div><button className="crm-btn" disabled={busy} onClick={()=>void sendCommand("reevaluate",{},null)}>Check visit and payment dates</button></div>
            <p className="crm-label">Upcoming visit plus next payment within ten days. Repeat internally until completed; never sends or charges.</p>
            {state?.internal_tasks?.length ? state.internal_tasks.map(task=><div className="crm-row" key={task.id}><div className="crm-row-main"><strong>{task.status} · {dateTime(task.due_at,state.location.timezone)}</strong><small>{task.reason}</small></div>{task.status!=="complete"&&<button className="crm-btn" disabled={busy} onClick={()=>void sendCommand("reevaluate",{task_id:task.id},null)}>Complete task</button>}</div>):<div className="crm-empty">No qualifying internal tasks.</div>}
            {!!state?.reminders?.length&&<><h3>Separate appointment reminder intents</h3>{state.reminders.map(reminder=><div className="crm-row" key={reminder.booking_id}><div className="crm-row-main"><strong>{dateTime(reminder.due_at,state.location.timezone)} · {reminder.status}</strong><small>{reminder.reason} · revision {reminder.revision}</small></div></div>)}</>}
          </Card>
          <Card className="crm-workflow-body" style={{ gridColumn: "1 / -1" }}>
            <div className="crm-section-head"><div><span className="crm-eyebrow">Why did it run or skip?</span><h2 style={{ margin: "4px 0 0", font: "500 24px var(--font-display),Oswald,sans-serif" }}>Journey status by conversation</h2></div></div>
            {state?.threads.length ? <div className="crm-list">{state.threads.map((item) => <div key={item.id} className="crm-row"><div className="crm-row-main"><strong>{item.parent} · {item.athlete}</strong><small>{item.nurture.reason || `Status: ${item.nurture.status} · next check ${dateTime(item.nurture.due, state.location.timezone)}`}</small></div><span className={`crm-pill ${item.nurture.status === "blocked" ? "alert" : "soft"}`}>{item.nurture.status}</span></div>)}</div> : <div className="crm-empty"><strong>No journey records</strong>Workflow runs will appear when persisted by the CRM.</div>}
          </Card>
        </div>
      </>}
      {busy && <p className="crm-label" role="status" style={{ marginTop: 14 }}>Saving with the location CRM…</p>}
    </div>
  </main>;
}
