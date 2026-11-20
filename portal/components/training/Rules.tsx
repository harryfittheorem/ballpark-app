'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { TrainingOverview } from '@/lib/training/types';
import { request, useAction, useResource } from './api';
import { Empty, Feedback, LoadError, Loading } from './ui';
import styles from './training.module.css';
type Rule={id:string;title:string;audience:string;course_id:string|null;path_id:string|null;due_days:number;repeat_days:number|null;enabled:boolean};
export function Rules({overview,onSaved}:{overview:TrainingOverview;onSaved:()=>Promise<void>}) {
  const data=useResource<{rules:Rule[]}>('/api/training/rules');
  const action=useAction();
  const [editing,setEditing]=useState('');
  const [title,setTitle]=useState(''),[audience,setAudience]=useState('coach'),[kind,setKind]=useState('course'),[target,setTarget]=useState('');
  const [days,setDays]=useState(7),[repeat,setRepeat]=useState(''),[enabled,setEnabled]=useState(true);
  if(!data.data)return data.error ? <LoadError error={data.error} retry={()=>void data.reload()}/> : <Loading/>;
  function reset(){setEditing('');setTitle('');setTarget('');setRepeat('');setEnabled(true);}
  return <div className={styles.stack}>
    <h2>Onboarding & refresher rules</h2>
    <p className={styles.notice}>Rules apply when a matching person opens Training Playbook. “Apply to current team” enrolls existing team members now. Due and overdue reminders appear in My Training; this does not send emails. Existing unfinished assignments are retained, not reset.</p>
    <Feedback {...action}/><Feedback error={data.error}/>
    <form className={`${styles.panel} ${styles.stack}`} onSubmit={e=>{e.preventDefault();void action.run(async()=>{
      await request(`/api/training/rules${editing?'/'+editing:''}`,editing?'PATCH':'POST',{title,audience,courseId:kind==='course'?target:null,pathId:kind==='path'?target:null,dueDays:days,repeatDays:repeat?Number(repeat):null,enabled});
      reset();await data.reload();return true;
    },'Rule saved. It will apply on the next training visit, or apply it to the current team now.');}}>
      <h3>{editing?'Edit rule':'Create a rule'}</h3>
      <fieldset disabled={action.pending} className={styles.stack}>
        <label>Rule name<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label>
        <div className={styles.grid}><label>Audience<select value={audience} onChange={e=>setAudience(e.target.value)}>{['coach','staff','admin','owner'].map(r=><option key={r}>{r}</option>)}</select></label>
          <label>Training type<select value={kind} onChange={e=>{setKind(e.target.value);setTarget('');}}><option value="course">Course</option><option value="path">Learning path</option></select></label>
          <label>Training<select required value={target} onChange={e=>setTarget(e.target.value)}><option value="">Choose…</option>{kind==='course'?overview.courses.filter(c=>c.published_version&&!c.archived).map(c=><option key={c.id} value={c.id}>{c.draft.title}</option>):overview.paths.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></label></div>
        <div className={styles.grid}><label>Due within days<input required type="number" min={1} max={365} value={days} onChange={e=>setDays(Number(e.target.value))}/></label>
          <label>Refresh after completion (days, optional)<input type="number" min={1} max={730} value={repeat} onChange={e=>setRepeat(e.target.value)}/></label></div>
        <label className={styles.check}><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>Enabled</label>
        <div className={styles.row}><Button type="submit">Save rule</Button>{editing&&<Button type="button" variant="ghost" onClick={reset}>Cancel edit</Button>}</div>
      </fieldset>
    </form>
    <Button disabled={action.pending||!data.data.rules.some(r=>r.enabled)} variant="secondary" onClick={()=>{
      if(window.confirm('Apply enabled rules to current team members? This creates training assignments but sends no messages.'))void action.run(async()=>{const r=await request<{count:number}>('/api/training/rules','POST',{action:'apply'});await onSaved();return r;},'Enabled rules applied to the current team.');
    }}>Apply to current team</Button>
    {!data.data.rules.length&&<Empty title="No automatic enrollment rules">Create a rule after publishing your first training course.</Empty>}
    {data.data.rules.map(r=><article className={`${styles.panel} ${styles.spread}`} key={r.id}><div><h3>{r.title}</h3><p className={styles.muted}>{r.audience} · Due in {r.due_days} days · {r.repeat_days?`Refresh ${r.repeat_days} days after completion`:'One-time per published version'} · {r.enabled?'Enabled':'Disabled'}</p></div>
      <Button variant="secondary" disabled={action.pending} onClick={()=>{setEditing(r.id);setTitle(r.title);setAudience(r.audience);setKind(r.course_id?'course':'path');setTarget(r.course_id||r.path_id||'');setDays(r.due_days);setRepeat(r.repeat_days?String(r.repeat_days):'');setEnabled(r.enabled);}}>Edit rule</Button></article>)}
  </div>;
}
