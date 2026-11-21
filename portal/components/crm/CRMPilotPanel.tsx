"use client";
import { useCallback, useEffect, useState } from "react";

type Pilot = {
  configured: boolean; active: boolean; paused: boolean; operator_id: string | null;
  connection: string; can_configure: boolean; approval_recorded: boolean;
  allowlist_count: number; staff_handset_configured: boolean; next_action: string;
  readiness: string; blockers: string[];
  last_worker_at: string | null;
  outbox: { id: string; thread_id: string; status: string; reason: string | null;
    purpose: string; attempted_at: string | null }[];
};
export default function CRMPilotPanel({ locationId, preview }: { locationId: string; preview: boolean }) {
  const [pilot, setPilot] = useState<Pilot | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [operator, setOperator] = useState("");
  const [numbers, setNumbers] = useState(preview ? "+15005550006, +15005550101, +15005550102, +15005550115" : "");
  const [handset, setHandset] = useState(preview ? "+15005550115" : "");
  const [approval, setApproval] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const endpoint = `/api/crm/pilot?location_id=${encodeURIComponent(locationId)}${preview ? "&preview=1" : ""}`;
  const reload = useCallback(async () => {
    if (!locationId) return;
    try {
      const response = await fetch(endpoint, { credentials: "include", cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pilot readiness unavailable");
      setPilot(result.pilot); setError("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Pilot unavailable"); }
  }, [endpoint, locationId]);
  useEffect(() => {
    setPilot(null); setOperator(""); setApproval(""); setConfirmation("");
    void reload();
    const timer = setInterval(() => void reload(), 15000);
    return () => clearInterval(timer);
  }, [reload]);
  async function manage(action: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload: action === "configure" ? {
          operator_id: operator.trim(), approved_numbers: numbers.split(/[,\n]/).map(x => x.trim()).filter(Boolean),
          staff_handset: handset.trim() || null, approval: approval.trim(),
        } : { confirm: confirmation } }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Pilot change was not saved");
      setPilot(result.pilot); setConfirmation("");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Pilot change failed"); }
    finally { setBusy(false); }
  }
  return <details className="crm-pilot crm-section">
    <summary>Staff-only pilot · {pilot?.readiness || "Checking readiness"}</summary>
    <p>{pilot?.next_action || "Checking this location’s readiness…"}</p>
    <p className="crm-label">No production rollout. Only explicitly approved staff test identities.
      Acceptance is not delivery, and a staff bridge is not proof the recipient answered.</p>
    {error && <p role="alert" className="crm-error">{error}</p>}
    {pilot && <>
      {!!pilot.blockers?.length && <ul>{pilot.blockers.map(blocker => <li key={blocker}>{blocker}</li>)}</ul>}
      <p>Approved identities: {pilot.allowlist_count} · Handset: {pilot.staff_handset_configured ? "configured" : "missing"} ·
        Operator: {pilot.operator_id ? "explicitly assigned" : "not assigned"}</p>
      <p className="crm-label">Automatic worker: {pilot.last_worker_at ? `last checked ${new Date(pilot.last_worker_at).toLocaleString()}` : "not yet verified"}.
        Provider rehearsal sign-off remains separate.</p>
      <div className="crm-pilot-actions">
        <button className="crm-btn" disabled={busy || !pilot.configured} onClick={() => void manage("pause")}>Pause dispatch</button>
        <button className="crm-btn" disabled={busy} onClick={() => void reload()}>Refresh readiness</button>
        {pilot.can_configure && <>
          <button className="crm-btn" disabled={busy || !pilot.configured} onClick={() => void manage("disconnect")}>Disconnect pilot</button>
          <button className="crm-btn" disabled={busy || !pilot.configured} onClick={() => void manage("restore")}>Restore binding, stay paused</button>
        </>}
      </div>
      {pilot.configured && <div className="crm-pilot-form">
        <label>Confirm approved staff-only rehearsal
          <input value={confirmation} onChange={e => setConfirmation(e.target.value)} placeholder="Type STAFF ONLY" autoComplete="off" />
        </label>
        <button className="crm-btn gold" disabled={busy || confirmation !== "STAFF ONLY"} onClick={() => void manage(pilot.active ? "resume" : "start")}>
          {preview ? "Start or resume simulation" : "Start or resume approved rehearsal"}
        </button>
        <p className="crm-label">Only the designated operator can start. Queued work is rechecked, not blindly released.
          Real transport additionally requires server-side credentials and explicit rehearsal enablement.</p>
      </div>}
      {pilot.can_configure && <details>
        <summary>Owner configuration</summary>
        <p>Use an existing approved owner/admin identity with an explicit grant to this location.
          This does not create a role, grant access, buy a number or change provider routing.
          A front-desk role decision is still required if that operator is not already an authorized admin.</p>
        <div className="crm-pilot-form">
          <label>Existing authorized staff ID<input value={operator} onChange={e => setOperator(e.target.value)} autoComplete="off" /></label>
          <label>Approved staff-pilot numbers, including facility sender<textarea value={numbers} onChange={e => setNumbers(e.target.value)} rows={3} /></label>
          <label>Approved staff callback handset<input type="tel" value={handset} onChange={e => setHandset(e.target.value)} /></label>
          <label>Approval evidence, sender ownership and routing authorization<textarea value={approval} onChange={e => setApproval(e.target.value)} rows={3} /></label>
          <button className="crm-btn" disabled={busy || !operator.trim() || !approval.trim()} onClick={() => void manage("configure")}>Save configuration, paused</button>
        </div>
      </details>}
      <h3>Dispatch evidence</h3>
      <p className="crm-label">The automatic worker checks due work. Failed or uncertain attempts require review; they are not automatically resent.</p>
      <ul className="crm-pilot-evidence">{pilot.outbox.length ? pilot.outbox.slice(-12).reverse().map(item =>
        <li key={item.id}><strong>{item.purpose === "call" ? "Staff call" : "SMS"} · {item.status}</strong>
          <span>{item.reason || "Awaiting dispatch-time checks"}</span></li>)
        : <li>No dispatch attempts at this location.</li>}</ul>
    </>}
  </details>;
}
