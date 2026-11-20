import { useState } from "react";
import { ArrowUpRight, Ban, GitBranch, Search, Tag } from "lucide-react";
import { PageHead } from "./SharedChrome";
import type { families } from "./demoData";

type FamilyRecord = (typeof families)[number];
interface AudienceRow {
  adult: string;
  athletes: string;
  location: string;
  eligible: boolean;
  reason: string;
}
interface TagsViewProps {
  tags: string[];
  setTags: (tags: string[]) => void;
  archivedTags: string[];
  onRename: (previous: string, next: string) => void;
  onArchive: (tag: string) => void;
  onRestore: (tag: string) => void;
  families: FamilyRecord[];
  location: string;
  role: string;
  audienceRule: string;
  setRule: (rule: string) => void;
  audienceTags: string[];
  setAudienceTags: (tags: string[]) => void;
  audienceLocation: string;
  setAudienceLocation: (location: string) => void;
  membership: string;
  setMembership: (membership: string) => void;
  audienceLogic: string;
  setLogic: (logic: string) => void;
  onPreview: (preview: { included: AudienceRow[]; excluded: AudienceRow[] }) => void;
  flash: (message: string) => void;
}

export function TagsView({ tags, setTags, archivedTags, onRename, onArchive, onRestore, families: records, location, role, audienceRule, setRule, audienceTags, setAudienceTags, audienceLocation, setAudienceLocation, membership, setMembership, audienceLogic: logic, setLogic, onPreview, flash }: TagsViewProps) {
  const [newTag,setNewTag]=useState("");
  const [tagQuery,setTagQuery]=useState("");
  const selectedTags:string[]=audienceTags.length?audienceTags:[];
  const evaluation=records.map((family)=>{
    const tagsMatch=selectedTags.length>0&&(audienceRule==="has"?family.tags.includes(selectedTags[0]):audienceRule==="does not have"?selectedTags.every((t:string)=>!family.tags.includes(t)):audienceRule==="has any"?selectedTags.some((t:string)=>family.tags.includes(t)):selectedTags.every((t:string)=>family.tags.includes(t)));
    const locationMatch=audienceLocation==="Any location"||family.location===audienceLocation;
    const membershipMatch=membership==="Any membership"||family.membership.toLowerCase()===membership.toLowerCase();
    const ruleMatches=logic==="AND"?[tagsMatch,locationMatch,membershipMatch].every(Boolean):[tagsMatch,locationMatch,membershipMatch].some(Boolean);
    const reason=family.status==="Opted out"?"SMS opt-out":family.status==="Review"?"Guardian / recipient needs review":!ruleMatches?[!tagsMatch?"Tag condition does not match":null,!locationMatch?"Location condition does not match":null,!membershipMatch?"Membership condition does not match":null].filter(Boolean).join(" · "):"";
    return {adult:family.adult,athletes:family.athletes,location:family.location,eligible:!reason,reason};
  });
  const seenAdults=new Set<string>();
  const included:AudienceRow[]=[];
  const excluded:AudienceRow[]=[];
  evaluation.forEach((row)=>{if(!row.eligible){excluded.push(row);return;}if(seenAdults.has(row.adult)){excluded.push({...row,reason:"Duplicate adult record · household context retained on the included entry"});return;}seenAdults.add(row.adult);included.push(row);});
  const preview={included,excluded};
  return <section><PageHead title="Tags & audiences" sub="Flexible organization, correct entity meaning. A tag is never consent." children={<span className="tag blue">Scope · {location.split(" · ")[0]}</span>}/>
    <div className="notice" style={{marginBottom:13}}><Tag size={14}/><span>Canonical fields remain authoritative for membership, billing, consent and sport. Tag refs are stable; renames preserve references. Archive warns about filters and workflows.{role.startsWith("Instructor")?" Instructor lens can preview assigned context but cannot edit the shared library.":""}</span></div>
    <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(300px,.94fr)",gap:13}}>
      <div className="panel"><div className="panel-pad"><div className="section-title"><div><h2>Tag library</h2><div className="caption">{tags.length} active tags · family, adult and athlete scopes</div></div><div className="row"><Search size={13}/><input aria-label="Search tags" className="input" placeholder="Find tag" value={tagQuery} onChange={e=>setTagQuery(e.target.value)} style={{width:120,padding:"6px 8px"}}/></div></div>{!role.startsWith("Instructor")&&<div className="field"><label htmlFor="tag-create">New tag name</label><div className="row"><input id="tag-create" className="input" placeholder="e.g. Interested · winter clinic" value={newTag} onChange={e=>setNewTag(e.target.value)} style={{flex:1}}/><button className="btn small primary" onClick={()=>{if(newTag.trim()&&!tags.includes(newTag.trim())){setTags([...tags,newTag.trim()]);setNewTag("");flash("Tag created in local demo library.");}}}>Create tag</button></div></div>}</div>
        <div className="responsive-table"><table className="table"><thead><tr><th>Name</th><th>Entity scope</th><th>References</th><th></th></tr></thead><tbody>{tags.filter((t:string)=>t.toLowerCase().includes(tagQuery.toLowerCase())).map((t:string,i:number)=><tr key={t}><td><span className="tag">{t}</span></td><td>{i%3===1?"Athlete":"Family"}</td><td>{i===1?"3 workflows · 2 filters":"1 audience · 1 workflow"}</td><td>{!role.startsWith("Instructor")&&<div className="row"><button className="btn small" onClick={()=>{const next=prompt("Rename tag",t);if(next?.trim())onRename(t,next.trim());}}>Rename</button><button className="btn small danger" onClick={()=>{if(window.confirm(`Archive "${t}"? Existing record references will be preserved.`))onArchive(t);}}>Archive</button></div>}</td></tr>)}</tbody></table>{archivedTags.length>0&&!role.startsWith("Instructor")&&<div className="panel-pad"><div className="eyebrow">Archived · existing references retained</div><div className="row" style={{marginTop:7,flexWrap:"wrap"}}>{archivedTags.map((t:string)=><span className="tag neutral" key={t}>{t}<button className="icon-btn" aria-label={`Restore ${t}`} onClick={()=>onRestore(t)}><ArrowUpRight size={11}/></button></span>)}</div></div>}</div></div>
      <div className="stack"><div className="panel panel-pad"><div className="section-title"><div><h2>Audience rule builder</h2><div className="caption">Evaluate eligible adults at send time, not only at enrollment.</div></div><span className="tag blue">Saved audience</span></div>
        <div className="field"><label htmlFor="audience-join">Combine conditions</label><select id="audience-join" className="select" value={logic} onChange={e=>setLogic(e.target.value)}><option>AND</option><option>OR</option></select></div>
        <div className="field" style={{marginTop:8}}><label htmlFor="audience-tag-rule">Tag condition</label><select id="audience-tag-rule" className="select" value={audienceRule} onChange={e=>setRule(e.target.value)}><option value="has">Has (first selected)</option><option value="does not have">Does not have any selected</option><option value="has any">Has any selected</option><option value="has all">Has all selected</option></select></div>
        <div className="field" style={{marginTop:8}}><label htmlFor="audience-tags">Tags · multi-select for any/all/exclusion</label><select id="audience-tags" className="select" multiple size={3} value={selectedTags} onChange={e=>setAudienceTags(Array.from(e.target.selectedOptions).map(x=>x.value))}>{tags.map((t:string)=><option key={t}>{t}</option>)}</select><span className="small-text muted">{selectedTags.length?selectedTags.join(" · "):"No tags selected"}</span></div>
        <div className="row" style={{marginTop:9,flexWrap:"wrap"}}><div className="field"><label htmlFor="audience-location">Location</label><select id="audience-location" className="select" value={audienceLocation} onChange={e=>setAudienceLocation(e.target.value)}>{["Any location","North Loop","Cedar Park","Round Rock"].map(v=><option key={v}>{v}</option>)}</select></div><div className="field"><label htmlFor="audience-membership">Membership</label><select id="audience-membership" className="select" value={membership} onChange={e=>setMembership(e.target.value)}>{["Any membership","Prospect","Member","Lead"].map(v=><option key={v}>{v}</option>)}</select></div></div>
        <hr className="divider"/><div className="between"><strong>Eligible adult preview</strong><span className="tag green">{included.length} included</span></div><div className="small-text" style={{marginTop:8}}>{included.map((x:any)=><div key={x.adult}>{x.adult} · {x.location} · guardian of {x.athletes}</div>)}{!included.length&&<span className="muted">No adults match these current rules.</span>}</div><div className="notice red" style={{marginTop:10}}><Ban size={14}/><span><strong>Excluded · {excluded.length} records</strong><br/>{excluded.length?excluded.map((x:any)=><span key={x.adult}>{x.adult} · {x.reason}<br/></span>):"No exclusions."}</span></div><div className="small-text muted" style={{marginTop:9}}>Sibling outreach deduplicates adults only when the same adult is genuinely repeated. Current rules use {logic} between tag, location and membership conditions. Consent is checked separately at execution.</div><button className="btn primary" style={{marginTop:12}} onClick={()=>onPreview(preview)}>Review computed preview</button>
      </div>
        <div className="panel panel-pad"><div className="section-title"><h2>Workflow tag events</h2><span className="tag neutral">No outreach from tags alone</span></div><div className="small-text"><strong>Added:</strong> Interested · camps → check eligible adult → approved template → wait for reply/booking → staff follow-up.<br/><br/><strong>Removed:</strong> clear stale interest → do not re-enroll same event; manual/workflow conflict routes to review.</div><div className="notice blue" style={{marginTop:10}}><GitBranch size={14}/><span>Tag reapplication is idempotent. Entry event is deduplicated; self-trigger loops are guarded. Athlete-interest tags do not propagate to siblings or guardian.</span></div></div>
      </div>
    </div>
  </section>;
}
