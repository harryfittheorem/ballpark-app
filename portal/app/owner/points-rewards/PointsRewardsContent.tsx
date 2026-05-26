'use client';

import { useState } from 'react';
import { brand, fonts } from '@/lib/ownerBrandTokens';
import { OButton, PageHeader, SectionHeader, OCard, OTable, Chip } from '@/components/owner/ui';
import type { TableColumn } from '@/components/owner/ui';
import { Plus, Sparkles, Edit2, X } from 'lucide-react';
import type { PointsRewardsData, PointsProduct } from '@/lib/supabase/ownerQueries';

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
  { id: 1, action: 'Complete a booked session',       points: 10, active: true },
  { id: 2, action: 'Submit drill homework',            points: 25, active: true },
  { id: 3, action: 'Coach reviews homework (bonus)',   points: 10, active: true },
  { id: 4, action: 'Upload swing for coach feedback',  points: 15, active: true },
  { id: 5, action: 'Login streak (daily)',             points: 5,  active: true },
  { id: 6, action: 'Unlock an achievement',            points: 50, active: true },
];

// ── Demo rewards catalog ───────────────────────────────────────────────────

const DEMO_PRODUCTS: PointsProduct[] = [
  { id: 'p1', name: 'Free Cage Hour',              category: 'Sessions',  cost: 500,  inventory: null, fulfilled: 24, pending: 3, image_url: 'https://images.unsplash.com/photo-1508344928928-7165b67de128?w=400&q=80' },
  { id: 'p2', name: 'Infinite Hitting Cap',         category: 'Apparel',   cost: 1200, inventory: 40,   fulfilled: 18, pending: 2, image_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=400&q=80' },
  { id: 'p3', name: 'Free Private Lesson (30min)', category: 'Sessions',  cost: 800,  inventory: null, fulfilled: 11, pending: 1, image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=400&q=80' },
  { id: 'p4', name: 'Batting Gloves',              category: 'Equipment', cost: 1500, inventory: 20,   fulfilled: 7,  pending: 2, image_url: 'https://images.unsplash.com/photo-1595590424283-b8f17842773f?w=400&q=80' },
  { id: 'p5', name: 'Water Bottle + Drawstring',   category: 'Apparel',   cost: 400,  inventory: 60,   fulfilled: 31, pending: 4, image_url: 'https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?w=400&q=80' },
];

const DEMO_TOP_EARNERS = [
  { name: 'Caleb N.',  points: 2840 },
  { name: 'Aiden T.',  points: 2210 },
  { name: 'Jake M.',   points: 1980 },
  { name: 'Logan S.',  points: 1640 },
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
  const [tab,   setTab]   = useState<'rules' | 'rewards'>('rules');
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
    setRules(prev => [...prev, { id: newId, action: addForm.action.trim(), points: pts, active: true }]);
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
      setLocalProducts(prev => [...prev, newProduct]);
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
          <OButton
            variant="gold"
            icon={Plus}
            onClick={tab === 'rules' ? openAddRule : openAddReward}
          >
            {tab === 'rules' ? 'Add Rule' : 'Add Reward'}
          </OButton>
        }
      />

      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { id: 'rules'   as const, label: 'Earning Rules',   count: rules.length },
            { id: 'rewards' as const, label: 'Rewards Catalog', count: localProducts.length },
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
                  <SectionHeader title="Top Earners" />
                  <OCard>
                    {topEarners.map((e, i) => (
                      <div key={i} style={{ padding: '8px 0', borderBottom: i < topEarners.length - 1 ? `1px solid ${brand.border}` : 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 22, height: 22, borderRadius: 11, background: i === 0 ? brand.gold : brand.dark, color: i === 0 ? brand.dark : brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, fontFamily: fonts.display }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{e.name}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, fontFamily: fonts.mono }}>{e.points.toLocaleString()} pts</div>
                      </div>
                    ))}
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
