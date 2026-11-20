import type { ReactNode } from 'react';

// Small safe Markdown subset. React escapes all source text; no HTML execution.
function inline(text:string):ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https:\/\/[^)\s]+\))/g).map((part,i)=>{
    if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
    if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
    const link=part.match(/^\[([^\]]+)\]\((https:\/\/[^)\s]+)\)$/);
    if(link)return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-gold underline">{link[1]}</a>;
    return part;
  });
}
export function FormattedText({text}:{text:string}) {
  const lines=text.split('\n'), nodes:ReactNode[]=[];
  for(let i=0;i<lines.length;i++){
    const line=lines[i], heading=line.match(/^(#{1,3})\s+(.+)/);
    if(heading){nodes.push(<h3 key={i} className="mt-5 mb-2 font-semibold text-cream-light">{inline(heading[2])}</h3>);continue;}
    if(line.includes('|')&&i+1<lines.length&&/^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i+1])){
      const cells=(s:string)=>s.replace(/^\s*\||\|\s*$/g,'').split('|').map(c=>c.trim());
      const headers=cells(line), rows:string[][]=[];const key=i;i+=2;
      while(i<lines.length&&lines[i].includes('|')){rows.push(cells(lines[i]));i++;}i--;
      nodes.push(<div key={key} className="overflow-x-auto my-3"><table className="w-full border-collapse text-sm"><thead><tr>{headers.map((c,j)=><th key={j} className="border border-border-gold p-2 text-left">{inline(c)}</th>)}</tr></thead><tbody>{rows.map((r,j)=><tr key={j}>{r.map((c,k)=><td key={k} className="border border-border-gold p-2">{inline(c)}</td>)}</tr>)}</tbody></table></div>);continue;
    }
    const bullet=line.match(/^\s*[-*]\s+(.+)/);
    if(bullet){nodes.push(<div key={i} className="pl-4 my-1">• {inline(bullet[1])}</div>);continue;}
    nodes.push(line.trim()?<p key={i} className="my-2 whitespace-pre-wrap break-words">{inline(line)}</p>:<div key={i} className="h-2"/>);
  }
  return <div className="leading-7 text-sm">{nodes}</div>;
}
