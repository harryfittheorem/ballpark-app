'use client';

import { useState } from 'react';
import { Search, Phone, Mail, User, Clock } from 'lucide-react';
import type { StaffFamilyContact } from '@/lib/supabase/ownerQueries';

const RTF = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function relativeTime(iso: string | null): string {
  if (!iso) return 'No sessions yet';
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return 'just now';
  if (abs < 3600) return RTF.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return RTF.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 7) return RTF.format(Math.round(diff / 86400), 'day');
  if (abs < 86400 * 30) return RTF.format(Math.round(diff / (86400 * 7)), 'week');
  if (abs < 86400 * 365) return RTF.format(Math.round(diff / (86400 * 30)), 'month');
  return RTF.format(Math.round(diff / (86400 * 365)), 'year');
}

interface Props {
  families: StaffFamilyContact[];
}

export function StaffFamiliesContent({ families }: Props) {
  const [search, setSearch] = useState('');

  const filtered = search.trim()
    ? families.filter(f => {
        const q = search.toLowerCase();
        const parentName = `${f.parentFirstName} ${f.parentLastName}`.toLowerCase();
        const kidNames = f.kids.map(k => `${k.firstName} ${k.lastName}`.toLowerCase()).join(' ');
        return (
          parentName.includes(q) ||
          kidNames.includes(q) ||
          (f.parentEmail ?? '').toLowerCase().includes(q) ||
          (f.parentPhone ?? '').includes(q)
        );
      })
    : families;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl font-semibold uppercase tracking-wide text-cream-light">
          Families
        </h1>
        <p className="mt-1 text-sm text-text-light">
          {families.length} famil{families.length !== 1 ? 'ies' : 'y'} · Contact directory
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-light"
        />
        <input
          type="search"
          placeholder="Search by name, email, or phone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-border-gold bg-darker pl-8 pr-4 py-2 text-sm text-cream-light placeholder:text-text-light outline-none focus:border-gold"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border-gold bg-darker px-6 py-12 text-center">
          <p className="text-sm text-text-light">
            {search ? 'No families match your search.' : 'No families found.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-gold">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-gold bg-darker">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-light">
                  Parent
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-light">
                  Contact
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-light">
                  Athletes
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.12em] text-text-light">
                  Last Session
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => (
                <tr
                  key={f.familyId}
                  className={[
                    'border-b border-border-gold last:border-0',
                    i % 2 === 0 ? 'bg-darkest' : 'bg-darker',
                  ].join(' ')}
                >
                  {/* Parent name */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold/10 border border-border-gold font-display text-xs font-bold text-gold">
                        {f.parentFirstName.charAt(0)}{f.parentLastName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-cream-light">
                          {f.parentFirstName} {f.parentLastName}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Contact info */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-text-light">
                        <Mail size={11} className="flex-shrink-0 text-text-light" />
                        <a
                          href={`mailto:${f.parentEmail}`}
                          className="hover:text-gold transition-colors truncate max-w-[200px]"
                        >
                          {f.parentEmail}
                        </a>
                      </div>
                      {f.parentPhone ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-light">
                          <Phone size={11} className="flex-shrink-0 text-text-light" />
                          <a
                            href={`tel:${f.parentPhone}`}
                            className="hover:text-gold transition-colors"
                          >
                            {f.parentPhone}
                          </a>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-text-light/40">
                          <Phone size={11} />
                          <span>No phone on file</span>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Athletes */}
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {f.kids.length === 0 ? (
                        <div className="flex items-center gap-1.5 text-xs text-text-light/40">
                          <User size={11} />
                          <span>No athletes</span>
                        </div>
                      ) : (
                        f.kids.map(k => (
                          <div key={k.id} className="flex items-center gap-1.5 text-xs text-cream-light">
                            <User size={11} className="flex-shrink-0 text-text-light" />
                            <span>
                              {k.firstName} {k.lastName}
                              {k.ageGroup && (
                                <span className="ml-1 text-text-light">({k.ageGroup})</span>
                              )}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </td>

                  {/* Last session */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-text-light">
                      <Clock size={11} className="flex-shrink-0" />
                      <span>{relativeTime(f.lastSessionDate)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
