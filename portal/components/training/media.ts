import type { Lesson } from '../../lib/training/types';

// Older published revisions may have video URLs only in their Markdown body.
// Derive players at render time without rewriting pinned learner revisions.
export function lessonReferences(lesson: Lesson): NonNullable<Lesson['references']> {
  const references = [...(lesson.references || [])];
  if (lesson.externalUrl && !references.some(r => r.url === lesson.externalUrl)) {
    references.push({url:lesson.externalUrl,kind:videoEmbed(lesson.externalUrl) ? 'video' : 'resource',label:'External resource',status:'linked'});
  }
  const represented=new Set(references.map(r=>videoEmbed(r.url)?.url).filter(Boolean));
  for(const raw of lesson.body.match(/https:\/\/[^\s<>"\]]+/g) || []) {
    const url=raw.replace(/[).,;]+$/, '');
    const embed=videoEmbed(url);
    if(!embed || represented.has(embed.url))continue;
    represented.add(embed.url);
    references.push({url,kind:'video',label:`${embed.provider} video`,status:'linked'});
  }
  return references;
}

export function safeUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Only construct embed URLs from known providers and validated IDs, never imported HTML.
export function videoEmbed(value: string): { url: string; provider: string } | null {
  if (!safeUrl(value)) return null;
  const url = new URL(value);
  if (url.protocol !== 'https:') return null;
  const host = url.hostname.toLowerCase();
  let id: string | null = null;
  if (host === 'youtu.be') id = url.pathname.split('/')[1];
  if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'].includes(host)) {
    const parts = url.pathname.split('/');
    id = url.pathname === '/watch' ? url.searchParams.get('v') : ['embed', 'shorts', 'live'].includes(parts[1]) ? parts[2] : null;
  }
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { url: `https://www.youtube-nocookie.com/embed/${id}`, provider: 'YouTube' };
  if (['loom.com', 'www.loom.com'].includes(host)) {
    const parts = url.pathname.split('/');
    if (['share', 'embed'].includes(parts[1]) && /^[a-fA-F0-9]{32}$/.test(parts[2] || '')) return { url: `https://www.loom.com/embed/${parts[2]}`, provider: 'Loom' };
  }
  return null;
}
