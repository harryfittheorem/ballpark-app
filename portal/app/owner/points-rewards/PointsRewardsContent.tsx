'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Plus, Sparkles, Edit2, X } from 'lucide-react';
import type { PointsRewardsData, PointsProduct } from '@/lib/supabase/ownerQueries';
import { PlayerLink } from '@/components/owner/PlayerLink';

// ── Types ──────────────────────────────────────────────────────────────────

type Rule = { id: number; action: string; points: number; active: boolean };

type RewardForm = {
  name: string;
  category: string;
  image_url: string;
  cost: string;
  dollar_price: string;
  inventory: string;
  is_active: boolean;
};

// ── Initial rules ──────────────────────────────────────────────────────────

const INITIAL_RULES: Rule[] = [
  { id: 1,  action: 'Complete a booked session',               points: 10,  active: true  },
  { id: 2,  action: 'Upload swing for coach feedback',         points: 15,  active: true  },
  { id: 3,  action: 'Post a Google review',                    points: 100, active: true  },
  { id: 4,  action: 'Follow on Instagram',                     points: 25,  active: true  },
  { id: 5,  action: 'Subscribe on YouTube',                    points: 25,  active: true  },
  { id: 6,  action: 'Log game stats (self-reported)',          points: 20,  active: true  },
  { id: 7,  action: 'Weekly attendance milestone (4 sessions)', points: 50,  active: true  },
  { id: 8,  action: 'Monthly attendance streak (every session)', points: 75, active: true  },
  { id: 9,  action: '1-year membership anniversary',          points: 200, active: true  },
  { id: 10, action: 'HitTrax leaderboard Top 3 finish',       points: 150, active: true  },
  { id: 11, action: 'Unlock an achievement',                  points: 50,  active: true  },
  { id: 12, action: 'Refer a new family (member enrolls)',     points: 300, active: true  },
];

// ── Demo rewards catalog ───────────────────────────────────────────────────

const DEMO_PRODUCTS: PointsProduct[] = [
  { id: 'p1', name: 'Infinite Hitting T-Shirt',   category: 'Apparel',   cost: 500,   inventory: 80,   fulfilled: 34, pending: 5, image_url: null },
  { id: 'p2', name: 'IH Water Bottle',             category: 'Apparel',   cost: 300,   inventory: 100,  fulfilled: 52, pending: 6, image_url: null },
  { id: 'p3', name: 'Bat Sticker Pack',            category: 'Apparel',   cost: 150,   inventory: null, fulfilled: 88, pending: 9, image_url: null },
  { id: 'p4', name: 'Free Private Lesson (30min)', category: 'Sessions',  cost: 800,   inventory: null, fulfilled: 11, pending: 1, image_url: null },
  { id: 'p5', name: 'Baseball Bat (Youth)',         category: 'Equipment', cost: 3500,  inventory: 5,    fulfilled: 2,  pending: 1, image_url: null },
  { id: 'p6', name: 'MLB Game Tickets (2)',         category: 'Experiences', cost: 5000, inventory: 10,  fulfilled: 3,  pending: 2, image_url: null },
  { id: 'p7', name: 'PS5 Console',                 category: 'Electronics', cost: 15000, inventory: 2,  fulfilled: 0,  pending: 1, image_url: null },
];

const DEMO_TOP_EARNERS = [
  { name: 'Caleb N.',  points: 2840, kidId: null },
  { name: 'Aiden T.',  points: 2210, kidId: null },
  { name: 'Jake M.',   points: 1980, kidId: null },
  { name: 'Logan S.',  points: 1640, kidId: null },
];

// ── Style helpers ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${brand.border}`,
  borderRadius: 7, fontSize: 13, color: brand.text, background: brand.surface,
  fontFamily: fonts.body, outline: 'none', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: brand.textMuted, letterSpacing: 0.5,
  textTransform: 'uppercase', marginBottom: 5, display: 'block',
};

// ── Shared modal shell ────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: 480, background: brand.surface, borderRadius: 12, border: `1px solid ${brand.border}`, boxShadow: '0 16px 48px rgba(0,0,0,0.2)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: `1px solid ${brand.border}` }}>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: fonts.display }}>{title}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <X size={16} color={brand.textMuted} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Toggle switch ─────────────────────────────────────────────────────────

function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={e => { e.stopPropagation(); onToggle(); }}
      title={active ? 'Click to deactivate' : 'Click to activate'}
      style={{ width: 44, height: 24, borderRadius: 12, background: active ? brand.success : brand.border, position: 'relative', cursor: 'pointer', flexShrink: 0, transition: 'background 0.18s' }}
    >
      <div style={{ position: 'absolute', top: 2, left: active ? 22 : 2, width: 20, height: 20, borderRadius: 10, background: brand.white, boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.18s' }} />
    </div>
  );
}

// ── Product thumbnail helper ───────────────────────────────────────────────

function ProductThumb({ imageUrl, name }: { imageUrl?: string | null; name: string }) {
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, border: `1px solid ${brand.border}` }}>
      {imageUrl ? (
        <img src={imageUrl} alt={name} style={{ width: 40, height: 40, objectFit: 'cover' }} />
      ) : (
        <Sparkles size={16} color={brand.goldDeep} />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────

type Props = { data: PointsRewardsData };

// ── Helpers ───────────────────────────────────────────────────────────────

const EMPTY_REWARD_FORM: RewardForm = {
  name: '', category: '', image_url: '', cost: '', dollar_price: '', inventory: '', is_active: true,
};

function productToForm(p: PointsProduct): RewardForm {
  return {
    name: p.name,
    category: p.category,
    image_url: p.image_url ?? '',
    cost: String(p.cost),
    dollar_price: '',
    inventory: p.inventory !== null ? String(p.inventory) : '',
    is_active: true,
  };
}

// ── Component ──────────────────────────────────────────────────────────────

export function PointsRewardsContent({ data }: Props) {
  const [tab,   setTab]   = useState<'rules' | 'rewards' | 'hittrax'>('rules');
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);

  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);

  const [editForm, setEditForm] = useState({ action: '', points: '' });
  const [addForm,  setAddForm]  = useState({ action: '', points: '' });
  const [hoveredEditId, setHoveredEditId] = useState<number | null>(null);

  const hasLiveData       = data.totalPointsIssued > 0 || data.products.length > 0 || data.topEarners.length > 0;
  const initialProducts   = hasLiveData ? data.products : DEMO_PRODUCTS;
  const totalPointsIssued = hasLiveData ? data.totalPointsIssued : 18_450;
  const topEarners        = hasLiveData ? data.topEarners  : DEMO_TOP_EARNERS;

  const [localProducts, setLocalProducts] = useState<PointsProduct[]>(initialProducts);

  // ── Reward modal state ────────────────────────────────────────────────────
  const [editingProduct, setEditingProduct] = useState<PointsProduct | null | 'new'>(null);
  const [rewardForm, setRewardForm] = useState<RewardForm>(EMPTY_REWARD_FORM);

  // ── Rule handlers ─────────────────────────────────────────────────────────

  const openEditRule = (rule: Rule) => {
    setEditForm({ action: rule.action, points: String(rule.points) });
    setEditingRule(rule);
  };

  const saveEditRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule) return;
    const pts = parseInt(editForm.points, 10);
    if (!editForm.action.trim() || isNaN(pts) || pts < 1) return;
    setRules(prev => prev.map(r => r.id === editingRule.id ? { ...r, action: editForm.action.trim(), points: pts } : r));
    setEditingRule(null);
  };

  const openAddRule = () => {
    setAddForm({ action: '', points: '' });
    setShowAddRule(true);
  };

  const saveAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(addForm.points, 10);
    if (!addForm.action.trim() || isNaN(pts) || pts < 1) return;
    const newId = Math.max(0, ...rules.map(r => r.id)) + 1;
    setRules(prev => [{ id: newId, action: addForm.action.trim(), points: pts, active: true }, ...prev]);
    setShowAddRule(false);
  };

  const toggleRule = (id: number) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  // ── Reward handlers ───────────────────────────────────────────────────────

  const openAddReward = () => {
    setRewardForm(EMPTY_REWARD_FORM);
    setEditingProduct('new');
  };

  const openEditReward = (product: PointsProduct) => {
    setRewardForm(productToForm(product));
    setEditingProduct(product);
  };

  const closeRewardModal = () => setEditingProduct(null);

  const saveReward = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = parseInt(rewardForm.cost, 10);
    if (!rewardForm.name.trim() || isNaN(cost) || cost < 1) return;

    const inv = rewardForm.inventory.trim() !== '' ? parseInt(rewardForm.inventory, 10) : null;

    if (editingProduct === 'new') {
      const newProduct: PointsProduct = {
        id: `local-${Date.now()}`,
        name: rewardForm.name.trim(),
        category: rewardForm.category.trim() || 'General',
        cost,
        inventory: inv,
        fulfilled: 0,
        pending: 0,
        image_url: rewardForm.image_url.trim() || null,
      };
      setLocalProducts(prev => [newProduct, ...prev]);
    } else if (editingProduct !== null) {
      setLocalProducts(prev => prev.map(p =>
        p.id === editingProduct.id
          ? { ...p, name: rewardForm.name.trim(), category: rewardForm.category.trim() || 'General', cost, inventory: inv, image_url: rewardForm.image_url.trim() || null }
          : p
      ));
    }
    closeRewardModal();
  };

  // ── Table columns ─────────────────────────────────────────────────────────

  const rewardColumns: TableColumn<PointsProduct & Record<string, unknown>>[] = [
    {
      label: 'Reward', key: 'name',
      render: (r) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ProductThumb imageUrl={r.image_url as string | null | undefined} name={r.name as string} />
          <div style={{ fontWeight: 700 }}>{r.name as string}</div>
        </div>
      ),
    },
    { label: 'Category', key: 'category', render: (r) => <Chip color="gold">{r.category as string}</Chip> },
    { label: 'Cost',      key: 'cost',      align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, fontWeight: 700, color: brand.goldDeep }}>{r.cost as number} pts</span> },
    { label: 'Inventory', key: 'inventory', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono }}>{r.inventory !== null ? String(r.inventory) : '∞'}</span> },
    { label: 'Fulfilled', key: 'fulfilled', align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: brand.success, fontWeight: 700 }}>{r.fulfilled as number}</span> },
    { label: 'Pending',   key: 'pending',   align: 'right', render: (r) => <span style={{ fontFamily: fonts.mono, color: (r.pending as number) > 0 ? brand.warning : brand.textMuted, fontWeight: 700 }}>{r.pending as number}</span> },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <PageHeader
        title="Points & Rewards"
        subtitle="Configure the points system that drives athlete engagement"
        actions={
          tab !== 'hittrax' ? (
            <OButton
              variant="gold"
              icon={Plus}
              onClick={tab === 'rules' ? openAddRule : openAddReward}
            >
              {tab === 'rules' ? 'Add Rule' : 'Add Reward'}
            </OButton>
          ) : undefined
        }
      />

      <div style={{ padding: 24 }}>
        <div className="portal-sticky-tabs portal-sticky-tab-row" role="tablist" aria-label="Points and rewards sections" style={{ marginBottom: 20 }}>
          {[
            { id: 'rules'   as const, label: 'Earning Rules',   count: rules.length },
            { id: 'rewards' as const, label: 'Rewards Catalog', count: localProducts.length },
            { id: 'hittrax' as const, label: 'HitTrax Leaderboard', count: data.hittraxLeaderboard.length },
          ].map(t => (
            <div
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: tab === t.id ? brand.dark : brand.surface,
                color: tab === t.id ? brand.gold : brand.textMuted,
                border: `1px solid ${tab === t.id ? brand.dark : brand.border}`,
                cursor: 'pointer', fontFamily: fonts.display, letterSpacing: 0.5, textTransform: 'uppercase',
              }}
            >
              {t.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{t.count}</span>
            </div>
          ))}
        </div>

        {tab === 'rules' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
            <OCard padding={0}>
              {rules.map((r, i) => (
                <div
                  key={r.id}
                  style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < rules.length - 1 ? `1px solid ${brand.border}` : 'none', opacity: r.active ? 1 : 0.55, transition: 'opacity 0.18s' }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${brand.gold}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Sparkles size={16} color={brand.goldDeep} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{r.action}</div>
                    <div style={{ fontSize: 11, color: r.active ? brand.textMuted : brand.danger, marginTop: 2 }}>
                      {r.active ? 'Active · auto-awarded' : 'Inactive'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>POINTS</div>
                    <div style={{ padding: '6px 14px', background: brand.dark, color: brand.gold, borderRadius: 8, fontSize: 14, fontWeight: 800, fontFamily: fonts.display, minWidth: 50, textAlign: 'center' }}>
                      +{r.points}
                    </div>
                  </div>
                  <Toggle active={r.active} onToggle={() => toggleRule(r.id)} />
                  <button
                    type="button"
                    onClick={() => openEditRule(r)}
                    title="Edit rule"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                    onMouseEnter={() => setHoveredEditId(r.id)}
                    onMouseLeave={() => setHoveredEditId(null)}
                  >
                    <Edit2 size={14} color={hoveredEditId === r.id ? brand.goldDeep : brand.textMuted} />
                  </button>
                </div>
              ))}
            </OCard>

            <div>
              <SectionHeader title="Impact Preview" />
              <OCard>
                <div style={{ fontSize: 11, color: brand.textMuted, fontWeight: 700, letterSpacing: 1, marginBottom: 10 }}>TOTAL POINTS ISSUED</div>
                <div style={{ fontSize: 32, fontWeight: 700, fontFamily: fonts.display }}>{totalPointsIssued.toLocaleString()}</div>
                <div style={{ marginTop: 16, padding: 12, background: brand.infoBg, borderRadius: 8, fontSize: 11, lineHeight: 1.5 }}>
                  <strong>Changes take effect immediately</strong> for all members. Historical points aren&apos;t affected.
                </div>
              </OCard>

              {topEarners.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <SectionHeader title={`All Earners (${topEarners.length})`} subtitle="All eligible players · highest points first" />
                  <OCard style={{ padding: 0 }}>
                    <div style={{ maxHeight: 480, overflowY: 'auto' }}>
                      {topEarners.map((e, i) => (
                        <div key={i} style={{ padding: '8px 12px', borderBottom: i < topEarners.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? brand.gold : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : brand.dark, color: i < 3 ? brand.dark : brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display, flexShrink: 0 }}>
                            {i + 1}
                          </div>
                          <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}><PlayerLink name={e.name} reference={{ kidId: e.kidId }} /></div>
                          <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono }}>{e.points.toLocaleString()} pts</div>
                        </div>
                      ))}
                    </div>
                  </OCard>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'rewards' && (
          <OTable
            columns={rewardColumns as TableColumn<Record<string, unknown>>[]}
            rows={localProducts as unknown as Record<string, unknown>[]}
            onRowClick={(row) => openEditReward(row as unknown as PointsProduct)}
          />
        )}

        {tab === 'hittrax' && (() => {
          const leaderboard = data.hittraxLeaderboard;
          if (leaderboard.length === 0) {
            return (
              <OCard>
                <div style={{ padding: '32px 16px', textAlign: 'center', color: brand.textMuted, fontSize: 13 }}>
                  No HitTrax sessions recorded yet. Sessions with exit velocity data will appear here.
                </div>
              </OCard>
            );
          }

          // Group by age group.
          const AGE_ORDER = ['8U', '10U', '12U', '14U', 'HS', 'College'];
          const byAge: Record<string, typeof leaderboard> = {};
          for (const e of leaderboard) {
            if (!byAge[e.ageGroup]) byAge[e.ageGroup] = [];
            byAge[e.ageGroup].push(e);
          }
          const ageGroups = [...AGE_ORDER.filter(ag => byAge[ag]), ...Object.keys(byAge).filter(ag => !AGE_ORDER.includes(ag))];

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ padding: '10px 14px', background: brand.surfaceAlt, borderRadius: 8, border: `1px solid ${brand.border}`, fontSize: 12, color: brand.textMuted }}>
                <strong style={{ color: brand.text }}>HitTrax Leaderboard</strong> — Best exit velocity (mph) and max distance (ft) per athlete, pulled from all recorded HitTrax sessions.
                Grouped by age division. Click any athlete to open their profile.
              </div>
              {ageGroups.map(ag => {
                const rows = (byAge[ag] ?? []).slice(0, 10);
                return (
                  <div key={ag}>
                    <SectionHeader title={`${ag} Division`} subtitle={`Top ${rows.length} by exit velocity`} />
                    <OCard padding={0}>
                      <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 90px 90px', gap: 0 }}>
                        <div style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: brand.textMuted, borderBottom: `1px solid ${brand.border}`, background: brand.surfaceAlt }}>#</div>
                        <div style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: brand.textMuted, borderBottom: `1px solid ${brand.border}`, background: brand.surfaceAlt }}>Athlete</div>
                        <div style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: brand.textMuted, borderBottom: `1px solid ${brand.border}`, background: brand.surfaceAlt, textAlign: 'right' }}>Best EV (mph)</div>
                        <div style={{ padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: 0.6, color: brand.textMuted, borderBottom: `1px solid ${brand.border}`, background: brand.surfaceAlt, textAlign: 'right' }}>Max Dist (ft)</div>
                        {rows.map((e, i) => (
                          <>
                            <div key={`${e.kidId}-rank`} style={{ padding: '9px 10px', fontSize: 11, color: brand.textMuted, borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center' }}>
                              <span style={{ width: 20, height: 20, borderRadius: 10, background: i === 0 ? brand.gold : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : brand.dark, color: i < 3 ? brand.dark : brand.gold, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display }}>
                                {i + 1}
                              </span>
                            </div>
                            <div key={`${e.kidId}-name`} style={{ padding: '9px 10px', borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center' }}>
                              <PlayerLink name={e.name} reference={{ kidId: e.kidId }} />
                            </div>
                            <div key={`${e.kidId}-ev`} style={{ padding: '9px 10px', fontFamily: fonts.mono, fontWeight: 700, fontSize: 13, color: brand.text, textAlign: 'right', borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {e.bestEv != null ? e.bestEv.toFixed(1) : '—'}
                            </div>
                            <div key={`${e.kidId}-dist`} style={{ padding: '9px 10px', fontFamily: fonts.mono, fontWeight: 700, fontSize: 13, color: brand.textMuted, textAlign: 'right', borderBottom: i < rows.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                              {e.maxDistance != null ? e.maxDistance : '—'}
                            </div>
                          </>
                        ))}
                      </div>
                    </OCard>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* ── Edit Rule modal ─────────────────────────────────────────────── */}
      {editingRule && (
        <Modal title="Edit Rule" onClose={() => setEditingRule(null)}>
          <form onSubmit={saveEditRule} style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Action</label>
              <input
                required
                style={inputStyle}
                value={editForm.action}
                onChange={e => setEditForm(f => ({ ...f, action: e.target.value }))}
                placeholder="e.g. Complete a booked session"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Points awarded</label>
              <input
                required
                type="number"
                min={1}
                step={1}
                style={inputStyle}
                value={editForm.points}
                onChange={e => setEditForm(f => ({ ...f, points: e.target.value }))}
                placeholder="e.g. 10"
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <OButton type="button" variant="secondary" onClick={() => setEditingRule(null)}>Cancel</OButton>
              <OButton type="submit" variant="gold">Save Changes</OButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add Rule modal ──────────────────────────────────────────────── */}
      {showAddRule && (
        <Modal title="Add Rule" onClose={() => setShowAddRule(false)}>
          <form onSubmit={saveAddRule} style={{ padding: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Action</label>
              <input
                required
                autoFocus
                style={inputStyle}
                value={addForm.action}
                onChange={e => setAddForm(f => ({ ...f, action: e.target.value }))}
                placeholder="e.g. Refer a friend"
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={labelStyle}>Points awarded</label>
              <input
                required
                type="number"
                min={1}
                step={1}
                style={inputStyle}
                value={addForm.points}
                onChange={e => setAddForm(f => ({ ...f, points: e.target.value }))}
                placeholder="e.g. 20"
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <OButton type="button" variant="secondary" onClick={() => setShowAddRule(false)}>Cancel</OButton>
              <OButton type="submit" variant="gold" icon={Plus}>Add Rule</OButton>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Add / Edit Reward modal ─────────────────────────────────────── */}
      {editingProduct !== null && (
        <Modal
          title={editingProduct === 'new' ? 'Add Reward' : 'Edit Reward'}
          onClose={closeRewardModal}
        >
          <form onSubmit={saveReward} style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Name</label>
                <input
                  required
                  autoFocus
                  style={inputStyle}
                  value={rewardForm.name}
                  onChange={e => setRewardForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Batting Gloves"
                />
              </div>
              <div>
                <label style={labelStyle}>Category</label>
                <input
                  style={inputStyle}
                  value={rewardForm.category}
                  onChange={e => setRewardForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Apparel"
                />
              </div>
              <div>
                <label style={labelStyle}>Points Cost</label>
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  style={inputStyle}
                  value={rewardForm.cost}
                  onChange={e => setRewardForm(f => ({ ...f, cost: e.target.value }))}
                  placeholder="e.g. 500"
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Image URL</label>
                <input
                  style={inputStyle}
                  value={rewardForm.image_url}
                  onChange={e => setRewardForm(f => ({ ...f, image_url: e.target.value }))}
                  placeholder="https://…"
                />
                {rewardForm.image_url && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <img
                      src={rewardForm.image_url}
                      alt="preview"
                      style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: `1px solid ${brand.border}` }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span style={{ fontSize: 11, color: brand.textMuted }}>Image preview</span>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Dollar Price (optional)</label>
                <input
                  style={inputStyle}
                  value={rewardForm.dollar_price}
                  onChange={e => setRewardForm(f => ({ ...f, dollar_price: e.target.value }))}
                  placeholder="e.g. 9.99"
                />
              </div>
              <div>
                <label style={labelStyle}>Inventory (blank = unlimited)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  style={inputStyle}
                  value={rewardForm.inventory}
                  onChange={e => setRewardForm(f => ({ ...f, inventory: e.target.value }))}
                  placeholder="e.g. 20"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Toggle active={rewardForm.is_active} onToggle={() => setRewardForm(f => ({ ...f, is_active: !f.is_active }))} />
                <span style={{ fontSize: 13, color: brand.text }}>{rewardForm.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
              <OButton type="button" variant="secondary" onClick={closeRewardModal}>Cancel</OButton>
              <OButton type="submit" variant="gold" icon={editingProduct === 'new' ? Plus : undefined}>
                {editingProduct === 'new' ? 'Add Reward' : 'Save Changes'}
              </OButton>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
