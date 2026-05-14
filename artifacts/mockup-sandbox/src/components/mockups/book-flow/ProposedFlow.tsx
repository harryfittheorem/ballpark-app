import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Calendar, ChevronDown, ChevronUp } from "lucide-react";

const GOLD = "#D4AF37";
const DARK = "#0F0F0F";
const CARD = "#1A1A1A";
const BORDER = "#2A2A2A";
const MUTED = "#6B6B6B";
const TEXT = "#F5F5F5";
const GREEN = "#22C55E";
const SURFACE = "#111111";

const sessionTypes = [
  { id: "cage", label: "Cage Rental", price: "$25", icon: "⚾", duration: "60 min" },
  { id: "private", label: "Private Lesson", price: "$80", icon: "🎯", duration: "60 min" },
  { id: "group", label: "Group Clinic", price: "$40", icon: "👥", duration: "90 min" },
];

const quickSlots = [
  {
    day: "TODAY",
    date: "Thu May 14",
    slots: [
      { time: "9:00 AM", coach: "Mike Anderson", spotsLeft: 1 },
      { time: "10:00 AM", coach: "Mike Anderson", spotsLeft: 3 },
      { time: "11:00 AM", coach: "Dallas N.", spotsLeft: 2 },
    ],
  },
  {
    day: "TOMORROW",
    date: "Fri May 15",
    slots: [
      { time: "10:00 AM", coach: "Dallas N.", spotsLeft: 4 },
      { time: "2:00 PM", coach: "Mike Anderson", spotsLeft: 2 },
    ],
  },
];

const calendarDays = [
  { d: 14, avail: true }, { d: 15, avail: true }, { d: 16, avail: false },
  { d: 17, avail: true }, { d: 18, avail: false }, { d: 19, avail: true },
  { d: 20, avail: false }, { d: 21, avail: true }, { d: 22, avail: true },
  { d: 23, avail: false }, { d: 24, avail: true }, { d: 25, avail: true },
];

const calendarTimesForDate: Record<number, { time: string; coach: string }[]> = {
  14: [{ time: "9:00 AM", coach: "Mike Anderson" }, { time: "10:00 AM", coach: "Mike Anderson" }, { time: "11:00 AM", coach: "Dallas N." }],
  15: [{ time: "10:00 AM", coach: "Dallas N." }, { time: "2:00 PM", coach: "Mike Anderson" }],
  17: [{ time: "9:00 AM", coach: "Mike Anderson" }, { time: "3:00 PM", coach: "Dallas N." }],
  19: [{ time: "11:00 AM", coach: "Mike Anderson" }],
  21: [{ time: "9:00 AM", coach: "Dallas N." }, { time: "1:00 PM", coach: "Mike Anderson" }],
  22: [{ time: "10:00 AM", coach: "Mike Anderson" }, { time: "4:00 PM", coach: "Dallas N." }],
  24: [{ time: "9:00 AM", coach: "Mike Anderson" }],
  25: [{ time: "2:00 PM", coach: "Dallas N." }, { time: "4:00 PM", coach: "Mike Anderson" }],
};

interface Booking {
  dateLabel: string;
  time: string;
  coach: string;
}

export function ProposedFlow() {
  const [sessionId, setSessionId] = useState("cage");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [calOpen, setCalOpen] = useState(false);
  const [calDay, setCalDay] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessionTypes.find(s => s.id === sessionId)!;

  const pickSlot = (dateLabel: string, time: string, coach: string) => {
    setBooking({ dateLabel, time, coach });
    setCalOpen(false);
    setTimeout(() => {
      summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const pickCalDay = (d: number) => {
    setCalDay(d);
  };

  if (confirmed && booking) {
    return (
      <div style={{ background: DARK, height: "100vh", fontFamily: "'Inter', sans-serif", color: TEXT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 0 }}>
        <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#0A1F0A", border: `2px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <CheckCircle2 size={32} color={GREEN} />
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 0.5, marginBottom: 6 }}>You're booked!</div>
        <div style={{ color: MUTED, fontSize: 14, textAlign: "center", lineHeight: 1.6 }}>
          {session.label}<br />
          {booking.dateLabel} · {booking.time}<br />
          with {booking.coach}
        </div>
        <div style={{ marginTop: 28, background: "#1E1A0E", border: `1px solid ${GOLD}44`, borderRadius: 12, padding: "12px 20px", textAlign: "center" }}>
          <span style={{ fontSize: 13, color: GOLD, fontWeight: 600 }}>+10 pts earned on completion</span>
        </div>
        <button onClick={() => { setConfirmed(false); setBooking(null); setCalDay(null); setCalOpen(false); }}
          style={{ marginTop: 24, background: "transparent", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 28px", color: MUTED, fontSize: 13, cursor: "pointer" }}>
          Book another
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, height: "100vh", fontFamily: "'Inter', sans-serif", color: TEXT, fontSize: 14, display: "flex", flexDirection: "column" }}>
      {/* Nav */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", padding: "14px 16px 12px", borderBottom: `1px solid ${BORDER}`, background: DARK }}>
        <ChevronLeft size={20} color={GOLD} style={{ cursor: "pointer" }} />
        <span style={{ flex: 1, textAlign: "center", fontWeight: 800, letterSpacing: 2, fontSize: 12, color: TEXT }}>BOOK A SESSION</span>
        <div style={{ width: 20 }} />
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>

        {/* ── SESSION TYPE ── */}
        <div style={{ padding: "16px 16px 4px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 10 }}>WHAT ARE YOU BOOKING?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {sessionTypes.map(s => (
              <button key={s.id} onClick={() => { setSessionId(s.id); setBooking(null); setCalDay(null); }}
                style={{
                  flex: 1, background: sessionId === s.id ? "#1E1A0E" : CARD,
                  border: `1.5px solid ${sessionId === s.id ? GOLD : BORDER}`,
                  borderRadius: 12, padding: "12px 8px", cursor: "pointer", textAlign: "center",
                  transition: "all 0.15s"
                }}>
                <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                <div style={{ fontWeight: 700, color: sessionId === s.id ? GOLD : TEXT, fontSize: 11, lineHeight: 1.2 }}>{s.label}</div>
                <div style={{ color: MUTED, fontSize: 10, marginTop: 2 }}>{s.duration}</div>
                <div style={{ fontWeight: 800, color: GOLD, fontSize: 13, marginTop: 4 }}>{s.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── AVAILABLE SLOTS ── */}
        <div style={{ padding: "16px 16px 4px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 12 }}>AVAILABLE SLOTS</div>
          {quickSlots.map(group => (
            <div key={group.day} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: group.day === "TODAY" ? GOLD : TEXT, letterSpacing: 1 }}>{group.day}</span>
                <span style={{ fontSize: 11, color: MUTED }}>{group.date}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {group.slots.map(slot => {
                  const isActive = booking?.dateLabel === group.date && booking?.time === slot.time;
                  return (
                    <button key={slot.time} onClick={() => pickSlot(group.date, slot.time, slot.coach)}
                      style={{
                        background: isActive ? "#1E1A0E" : CARD,
                        border: `1.5px solid ${isActive ? GOLD : BORDER}`,
                        borderRadius: 10, padding: "10px 14px", cursor: "pointer",
                        textAlign: "left", minWidth: 90, transition: "all 0.15s"
                      }}>
                      <div style={{ fontWeight: 700, color: isActive ? GOLD : TEXT, fontSize: 14 }}>{slot.time}</div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{slot.coach.split(" ")[0]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Browse other dates button */}
          <button onClick={() => { setCalOpen(v => !v); setCalDay(null); }}
            style={{
              width: "100%", background: calOpen ? CARD : "transparent",
              border: `1px dashed ${calOpen ? GOLD : BORDER}`,
              borderRadius: 10, padding: "11px 14px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginTop: 4
            }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={14} color={calOpen ? GOLD : MUTED} />
              <span style={{ fontSize: 13, color: calOpen ? GOLD : MUTED, fontWeight: calOpen ? 700 : 400 }}>
                Browse other dates
              </span>
            </div>
            {calOpen ? <ChevronUp size={14} color={GOLD} /> : <ChevronDown size={14} color={MUTED} />}
          </button>

          {/* Inline calendar — only shown when requested */}
          {calOpen && (
            <div style={{ marginTop: 10, background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <ChevronLeft size={16} color={MUTED} style={{ cursor: "pointer" }} />
                <span style={{ fontWeight: 700, fontSize: 13 }}>May 2026</span>
                <ChevronRight size={16} color={MUTED} style={{ cursor: "pointer" }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, textAlign: "center", marginBottom: 4 }}>
                {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, i) => (
                  <div key={i} style={{ fontSize: 9, color: MUTED, fontWeight: 600, padding: "2px 0" }}>{d}</div>
                ))}
                {Array(3).fill(null).map((_, i) => <div key={`e${i}`} />)}
                {calendarDays.map(({ d, avail }) => (
                  <button key={d} onClick={() => avail && pickCalDay(d)}
                    style={{
                      padding: "7px 2px", borderRadius: 6, border: "none",
                      background: calDay === d ? GOLD : "transparent",
                      color: calDay === d ? "#000" : avail ? TEXT : "#333",
                      fontWeight: calDay === d ? 800 : 400,
                      cursor: avail ? "pointer" : "default", fontSize: 13,
                    }}>
                    {d}
                  </button>
                ))}
              </div>

              {/* Times for selected calendar date */}
              {calDay && calendarTimesForDate[calDay] && (
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: MUTED, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>
                    TIMES FOR MAY {calDay}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {calendarTimesForDate[calDay].map(t => (
                      <button key={t.time}
                        onClick={() => pickSlot(`May ${calDay}`, t.time, t.coach)}
                        style={{
                          background: SURFACE, border: `1.5px solid ${BORDER}`,
                          borderRadius: 8, padding: "9px 14px", cursor: "pointer", textAlign: "left"
                        }}>
                        <div style={{ fontWeight: 700, color: TEXT, fontSize: 14 }}>{t.time}</div>
                        <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{t.coach.split(" ")[0]}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SUMMARY ── */}
        <div ref={summaryRef} style={{ padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, color: booking ? GOLD : MUTED, marginBottom: 10 }}>
            SUMMARY
          </div>

          {booking ? (
            <div style={{
              background: "#13110A", borderRadius: 14,
              border: `1.5px solid ${GOLD}`,
              padding: 16, boxShadow: `0 0 24px ${GOLD}18`
            }}>
              {[
                ["Session", `${session.icon} ${session.label}`],
                ["Date", booking.dateLabel],
                ["Time", booking.time],
                ["Coach", booking.coach],
                ["Price", session.price],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 0",
                  borderBottom: i < arr.length - 1 ? `1px solid ${BORDER}` : "none"
                }}>
                  <span style={{ color: MUTED, fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: k === "Price" ? GOLD : TEXT, fontSize: 13 }}>{v}</span>
                </div>
              ))}

              <button onClick={() => setConfirmed(true)}
                style={{
                  width: "100%", marginTop: 14, background: GOLD, color: "#000",
                  fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 10,
                  border: "none", cursor: "pointer", letterSpacing: 1
                }}>
                CONFIRM BOOKING
              </button>

              <button onClick={() => setBooking(null)}
                style={{ width: "100%", marginTop: 8, background: "transparent", border: "none", color: MUTED, fontSize: 12, cursor: "pointer" }}>
                Change selection
              </button>
            </div>
          ) : (
            <div style={{
              background: CARD, borderRadius: 12, border: `1px dashed ${BORDER}`,
              padding: "20px 16px", textAlign: "center"
            }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>👆</div>
              <div style={{ color: MUTED, fontSize: 13 }}>Tap any slot above</div>
              <div style={{ color: "#444", fontSize: 12, marginTop: 4 }}>Your booking summary appears here</div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
