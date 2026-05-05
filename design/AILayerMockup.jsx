import React, { useState } from 'react';
import {
  MessageCircle, Zap, Brain, Eye, Send, Phone, Mail, Bell, Sparkles,
  CheckCircle2, AlertTriangle, AlertCircle, TrendingUp, TrendingDown,
  Clock, Users, DollarSign, Calendar, ChevronRight, ChevronDown,
  Dumbbell, Activity, Target, Award, Shield, Radio, Cpu,
  MessageSquare, Smartphone, Slack, Hash, ToggleLeft, ToggleRight,
  ArrowRight, Check, X, Play, Pause, Moon, Sun, Globe, Lock,
  Briefcase, Trophy, BarChart3, FileText, Filter, Star,
} from 'lucide-react';

// ============================================
// BRAND TOKENS — matches portal
// ============================================
const brand = {
  dark: '#2D2B2A',
  darker: '#1C1B1A',
  darkest: '#0F0E0E',
  gold: '#F1E5AD',
  goldBright: '#E8D89A',
  goldDeep: '#B8A268',
  goldHover: '#D9C88F',
  cream: '#FAF6E8',
  creamLight: '#FDFBF2',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textMuted: '#6B6560',
  textLight: '#9B9590',
  border: '#E8E3D5',
  borderStrong: '#D4CEBE',
  borderDark: '#3A3836',
  surface: '#FFFFFF',
  surfaceAlt: '#F5F0E0',
  success: '#5B8A3A',
  successBg: '#E8F0DC',
  warning: '#C48420',
  warningBg: '#F9EDD5',
  danger: '#B84A3A',
  dangerBg: '#F5DED8',
  info: '#3A6B8A',
  infoBg: '#D8E6EF',
  // iMessage colors
  imessageBlue: '#0B84FF',
  imessageGray: '#E9E9EB',
  whatsappGreen: '#25D366',
  whatsappBubble: '#DCF8C6',
  slackPurple: '#4A154B',
};

const fonts = {
  display: "'Oswald', 'Bebas Neue', Impact, sans-serif",
  body: "'Inter', -apple-system, sans-serif",
  mono: "'JetBrains Mono', Menlo, monospace",
};

// ============================================
// SHARED: PHONE FRAME
// ============================================
const PhoneFrame = ({ children, notchColor = '#000', compact = false }) => (
  <div style={{
    width: compact ? 300 : 340,
    background: '#0a0a0a',
    borderRadius: 40,
    padding: 8,
    boxShadow: '0 20px 50px -10px rgba(0,0,0,0.3), 0 0 0 1px #2a2a2a',
  }}>
    <div style={{
      background: brand.white,
      borderRadius: 32,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Notch */}
      <div style={{
        position: 'absolute',
        top: 8,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 100,
        height: 24,
        background: notchColor,
        borderRadius: 14,
        zIndex: 10,
      }} />
      {children}
    </div>
  </div>
);

// iMessage-style header
const IMessageHeader = ({ name, subtitle, isBot = true }) => (
  <div style={{
    padding: '44px 16px 12px',
    background: '#F6F6F6',
    borderBottom: '0.5px solid #D1D1D6',
    textAlign: 'center',
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: 24,
      background: isBot ? brand.dark : brand.gold,
      color: isBot ? brand.gold : brand.dark,
      margin: '0 auto 6px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 700, fontFamily: fonts.display,
    }}>
      {isBot ? <Dumbbell size={22} strokeWidth={2.5} /> : name.charAt(0)}
    </div>
    <div style={{ fontSize: 11, fontWeight: 600, color: brand.text, fontFamily: fonts.body }}>{name}</div>
    <div style={{ fontSize: 9, color: brand.textMuted, marginTop: 2 }}>{subtitle}</div>
  </div>
);

// iMessage bubble
const Bubble = ({ from, text, time, showTime = false }) => {
  const isUser = from === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', margin: '6px 12px' }}>
      {showTime && (
        <div style={{ fontSize: 10, color: brand.textMuted, textAlign: 'center', margin: '12px auto 8px', width: '100%', fontWeight: 600 }}>
          {time}
        </div>
      )}
      <div style={{
        maxWidth: '78%',
        padding: '8px 12px',
        background: isUser ? brand.imessageBlue : brand.imessageGray,
        color: isUser ? brand.white : brand.text,
        borderRadius: 18,
        fontSize: 13,
        lineHeight: 1.4,
        fontFamily: fonts.body,
        whiteSpace: 'pre-wrap',
      }}>
        {text}
      </div>
    </div>
  );
};

// WhatsApp header
const WhatsAppHeader = ({ name, subtitle }) => (
  <div style={{
    padding: '44px 16px 12px',
    background: '#075E54',
    color: brand.white,
    display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <div style={{
      width: 36, height: 36, borderRadius: 18,
      background: brand.gold, color: brand.dark,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Dumbbell size={18} strokeWidth={2.5} />
    </div>
    <div>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
      <div style={{ fontSize: 10, opacity: 0.8 }}>{subtitle}</div>
    </div>
  </div>
);

// WhatsApp bubble
const WhatsAppBubble = ({ from, text, time }) => {
  const isUser = from === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', margin: '4px 10px' }}>
      <div style={{
        maxWidth: '80%',
        padding: '6px 10px 4px',
        background: isUser ? brand.whatsappBubble : brand.white,
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.4,
        boxShadow: '0 1px 0.5px rgba(0,0,0,0.13)',
        whiteSpace: 'pre-wrap',
        position: 'relative',
      }}>
        <div style={{ color: brand.text }}>{text}</div>
        <div style={{ fontSize: 9, color: brand.textMuted, textAlign: 'right', marginTop: 2 }}>{time}</div>
      </div>
    </div>
  );
};

// ============================================
// SECTION COMPONENTS
// ============================================

const SectionLabel = ({ number, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
    <div style={{
      width: 36, height: 36, borderRadius: 10,
      background: brand.gold, color: brand.dark,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 800, fontFamily: fonts.display,
    }}>{number}</div>
    <div style={{ fontSize: 11, fontWeight: 800, color: brand.goldDeep, letterSpacing: 3, textTransform: 'uppercase', fontFamily: fonts.display }}>{label}</div>
  </div>
);

const SectionTitle = ({ children }) => (
  <h2 style={{
    fontSize: 48, fontWeight: 700, fontFamily: fonts.display,
    letterSpacing: -1, color: brand.dark, margin: '0 0 16px 0',
    lineHeight: 1.05,
  }}>{children}</h2>
);

const SectionSubtitle = ({ children }) => (
  <p style={{
    fontSize: 17, color: brand.textMuted, margin: 0,
    lineHeight: 1.5, maxWidth: 700,
  }}>{children}</p>
);

// ============================================
// 1. HERO
// ============================================
const Hero = () => (
  <div style={{
    background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darker} 50%, ${brand.darkest} 100%)`,
    color: brand.cream,
    padding: '80px 60px 100px',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {/* Gold accent line at top */}
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${brand.gold}, transparent)` }} />

    {/* Decorative blobs */}
    <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: 200, background: `${brand.gold}0a`, pointerEvents: 'none' }} />
    <div style={{ position: 'absolute', bottom: -150, left: -100, width: 500, height: 500, borderRadius: 250, background: `${brand.goldDeep}08`, pointerEvents: 'none' }} />

    <div style={{ maxWidth: 1200, margin: '0 auto', position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: brand.gold, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Dumbbell size={22} color={brand.dark} strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 2, fontFamily: fonts.display }}>INFINITE HITTING</div>
          <div style={{ fontSize: 10, color: brand.textLight, letterSpacing: 1 }}>OPERATIONS INTELLIGENCE</div>
        </div>
      </div>

      <div style={{ fontSize: 13, color: brand.gold, fontWeight: 700, letterSpacing: 3, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 20 }}>
        INTRODUCING · THE AI LAYER
      </div>

      <h1 style={{
        fontSize: 84, fontWeight: 700, fontFamily: fonts.display,
        letterSpacing: -2, lineHeight: 0.95, margin: '0 0 32px 0',
        color: brand.white,
      }}>
        The portal is for<br/>
        when you have<br/>
        <span style={{ color: brand.gold }}>10 minutes.</span>
      </h1>

      <p style={{ fontSize: 22, color: brand.cream, lineHeight: 1.5, maxWidth: 680, opacity: 0.85, margin: '0 0 40px 0' }}>
        The AI layer is for the other 23 hours and 50 minutes of your day. An operations brain that works while you sleep, alerts you when it matters, and talks to you like a chief of staff.
      </p>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {[
          { icon: MessageSquare, label: 'SMS' },
          { icon: Smartphone, label: 'WhatsApp' },
          { icon: Hash, label: 'Slack' },
          { icon: Mail, label: 'Email' },
        ].map(c => (
          <div key={c.label} style={{
            padding: '10px 18px', background: 'rgba(241, 229, 173, 0.08)',
            border: `1px solid ${brand.goldDeep}33`, borderRadius: 24,
            display: 'flex', alignItems: 'center', gap: 8,
            color: brand.gold, fontSize: 12, fontWeight: 600,
          }}>
            <c.icon size={14} />
            {c.label}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// 2. ARCHITECTURE — 3 LAYER MODEL
// ============================================
const Architecture = () => (
  <div style={{ padding: '100px 60px', background: brand.cream }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionLabel number="01" label="HOW IT WORKS" />
      <SectionTitle>Three layers stacked<br/>into one operating system.</SectionTitle>
      <SectionSubtitle>
        Every alert you receive is the output of three systems working together — watching, deciding, and speaking on behalf of your business.
      </SectionSubtitle>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 60 }}>
        {[
          {
            icon: Eye,
            number: '01',
            label: 'SILENT WATCHER',
            title: 'Watches everything, 24/7',
            description: 'Monitors every payment, session attended, app login, HitTrax swing, schedule change, lead inquiry. Builds a real-time model of your business.',
            examples: ['Payment events', 'Member attendance', 'Coach availability', 'App engagement', 'HitTrax performance', 'Lead inquiries'],
            color: brand.info,
          },
          {
            icon: Brain,
            number: '02',
            label: 'DECISION LAYER',
            title: 'Decides what matters',
            description: 'Rules + judgment deciding which events deserve attention, to whom, when, and through what channel. The difference between signal and noise.',
            examples: ['Priority scoring', 'Channel routing', 'Timing intelligence', 'Fatigue prevention', 'Context awareness', 'Learning loop'],
            color: brand.goldDeep,
          },
          {
            icon: MessageCircle,
            number: '03',
            label: 'PROACTIVE VOICE',
            title: 'Speaks where you are',
            description: 'Reaches you on SMS, WhatsApp, or Slack — in the moment, in the channel you already use. Two-way. Ask questions back, get answers in seconds.',
            examples: ['Alert delivery', 'Daily recaps', 'Q&A on demand', 'One-click actions', 'Parent outreach', 'Network digests'],
            color: brand.success,
          },
        ].map(layer => (
          <div key={layer.number} style={{
            background: brand.surface, borderRadius: 16,
            padding: 32, border: `1px solid ${brand.border}`,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 3, background: layer.color }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div style={{ width: 52, height: 52, borderRadius: 12, background: `${layer.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <layer.icon size={26} color={layer.color} strokeWidth={2} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, color: `${layer.color}44`, fontFamily: fonts.display, letterSpacing: -1 }}>{layer.number}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: layer.color, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 8 }}>{layer.label}</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.3, lineHeight: 1.2 }}>
              {layer.title}
            </h3>
            <p style={{ fontSize: 13, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
              {layer.description}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {layer.examples.map(ex => (
                <div key={ex} style={{ fontSize: 11, color: brand.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 4, height: 4, borderRadius: 2, background: layer.color }} />
                  {ex}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Flow arrows */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 50, color: brand.textMuted }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fontFamily: fonts.display }}>BUSINESS EVENT</span>
        <ArrowRight size={14} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, fontFamily: fonts.display }}>JUDGMENT</span>
        <ArrowRight size={14} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: brand.goldDeep, fontFamily: fonts.display }}>TEXT IN YOUR HAND</span>
      </div>
    </div>
  </div>
);

// ============================================
// 3. SCENARIOS
// ============================================

// Scenario 1 — Payment failure
const Scenario1 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center' }}>
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: brand.dangerBg, color: brand.danger, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <AlertCircle size={12} /> PAYMENT FAILURE
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        A card declines. The owner recovers it in 30 seconds — while walking between cages.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Today, failed payments sit in a queue the owner might check on Sunday. By then, 5 days are gone and the member has mentally moved on. With the AI layer, recovery happens in real-time via a single text reply.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.display }}>WHY THIS WINS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            '30 seconds from failure to recovery action',
            'Owner never logs into the portal',
            'Industry-avg recovery rate: 45%. Target with this: 62%.',
            'That\'s $2,400+/yr saved per location on recovered MRR',
          ].map((pt, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <CheckCircle2 size={14} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              {pt}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <IMessageHeader name="Infinite Hitting Ops" subtitle="Dallas N." />
        <div style={{ padding: '8px 0 40px', minHeight: 480 }}>
          <Bubble from="bot" text={`⚠️ Emma Foster's card declined for $280 (card on file expired).\n\nMember 8 months · $1,680 LTV · Parent: Sarah (214) 555-8123`} time="Thu 2:47 PM" showTime />
          <Bubble from="bot" text={`Reply YES to send Sarah a payment update link, or CALL to call her now.`} />
          <Bubble from="user" text="YES" time="2:47 PM" showTime />
          <Bubble from="bot" text={`✓ Sent. Sarah will get a secure link via text.\n\nI'll let you know when she updates it.`} />
          <Bubble from="bot" text={`✓ Sarah updated her card. $280 charged successfully.\n\nRecovery time: 4 min 12 sec.`} time="2:51 PM" showTime />
        </div>
      </PhoneFrame>
    </div>
  </div>
);

// Scenario 2 — Coach no-show
const Scenario2 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 40, alignItems: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <IMessageHeader name="Infinite Hitting Ops" subtitle="Dallas N." />
        <div style={{ padding: '8px 0 40px', minHeight: 480 }}>
          <Bubble from="bot" text={`⚠️ Coach Derek just called out sick. He had 3 private lessons this morning.`} time="Sat 7:12 AM" showTime />
          <Bubble from="bot" text={`Affected:\n• Ryan Foster — 9:00 AM\n• Tyler Kim — 10:00 AM\n• Mason Lee — 11:00 AM\n\nCoach Sarah has openings at 9:30 & 10:30.`} />
          <Bubble from="bot" text={`Reply RESCHEDULE to auto-text all 3 parents with Sarah's open slots, or TAKE IT to assign to yourself.`} />
          <Bubble from="user" text="Reschedule" time="7:13 AM" showTime />
          <Bubble from="bot" text={`✓ Texting all 3 parents now. I'll update you as they confirm.`} />
          <Bubble from="bot" text={`Update: 2 of 3 confirmed rescheduled with Sarah. Ryan's mom asked to push to Sunday — need your call.`} time="7:28 AM" showTime />
        </div>
      </PhoneFrame>
    </div>

    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: brand.warningBg, color: brand.warning, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <AlertTriangle size={12} /> COACH UNAVAILABLE
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        A coach calls out sick. Three Saturday morning disasters avoided before 8 AM.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Parents showing up to find their lesson cancelled is the #1 source of bad reviews and quiet cancellations. The system sees the coach cancellation, cross-references other coaches' availability, and handles the rebooking — with one tap of owner approval.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.display }}>WHY THIS WINS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Parents never show up to locked doors',
            'Sarah\'s open slots get filled automatically',
            'Owner stays in control — just approves',
            'One operations crisis becomes a 30-second text exchange',
          ].map((pt, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <CheckCircle2 size={14} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              {pt}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Scenario 3 — Daily recap
const Scenario3 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center' }}>
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: brand.infoBg, color: brand.info, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <Moon size={12} /> DAILY RECAP
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        Every night at 8 PM, one text. The owner ends the day informed.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Franchise operators want to know: what happened today? Most dashboards overwhelm them with 40 metrics. One well-crafted text at 8 PM beats a dashboard they'll never open. Patterns get surfaced. Wins get celebrated. Gaps get flagged.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.display }}>WHY THIS WINS</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Builds a daily relationship — they never miss a day',
            'One text. No dashboard to open.',
            'Owner picks: 8 AM morning brief, 8 PM evening, or both',
            'Wins celebrated. Gaps flagged. Kids mentioned by name.',
          ].map((pt, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <CheckCircle2 size={14} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              {pt}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <IMessageHeader name="Infinite Hitting Ops" subtitle="Dallas N." />
        <div style={{ padding: '8px 0 40px', minHeight: 480 }}>
          <Bubble from="bot" text={`📊 Daily recap · Tuesday`} time="Tue 8:00 PM" showTime />
          <Bubble from="bot" text={`→ 42 sessions (78% utilization — 5 PM was full)\n→ $1,840 collected from 7 charges\n→ 2 new signups: Olivia M. ($180) and Ryan F. ($280 unlimited)\n→ Total MRR added: $460`} />
          <Bubble from="bot" text={`🔥 Wins:\n• Jake Rodriguez hit a new PR — 68 mph (↑ 3)\n• Noah's 6-week streak continues\n• Coach Sarah had her highest-rated day`} />
          <Bubble from="bot" text={`⚠️ One thing to know:\nEmma Foster still hasn't rebooked since Oct 2. That's 18 days. Want me to reach out to Sarah tomorrow?`} />
          <Bubble from="user" text="yes" time="8:02 PM" showTime />
          <Bubble from="bot" text={`✓ Added to tomorrow's outreach list. Night Mike.`} />
        </div>
      </PhoneFrame>
    </div>
  </div>
);

// Scenario 4 — Q&A
const Scenario4 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 40, alignItems: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <IMessageHeader name="Infinite Hitting Ops" subtitle="Dallas N." />
        <div style={{ padding: '8px 0 40px', minHeight: 520 }}>
          <Bubble from="user" text="hey how are we tracking on nov" time="Wed 9:14 PM" showTime />
          <Bubble from="bot" text={`You're at $80.3K Oct MRR. Nov forecast: $83.2K (+3.5%).\n\nDriving it:\n→ 18 expected new signups\n→ Expected churn of 6\n→ Expected declines: ~$960`} />
          <Bubble from="bot" text={`One thing to watch: Emma Foster, Benjamin Nash, and Ava Williams are all trending toward churn. Combined MRR: $740.`} />
          <Bubble from="bot" text={`Want me to flag these to Coach Mike for personal outreach tomorrow morning?`} />
          <Bubble from="user" text="yes do it. also who's my best coach this month" time="9:15 PM" showTime />
          <Bubble from="bot" text={`✓ Flagged.\n\nBest coach Oct (by retention of their students):\n\n1. Coach Mike — 92.1%\n2. Coach Amanda — 91.3%\n3. Coach Sarah — 90.4%\n\nMike has the highest student LTV too — his students stay ~30% longer than avg.`} />
        </div>
      </PhoneFrame>
    </div>

    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: `${brand.goldDeep}22`, color: brand.goldDeep, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <MessageCircle size={12} /> TWO-WAY CONVERSATION
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        Ask anything. Get real numbers, instantly — not opinions.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Owners ask real operational questions all day. "How's revenue this month?" "Who's my best coach?" "Who's overdue on payment?" Every answer comes from querying real data — not LLM guessing. No hallucinations on numbers, ever.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 10, fontFamily: fonts.display }}>EXAMPLES OF WHAT YOU CAN ASK</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {[
            '"What did Jake do in his last session?"',
            '"How many members are at risk right now?"',
            '"Who hasn\'t paid this month?"',
            '"Text Sarah a reminder to rebook"',
            '"What\'s my cash-collected for October so far?"',
            '"Which package has the highest LTV?"',
            '"Show me every member who missed 14+ days"',
          ].map((q, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <Sparkles size={12} color={brand.goldDeep} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ fontStyle: 'italic', color: brand.textMuted }}>{q}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// Scenario 5 — Parent rebook
const Scenario5 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 40, alignItems: 'center' }}>
    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: brand.successBg, color: brand.success, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <Users size={12} /> PARENT-FACING
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        Parents text the business directly. Retention goes up. Apps go unused.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        The #1 reason kids disappear from youth sports facilities isn't quality — it's parents forgetting to rebook. When the facility can text a parent and the parent can text back, rebooking happens in the moments parents already have their phone out. This alone can meaningfully improve retention.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.display }}>THE UNDERRATED RETENTION LEVER</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Parents never have to download another app',
            'Natural rebooking — happens in existing habits',
            'Automatic session reminders night before',
            'Homework videos delivered right to the thread',
            'Points balance + reward reminders',
          ].map((pt, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <CheckCircle2 size={14} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              {pt}
            </div>
          ))}
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <IMessageHeader name="Infinite Hitting" subtitle="(214) 555-0142" />
        <div style={{ padding: '8px 0 40px', minHeight: 520 }}>
          <Bubble from="user" text="when's Jake's next session?" time="Wed 6:42 PM" showTime />
          <Bubble from="bot" text={`Jake has Hitting w/ Coach Mike tomorrow at 5 PM, Cage 3. 🥎\n\nWant me to send a reminder an hour before?`} />
          <Bubble from="user" text="yes please. also can you send the homework coach gave him?" time="6:43 PM" showTime />
          <Bubble from="bot" text={`Sending now. 📹\n\n"Tee drills — inside pitch" (15 min)\n+25 points when Jake completes it\n\nHe's 60 pts away from his next reward (Infinite Hitting Tee).`} />
          <Bubble from="user" text="perfect, thanks!" time="6:44 PM" showTime />
          <Bubble from="bot" text={`👋 Any time, Sarah.`} />
          <Bubble from="bot" text={`⏰ Reminder: Jake's session at Infinite Hitting is in 1 hour. Cage 3 with Coach Mike. See you soon! 🥎`} time="Thu 4:00 PM" showTime />
        </div>
      </PhoneFrame>
    </div>
  </div>
);

// Scenario 6 — Franchisor digest
const Scenario6 = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 40, alignItems: 'center' }}>
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PhoneFrame>
        <WhatsAppHeader name="IH Network Intel" subtitle="17 locations" />
        <div style={{ padding: '12px 0 40px', minHeight: 560, background: '#ECE5DD' }}>
          <WhatsAppBubble from="bot" text={`☀️ Good morning Tom. Here's last week across the network:`} time="Mon 6:03" />
          <WhatsAppBubble from="bot" text={`🏆 Phoenix had a record week\n+18% MoM — Jessica Chen's 3rd straight record\n\nWorth a congrats call or shoutout in franchisee chat.`} time="Mon 6:03" />
          <WhatsAppBubble from="bot" text={`⚠️ Kansas City needs attention\nRetention down 6th straight month (79.8%).\nBiggest drop: Unlimited Monthly subs.\n\nI'd recommend scheduling a call with Paul this week.`} time="Mon 6:03" />
          <WhatsAppBubble from="bot" text={`📊 Network tracking for $1.42M Nov MRR (+5.8% vs Oct).\n\nFull network report: infinitehitting.com/weekly`} time="Mon 6:04" />
          <WhatsAppBubble from="user" text="send paul a call request for tuesday" time="6:12" />
          <WhatsAppBubble from="bot" text={`✓ Done. Meeting request sent for Tue 10 AM CT. Subject: "Kansas City retention check-in."`} time="6:12" />
        </div>
      </PhoneFrame>
    </div>

    <div>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: `${brand.slackPurple}22`, color: brand.slackPurple, borderRadius: 20, fontSize: 11, fontWeight: 800, letterSpacing: 1, marginBottom: 16, fontFamily: fonts.display }}>
        <Briefcase size={12} /> FRANCHISOR INTELLIGENCE
      </div>
      <h3 style={{ fontSize: 30, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 12px 0', color: brand.text, letterSpacing: -0.5, lineHeight: 1.15 }}>
        One Monday message tells you which franchisees need your attention.
      </h3>
      <p style={{ fontSize: 14, color: brand.textMuted, lineHeight: 1.6, margin: '0 0 20px 0' }}>
        Franchisors don't need 17 dashboards. They need to know which 2-3 locations need their attention this week. The AI layer reads the entire network and delivers one priority-ranked message that replaces their weekly reporting ritual entirely.
      </p>
      <div style={{ padding: 16, background: brand.surface, borderRadius: 10, border: `1px solid ${brand.border}` }}>
        <div style={{ fontSize: 10, color: brand.textMuted, fontWeight: 800, letterSpacing: 1.5, marginBottom: 8, fontFamily: fonts.display }}>WHAT FRANCHISORS GET</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'Weekly WhatsApp/Slack digest — ranked by urgency',
            'Network records celebrated by name',
            'Declining locations flagged with why',
            'Royalty collection status + forecast',
            'Ability to take action from inside the thread',
          ].map((pt, i) => (
            <div key={i} style={{ fontSize: 12, color: brand.text, display: 'flex', gap: 8 }}>
              <CheckCircle2 size={14} color={brand.success} style={{ flexShrink: 0, marginTop: 1 }} />
              {pt}
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// 4. SETTINGS / PREFERENCES
// ============================================
const SettingsScreen = () => (
  <div style={{ padding: '100px 60px', background: brand.creamLight }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionLabel number="03" label="TAILORED TO YOU" />
      <SectionTitle>You control everything.<br/>No spam, no fatigue.</SectionTitle>
      <SectionSubtitle>
        Every owner gets different texts. Different channels. Different times. Different topics. The system adapts to what you actually care about — and learns over time.
      </SectionSubtitle>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 60 }}>
        {/* Left: Alert settings */}
        <div style={{ background: brand.surface, borderRadius: 16, padding: 32, border: `1px solid ${brand.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: brand.goldDeep, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 8 }}>ALERT PREFERENCES</div>
          <h3 style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 20px 0', color: brand.text }}>What matters to you?</h3>

          {[
            { label: 'Payment failures', desc: 'Immediate alert on card decline', enabled: true, urgent: true },
            { label: 'Coach cancellations', desc: 'When a coach calls out', enabled: true, urgent: true },
            { label: 'Members missing 14+ days', desc: 'Flagged for outreach', enabled: true, urgent: false },
            { label: 'New signups', desc: 'Each time someone joins', enabled: true, urgent: false },
            { label: 'Daily recap', desc: '8 PM summary every evening', enabled: true, urgent: false },
            { label: 'Weekly report', desc: 'Monday morning deep dive', enabled: true, urgent: false },
            { label: 'HitTrax PRs by students', desc: 'When your members hit new bests', enabled: false, urgent: false },
            { label: 'Competitor intel', desc: 'News about competitors nearby', enabled: false, urgent: false },
          ].map((item, i, arr) => (
            <div key={i} style={{ padding: '14px 0', display: 'flex', alignItems: 'center', gap: 14, borderBottom: i < arr.length - 1 ? `1px solid ${brand.border}` : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: brand.text }}>{item.label}</div>
                  {item.urgent && <div style={{ fontSize: 9, fontWeight: 800, background: brand.danger, color: brand.white, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5, fontFamily: fonts.display }}>URGENT</div>}
                </div>
                <div style={{ fontSize: 11, color: brand.textMuted, marginTop: 2 }}>{item.desc}</div>
              </div>
              <div style={{
                width: 44, height: 24, borderRadius: 12,
                background: item.enabled ? brand.success : brand.border,
                position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: 2,
                  left: item.enabled ? 22 : 2,
                  width: 20, height: 20, borderRadius: 10,
                  background: brand.white,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }} />
              </div>
            </div>
          ))}
        </div>

        {/* Right: Channel & timing */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Channels */}
          <div style={{ background: brand.surface, borderRadius: 16, padding: 32, border: `1px solid ${brand.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: brand.goldDeep, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 8 }}>CHANNELS</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 20px 0', color: brand.text }}>How do you want to hear from us?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { name: 'SMS', icon: MessageSquare, color: brand.info, active: true, detail: '(214) 555-0142' },
                { name: 'WhatsApp', icon: Smartphone, color: brand.whatsappGreen, active: false, detail: 'Not connected' },
                { name: 'Slack', icon: Hash, color: brand.slackPurple, active: false, detail: 'Connect workspace' },
                { name: 'Email', icon: Mail, color: brand.textMuted, active: true, detail: 'For daily recaps only' },
              ].map(c => (
                <div key={c.name} style={{
                  padding: 14, borderRadius: 10,
                  background: c.active ? `${c.color}15` : brand.surfaceAlt,
                  border: `1px solid ${c.active ? c.color : brand.border}`,
                  cursor: 'pointer', position: 'relative',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <c.icon size={16} color={c.active ? c.color : brand.textLight} />
                    <div style={{ fontSize: 13, fontWeight: 700, color: c.active ? brand.text : brand.textLight }}>{c.name}</div>
                    {c.active && <CheckCircle2 size={12} color={c.color} style={{ marginLeft: 'auto' }} />}
                  </div>
                  <div style={{ fontSize: 10, color: brand.textMuted }}>{c.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quiet hours */}
          <div style={{ background: brand.surface, borderRadius: 16, padding: 32, border: `1px solid ${brand.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: brand.goldDeep, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 8 }}>TIMING</div>
            <h3 style={{ fontSize: 22, fontWeight: 700, fontFamily: fonts.display, margin: '0 0 20px 0', color: brand.text }}>When can we reach you?</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: brand.surfaceAlt, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Quiet hours</div>
                  <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 2 }}>No texts during these hours (urgent always sent)</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: brand.goldDeep, fontFamily: fonts.mono }}>10 PM – 7 AM</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: brand.surfaceAlt, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Daily recap time</div>
                  <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 2 }}>When to receive your daily summary</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: brand.goldDeep, fontFamily: fonts.mono }}>8:00 PM</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: brand.surfaceAlt, borderRadius: 10 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>Weekly report</div>
                  <div style={{ fontSize: 10, color: brand.textMuted, marginTop: 2 }}>Deep dive, once a week</div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: brand.goldDeep, fontFamily: fonts.mono }}>Mon 6 AM</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// 5. COMPETITIVE POSITIONING
// ============================================
const Positioning = () => (
  <div style={{
    padding: '100px 60px',
    background: `linear-gradient(180deg, ${brand.dark} 0%, ${brand.darker} 100%)`,
    color: brand.cream,
  }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 3, textTransform: 'uppercase', fontFamily: fonts.display, marginBottom: 20 }}>
        04 · WHY THIS WINS
      </div>
      <h2 style={{ fontSize: 48, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1, color: brand.white, margin: '0 0 16px 0', lineHeight: 1.05 }}>
        Nobody in youth sports<br/>SaaS has this. Nobody.
      </h2>
      <p style={{ fontSize: 17, color: brand.cream, lineHeight: 1.5, maxWidth: 700, opacity: 0.85, margin: '0 0 50px 0' }}>
        We're not competing on features with MindBody or Upper Hand. We're operating in a different category entirely — an operations brain vs. a dashboard.
      </p>

      {/* Comparison grid */}
      <div style={{ background: 'rgba(241, 229, 173, 0.03)', borderRadius: 16, padding: 4, border: `1px solid ${brand.goldDeep}22`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ padding: '16px 20px', textAlign: 'left', fontSize: 10, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, fontFamily: fonts.display, width: '30%' }}>CAPABILITY</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, fontFamily: fonts.display }}>MINDBODY</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, fontFamily: fonts.display }}>UPPER HAND</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: brand.textLight, letterSpacing: 1.5, fontFamily: fonts.display }}>JACKRABBIT</th>
              <th style={{ padding: '16px 20px', textAlign: 'center', fontSize: 10, fontWeight: 800, color: brand.gold, letterSpacing: 1.5, fontFamily: fonts.display, background: `${brand.gold}10` }}>BALLPARK</th>
            </tr>
          </thead>
          <tbody>
            {[
              { feature: 'Real-time payment recovery via SMS', others: [false, false, false], us: true },
              { feature: 'Coach cancellation auto-rebook', others: [false, false, false], us: true },
              { feature: 'Daily text recap for owners', others: [false, false, false], us: true },
              { feature: 'Natural language Q&A on business data', others: [false, false, false], us: true },
              { feature: 'Parent-facing conversational rebooking', others: [false, false, false], us: true },
              { feature: 'Franchisor network intelligence', others: [false, false, false], us: true },
              { feature: 'AI churn risk predictions', others: [false, false, false], us: true },
              { feature: 'HitTrax integration', others: [false, false, false], us: true },
              { feature: 'Membership & scheduling', others: [true, true, true], us: true },
              { feature: 'Billing & payments', others: [true, true, true], us: true },
            ].map((row, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${brand.goldDeep}15` }}>
                <td style={{ padding: '14px 20px', fontSize: 13, color: brand.cream, fontWeight: 500 }}>{row.feature}</td>
                {row.others.map((has, j) => (
                  <td key={j} style={{ padding: '14px 20px', textAlign: 'center' }}>
                    {has ? <Check size={16} color={brand.success} /> : <X size={16} color={brand.textLight} style={{ opacity: 0.4 }} />}
                  </td>
                ))}
                <td style={{ padding: '14px 20px', textAlign: 'center', background: `${brand.gold}05` }}>
                  {row.us ? <Check size={18} color={brand.gold} strokeWidth={3} /> : <X size={16} color={brand.textLight} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 50, padding: 32, background: `${brand.gold}10`, border: `1px solid ${brand.goldDeep}33`, borderRadius: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 2, fontFamily: fonts.display, marginBottom: 10 }}>THE PITCH, IN ONE SENTENCE</div>
        <div style={{ fontSize: 28, fontWeight: 700, fontFamily: fonts.display, color: brand.white, lineHeight: 1.25, letterSpacing: -0.5 }}>
          "Every competitor sells you a tool. We're building you an <span style={{ color: brand.gold }}>operations brain</span> that works while you sleep and texts you like a chief of staff."
        </div>
      </div>
    </div>
  </div>
);

// ============================================
// 6. ROADMAP
// ============================================
const Roadmap = () => (
  <div style={{ padding: '100px 60px', background: brand.cream }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionLabel number="05" label="BUILD PLAN" />
      <SectionTitle>Ship in phases.<br/>Prove value at each step.</SectionTitle>
      <SectionSubtitle>
        We don't build all of this in month one. We ship the 3 alerts that prove the channel works, then expand deliberately as operators engage.
      </SectionSubtitle>

      <div style={{ marginTop: 60, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          {
            phase: 'PHASE 1',
            timeline: 'Month 1–2',
            title: 'Critical-moment alerts',
            goal: 'Prove owners will engage via SMS',
            items: ['Payment failure → recovery text', 'Member missing 14+ days → outreach prompt', 'Daily 8 PM recap text'],
            metric: 'Success: >40% of alerts get replies',
            color: brand.danger,
            status: 'Next',
          },
          {
            phase: 'PHASE 2',
            timeline: 'Month 3–4',
            title: 'Two-way conversations',
            goal: 'Add natural-language Q&A',
            items: ['"How\'s my revenue?" Q&A', 'Member lookup by name', 'Session schedule queries', 'Coach performance queries'],
            metric: 'Success: Avg >3 conversations/week per owner',
            color: brand.warning,
            status: 'Planned',
          },
          {
            phase: 'PHASE 3',
            timeline: 'Month 5–6',
            title: 'Parent-side layer',
            goal: 'Parents text the business',
            items: ['Rebooking via text', 'Session reminders', 'Homework delivery', 'Points balance queries'],
            metric: 'Success: 10%+ retention lift',
            color: brand.success,
            status: 'Planned',
          },
          {
            phase: 'PHASE 4',
            timeline: 'Month 6+',
            title: 'Franchisor layer',
            goal: 'Weekly network intelligence',
            items: ['Monday network digest', 'Location ranking alerts', 'Franchisee coaching prompts', 'Royalty collection automation'],
            metric: 'Success: Franchisor never opens dashboards',
            color: brand.goldDeep,
            status: 'Planned',
          },
        ].map((p, i) => (
          <div key={i} style={{ background: brand.surface, borderRadius: 14, padding: 24, border: `1px solid ${brand.border}`, display: 'grid', gridTemplateColumns: '140px 1fr auto', gap: 24, alignItems: 'start' }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 800, color: p.color, letterSpacing: 1.5, fontFamily: fonts.display, marginBottom: 4 }}>{p.phase}</div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: -0.3 }}>{p.timeline}</div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ fontSize: 18, fontWeight: 700, fontFamily: fonts.display, color: brand.text, letterSpacing: -0.3 }}>{p.title}</div>
                <div style={{ fontSize: 9, fontWeight: 800, background: i === 0 ? brand.goldDeep : brand.border, color: i === 0 ? brand.white : brand.textMuted, padding: '3px 8px', borderRadius: 4, letterSpacing: 0.5, fontFamily: fonts.display }}>
                  {p.status.toUpperCase()}
                </div>
              </div>
              <div style={{ fontSize: 12, color: brand.textMuted, marginBottom: 12 }}>{p.goal}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {p.items.map(item => (
                  <div key={item} style={{ fontSize: 11, padding: '4px 10px', background: brand.surfaceAlt, borderRadius: 12, color: brand.text, fontWeight: 500 }}>{item}</div>
                ))}
              </div>
            </div>
            <div style={{ textAlign: 'right', padding: '6px 12px', background: `${p.color}15`, borderRadius: 8, border: `1px solid ${p.color}33`, minWidth: 180 }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: p.color, letterSpacing: 1, fontFamily: fonts.display, marginBottom: 3 }}>SUCCESS METRIC</div>
              <div style={{ fontSize: 11, color: brand.text, fontWeight: 600 }}>{p.metric}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// 7. CLOSING
// ============================================
const Closing = () => (
  <div style={{
    padding: '120px 60px',
    background: `linear-gradient(135deg, ${brand.dark} 0%, ${brand.darkest} 100%)`,
    color: brand.cream,
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  }}>
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${brand.gold}, transparent)` }} />

    <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: brand.gold, letterSpacing: 3, fontFamily: fonts.display, marginBottom: 30 }}>
        THE FUTURE OF FRANCHISE OPERATIONS
      </div>
      <h2 style={{ fontSize: 56, fontWeight: 700, fontFamily: fonts.display, letterSpacing: -1.5, color: brand.white, margin: '0 0 30px 0', lineHeight: 1.05 }}>
        Your business should<br/>
        <span style={{ color: brand.gold }}>talk to you.</span>
      </h2>
      <p style={{ fontSize: 20, color: brand.cream, lineHeight: 1.5, opacity: 0.85, margin: '0 0 50px 0' }}>
        Not with another dashboard. Not another app. A real operations brain that knows what matters, knows when to interrupt you, and knows when to stay quiet.
      </p>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap', marginTop: 40 }}>
        {[
          { n: '24/7', l: 'Watching' },
          { n: '<30s', l: 'To alert' },
          { n: '62%', l: 'Recovery rate' },
          { n: '10%+', l: 'Retention lift' },
        ].map(stat => (
          <div key={stat.l} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 44, fontWeight: 700, fontFamily: fonts.display, color: brand.gold, letterSpacing: -1, lineHeight: 1 }}>{stat.n}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: brand.textLight, letterSpacing: 2, marginTop: 8, fontFamily: fonts.display }}>{stat.l.toUpperCase()}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ============================================
// SCENARIOS WRAPPER
// ============================================
const ScenariosSection = () => (
  <div style={{ padding: '100px 60px', background: brand.surface }}>
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <SectionLabel number="02" label="THE SCENARIOS" />
      <SectionTitle>Six moments where<br/>this changes everything.</SectionTitle>
      <SectionSubtitle>
        Every example below shows real copy, real data, real timing. This is what shipping v1 looks like — not marketing fluff.
      </SectionSubtitle>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 100, marginTop: 80 }}>
        <Scenario1 />
        <Scenario2 />
        <Scenario3 />
        <Scenario4 />
        <Scenario5 />
        <Scenario6 />
      </div>
    </div>
  </div>
);

// ============================================
// APP
// ============================================
export default function App() {
  return (
    <div style={{ background: brand.cream, color: brand.text, fontFamily: fonts.body, minHeight: '100vh' }}>
      {/* Top banner */}
      <div style={{ padding: '12px 20px', background: brand.darkest, color: brand.gold, fontSize: 11, fontWeight: 700, letterSpacing: 2, textAlign: 'center', fontFamily: fonts.display }}>
        INFINITE HITTING · AI LAYER DESIGN MOCKUP · PITCH READY
      </div>

      <Hero />
      <Architecture />
      <ScenariosSection />
      <SettingsScreen />
      <Closing />
    </div>
  );
}
