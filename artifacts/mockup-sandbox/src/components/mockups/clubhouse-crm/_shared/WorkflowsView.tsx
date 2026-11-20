import { useState, type Dispatch, type SetStateAction } from "react";
import {
  Activity, CheckCircle2, ChevronDown, Clock3, ClipboardList, Flag, GitBranch,
  LockKeyhole, MessageCircle, MoreHorizontal, Plus, ShieldCheck, Sparkles, Tag,
  X, Zap
} from "lucide-react";
import { PageHead } from "./SharedChrome";
import type { FlowNode, NodeKind } from "./demoData";

interface WorkflowsViewProps {
  tab: string;
  setTab: (tab: string) => void;
  nodes: FlowNode[];
  setNodes: Dispatch<SetStateAction<FlowNode[]>>;
  selectedNode: number;
  setSelected: (id: number) => void;
  addNode: (kind: NodeKind) => void;
  catalog: { kind: NodeKind; label: string; icon: typeof Zap }[];
  paused: boolean;
  setPaused: (paused: boolean) => void;
  pauseScope: string;
  setPauseScope: (scope: string) => void;
  name: string;
  setName: (name: string) => void;
  reentry: string;
  setReentry: (rule: string) => void;
  recurrence: string;
  setRecurrence: (schedule: string) => void;
  relativeTiming: string;
  setRelativeTiming: (timing: string) => void;
  location: string;
  role: string;
  smsConfigured: boolean;
  hasEligibleAdult: boolean;
  sharing: string;
  setSharing: (decision: string) => void;
  validation: string[];
  modal: (name: string) => void;
  flash: (message: string) => void;
}

export function WorkflowsView({ tab, setTab, nodes, setNodes, selectedNode: selected, setSelected, addNode, catalog, paused, setPaused, pauseScope, setPauseScope, name, setName, reentry, setReentry, recurrence, setRecurrence, relativeTiming, setRelativeTiming, location, role, smsConfigured, hasEligibleAdult, sharing, setSharing, validation, modal, flash }: WorkflowsViewProps) {
  const [runFilter,setRunFilter]=useState("All runs");
  const activeNode=nodes.find((n:FlowNode)=>n.id===selected)??nodes[0];
  const runRecords=[["Mara Chen · Eli","Evaluation created","Waiting","Eligible adult; 2-day wait","v2","Today 9:50","North Loop"],["Evan Brooks · Tessa","Lead created","Blocked","Guardian ambiguous; staff review","v2","Yesterday","North Loop"],["Priya Shah · Nikhil","Tag added","Skipped","SMS opt-out at execution guard","v1","Yesterday","North Loop"],["Nina Patel · Arjun","Camp interest tag","Duplicate prevented","Event idempotency key already seen","v1","Mon 10:20","Cedar Park"]];
  const scopedRuns=runRecords.filter(r=>r[6]===location.split(" · ")[0]).filter(r=>runFilter==="All runs"||(runFilter==="Blocked"&&["Blocked","Skipped"].includes(r[2]))||(runFilter==="Delayed"&&r[2]==="Waiting")||(runFilter==="Completed"&&r[2]==="Completed"));
  const failureRows=[["Unknown provider outcome","SMS event · Mara Chen · North Loop","Provider accepted state unavailable. Do not retry blind.","Investigate","North Loop"],["Appointment rescheduled","Evaluation reminder · Eli Chen","Previous wait invalidated. Recalculate using new Thursday visit.","Recalculate","North Loop"],["Email connector missing","Member onboarding · Cedar Park","No email fallback. Hold this step until connector and consent are reviewed.","Resolve","Cedar Park"]];
  const scopedFailures=failureRows.filter(x=>x[4]===location.split(" · ")[0]);
  if (role.startsWith("Instructor")) return <section><PageHead title="Workflows" sub="Workflow editing and operational run details are restricted from the instructor demo lens."/><div className="panel panel-pad"><div className="empty-mark"><LockKeyhole size={16}/></div><h2>Ask a GM to review workflow access</h2><p className="small-text muted">Assigned guardian context remains available from Conversations. This switch does not authenticate.</p></div></section>;
  return <section>
    <PageHead title="Workflows" sub="Visual logic, explicit guardrails and runs a staff member can explain." children={<div className="row"><button className="btn" onClick={()=>modal("simulate")}><Activity size={13}/>Simulate</button><button className="btn primary" onClick={()=>modal("publish")}><ShieldCheck size={13}/>Review publish</button></div>}/>
    <div className="between" style={{marginBottom:10,flexWrap:"wrap"}}><div className="row"><span className="tag green">Sample workflow · location scope</span><span className={`tag ${paused?"red":"green"}`}>{paused?`Paused · ${pauseScope}`:"Active proposal"}</span></div><div className="row"><button className="btn small" onClick={()=>modal("pause-policy")}>{paused?"Change pause / resume":"Pause"} workflow <ChevronDown size={11}/></button><button className="btn small" onClick={()=>modal("ai-workflow")}><Sparkles size={12}/>AI draft</button></div></div>
    <div className="panel" style={{padding:"0 13px"}}>
      <div className="subnav">{["Library","Editor","Runs","Failure center"].map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}{t==="Failure center"&&<span className="tag red" style={{marginLeft:5}}>{scopedFailures.length}</span>}</button>)}</div>
      {tab==="Library"&&<div style={{paddingBottom:14}}><div className="between" style={{marginBottom:11}}><div><h2>Location workflow library</h2><span className="caption">Versioned proposals · no silent rollout</span></div><button className="btn primary" onClick={()=>{setName("New workflow · draft");setTab("Editor");}}>Create workflow</button></div><div className="responsive-table"><table className="table"><thead><tr><th>Workflow</th><th>Trigger</th><th>Scope</th><th>State</th><th>Version</th><th></th></tr></thead><tbody>{[["Evaluation lead · first 7 days","New opportunity","North Loop","Active sample","v2"],["Camp interest · guardian eligible","Tag added · Interested · camps","North Loop","Draft","v1"],["No-show recovery · staff task","Visit marked no-show","All locations · proposal","Needs approval","v1"],["Member onboarding · 30 days","Membership starts","Location proposal","Paused","v3"],["Attendance milestone · 6 visits","Attendance event","Local override","Draft","v1"]].map(r=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td>{r[2]}</td><td><span className={`tag ${r[3].includes("Active")?"green":r[3].includes("approval")?"blue":"neutral"}`}>{r[3]}</span></td><td className="mono">{r[4]}</td><td><button className="btn small" onClick={()=>setTab("Editor")}>Open</button></td></tr>)}</tbody></table></div><div className="panel panel-pad" style={{marginTop:12}}><div className="between"><div><div className="eyebrow">Corporate proposal · v3</div><strong>Evaluation lead safeguards</strong><div className="small-text muted">{location} · current decision: {sharing}</div></div><div className="row"><button className="btn small" onClick={()=>{setSharing("accepted");flash(`${location} accepted this version locally.`);}}>Accept for location</button><button className="btn small" onClick={()=>{setSharing("override");flash(`Local override saved for ${location}; no other location changes.`);}}>Create local override</button></div></div></div><div className="notice blue" style={{marginTop:12}}><GitBranch size={14}/><span>Corporate proposals require location review. Local override is explicit, versioned and never silently replaced.</span></div></div>}
      {tab==="Editor"&&<div className="workflow-layout" style={{paddingBottom:14}}>
        <div>
          <div className="between" style={{marginBottom:9,flexWrap:"wrap"}}><input aria-label="Workflow name" className="input" value={name} onChange={e=>setName(e.target.value)} style={{fontWeight:700,maxWidth:320}}/><span className="small-text muted">v2 · local draft · autosaved in this tab</span></div>
          <div className="workflow-canvas"><div className="eyebrow" style={{textAlign:"center",marginBottom:14}}>On evaluation lead created · {location.split(" · ")[0]} · one run per unique opportunity event</div>
            {nodes.map((node:FlowNode,i:number)=><div key={node.id}>
              <button className={`flow-node ${selected===node.id?"selected":""}`} onClick={()=>setSelected(node.id)}><div className="flow-icon">{node.kind==="trigger"?<Zap size={14}/>:node.kind==="condition"?<GitBranch size={14}/>:node.kind==="wait"?<Clock3 size={14}/>:node.kind==="SMS"?<MessageCircle size={14}/>:node.kind==="goal exit"?<Flag size={14}/>:node.kind==="tag-add"||node.kind==="tag-remove"?<Tag size={14}/>:<ClipboardList size={14}/>}</div><div style={{flex:1,textAlign:"left"}}><div className="flow-node-type">{node.kind}</div><div className="flow-node-title">{node.title}</div><div className="small-text muted">{node.detail}</div></div><MoreHorizontal size={14}/></button>
              {i<nodes.length-1&&<div className="flow-line"/>}
              {node.kind==="condition"&&<div className="flow-branch"><div><div className="branch-cap">YES · ELIGIBLE</div><div className="flow-line"/><div className="flow-node" style={{width:"100%"}}><div className="flow-icon"><MessageCircle size={13}/></div><div><div className="flow-node-type">OUTREACH</div><div className="flow-node-title">Approved guardian SMS</div></div></div></div><div><div className="branch-cap">NO · REVIEW</div><div className="flow-line"/><div className="flow-node" style={{width:"100%"}}><div className="flow-icon"><ClipboardList size={13}/></div><div><div className="flow-node-type">INTERNAL ONLY</div><div className="flow-node-title">Create staff review task</div></div></div></div></div>}
            </div>)}
            <button className="btn small" style={{display:"flex",margin:"16px auto 0"}} onClick={()=>document.getElementById("node-catalog")?.scrollIntoView({behavior:"smooth"})}><Plus size={12}/>Add a step</button>
          </div>
        </div>
        <div id="node-catalog" className="workflow-side stack">
          <div className="panel panel-pad"><div className="section-title"><h3>Selected step</h3><button className="icon-btn" aria-label="Delete selected node" onClick={()=>{if(nodes.length>2){const next=nodes.filter((n:FlowNode)=>n.id!==selected);setNodes(next);setSelected(next[0].id);flash("Selected step removed from local draft.");}}}><X size={13}/></button></div><div className="eyebrow">Node · {activeNode.kind}</div><div className="field" style={{marginTop:9}}><label htmlFor="node-title">Step name</label><input id="node-title" className="input" value={activeNode.title} onChange={e=>{const v=e.target.value;setNodes((prev:FlowNode[])=>prev.map(n=>n.id===activeNode.id?{...n,title:v}:n));}} /></div><div className="field" style={{marginTop:8}}><label htmlFor="node-timing">Timing / rule</label><select id="node-timing" className="select" value={activeNode.timing||"At next eligible local time"} onChange={e=>setNodes((prev:FlowNode[])=>prev.map(n=>n.id===activeNode.id?{...n,timing:e.target.value}:n))}><option>At next eligible local time</option><option>Wait 2 days · re-evaluate reschedule</option><option>Until guardian replies or timeout</option><option>Appointment-relative · recalculate after move</option><option>Recurring · weekly local time</option><option>Run once per idempotency key</option></select></div><div className="field" style={{marginTop:8}}><label htmlFor="workflow-reentry">Re-entry rule</label><select id="workflow-reentry" className="select" value={reentry} onChange={e=>setReentry(e.target.value)}><option>Once per unique event</option><option>Allow after prior run completes</option><option>Never re-enter this household</option></select></div><div className="field" style={{marginTop:8}}><label htmlFor="workflow-recurrence">Recurring schedule</label><select id="workflow-recurrence" className="select" value={recurrence} onChange={e=>setRecurrence(e.target.value)}><option>No recurrence</option><option>Weekly · location time</option><option>Monthly · location time</option></select></div><div className="field" style={{marginTop:8}}><label htmlFor="workflow-relative">Date anchor</label><select id="workflow-relative" className="select" value={relativeTiming} onChange={e=>setRelativeTiming(e.target.value)}><option>Appointment-relative · recalculates on move</option><option>Calendar date · local timezone</option><option>Next payment · within 10 days</option></select></div><div className="small-text muted" style={{marginTop:8}}>Current policy: {reentry} · {recurrence} · {relativeTiming}. Manual tag removal conflicts require review.</div></div>
          <div className="panel panel-pad"><div className="section-title"><h3>Node catalog</h3><span className="caption">Select to add</span></div><div className="catalog">{catalog.map(({kind,label,icon:Icon}:any)=><button key={kind} onClick={()=>addNode(kind)}><Icon size={12}/>{label}</button>)}</div></div>
          <div className="notice"><Clock3 size={14}/><span>Waits follow recipient timezone and quiet hours. Reschedule recalculates timing. Opt-out is checked again at execution. Duplicate events are idempotent.</span></div>
        </div>
      </div>}
      {tab==="Runs"&&<div style={{paddingBottom:14}}><div className="between" style={{marginBottom:11}}><div><h2>Run history · {location.split(" · ")[0]}</h2><span className="caption">Why enrolled, delayed, exited or blocked.</span></div><select aria-label="Filter workflow runs" className="select" value={runFilter} onChange={e=>setRunFilter(e.target.value)}><option>All runs</option><option>Blocked</option><option>Delayed</option><option>Completed</option></select></div>{scopedRuns.length?<div className="responsive-table"><table className="table"><thead><tr><th>Family / athlete</th><th>Event</th><th>Outcome</th><th>Reason</th><th>Version</th><th>When</th></tr></thead><tbody>{scopedRuns.map(r=><tr key={r[0]}><td><strong>{r[0]}</strong></td><td>{r[1]}</td><td><span className={`tag ${r[2].includes("Blocked")||r[2].includes("Skipped")?"red":r[2].includes("Duplicate")?"blue":"green"}`}>{r[2]}</span></td><td>{r[3]}</td><td className="mono">{r[4]}</td><td>{r[5]}</td></tr>)}</tbody></table></div>:<div className="empty"><div className="empty-mark"><Activity size={16}/></div><h3>No runs in this location</h3><p className="small-text muted">This synthetic run gallery is location-scoped.</p></div>}<div className="notice blue" style={{marginTop:10}}><Activity size={14}/><span>Human takeover pauses the related run. Scheduled sends re-check consent, quiet hours, location, caps and current appointment at execution.</span></div></div>}
      {tab==="Failure center"&&<div style={{paddingBottom:14}}><div className="between" style={{marginBottom:12}}><div><h2>Failure center · {location.split(" · ")[0]}</h2><span className="caption">Investigate uncertain outcomes before any retry.</span></div><span className="tag red">{scopedFailures.length} need review</span></div>{scopedFailures.length?scopedFailures.map((x,i)=><div className="panel panel-pad" style={{marginBottom:8}} key={x[0]}><div className="between"><div><strong>{x[0]}</strong><div className="small-text muted">{x[1]}</div><div className="small-text" style={{marginTop:4}}>{x[2]}</div></div><button className="btn small" onClick={()=>flash(i===0?"Investigate event details first. Blind retry remains blocked.":"Recovery preview opened; no execution occurs.")}>{x[3]}</button></div></div>):<div className="empty"><div className="empty-mark"><CheckCircle2 size={16}/></div><h3>No open exceptions here</h3><p className="small-text muted">No synthetic failures are assigned to this location.</p></div>}</div>}
    </div>
    <div className="notice" style={{marginTop:12}}><LockKeyhole size={14}/><span>Proposed semantics: tag-added/removed triggers, has/any/all branches, add/remove actions, goal exits, re-entry controls, loops guard and idempotency. SMS tags never equal consent. Corporate proposal requires location approval and may be locally overridden.</span></div>
  </section>;
}
