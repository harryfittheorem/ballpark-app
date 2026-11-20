'use client';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormattedText } from './FormattedText';
import styles from './training.module.css';
export function TextEditor({value,onChange}:{value:string;onChange:(v:string)=>void}) {
  const area=useRef<HTMLTextAreaElement>(null),id=useId();
  const [preview,setPreview]=useState(false);
  function insert(before:string,after='',fallback='text'){
    const el=area.current;if(!el)return;
    const start=el.selectionStart,end=el.selectionEnd;
    onChange(value.slice(0,start)+before+(value.slice(start,end)||fallback)+after+value.slice(end));
    el.focus();
  }
  return <div className={styles.stack}><label htmlFor={id}>Lesson body</label>
    <div className={styles.row}>
      <Button type="button" size="sm" variant="secondary" disabled={preview} onClick={()=>insert('**','**','Bold text')}>Bold</Button>
      <Button type="button" size="sm" variant="secondary" disabled={preview} onClick={()=>insert('\n## ','\n','Heading')}>Heading</Button>
      <Button type="button" size="sm" variant="secondary" disabled={preview} onClick={()=>insert('\n- ','\n','List item')}>List</Button>
      <Button type="button" size="sm" variant="secondary" disabled={preview} onClick={()=>insert('[','](https://example.com)','Link title')}>Link</Button>
      <Button type="button" size="sm" variant="secondary" disabled={preview} onClick={()=>insert('\n| Column | Detail |\n| --- | --- |\n| ',' | Value |\n','Item')}>Table</Button>
      <Button type="button" size="sm" variant="ghost" onClick={()=>setPreview(!preview)}>{preview?'Edit text':'Preview'}</Button>
    </div>
    {preview?<div className={styles.panel}><FormattedText text={value}/></div>:<textarea id={id} ref={area} value={value} onChange={e=>onChange(e.target.value)} rows={9}/>}
    <p className={styles.muted}>Formatting uses safe Markdown: headings, bold, lists, HTTPS links and tables. Original HTML is displayed as text, never executed.</p>
  </div>;
}
