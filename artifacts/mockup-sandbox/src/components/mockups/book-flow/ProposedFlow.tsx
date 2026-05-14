import { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Zap } from "lucide-react";

const GOLD = "#D4AF37";
const DARK = "#0F0F0F";
const CARD = "#1A1A1A";
const BORDER = "#2A2A2A";
const MUTED = "#6B6B6B";
const TEXT = "#F5F5F5";
const GREEN = "#22C55E";

const sessionTypes = [
  { id: "cage", label: "Cage Rental", price: "$25", duration: "60 min", desc: "Private batting cage time" },
  { id: "private", label: "Private Lesson", price: "$80", duration: "60 min", desc: "1-on-1 with a coach" },
  { id: "group", label: "Group Clinic", price: "$40", duration: "90 min", desc: "Small group instruction" },
];

const slots = [
  { day: "TODAY", date: "May 14", dateLabel: "Thu May 14", times: ["9:00 AM", "10:00 AM", "11:00 AM"], coach: "Mike Anderson" },
  { day: "TOMORROW", date: "May 15", dateLabel: "Fri May 15", times: ["10:00 AM", "2:00 PM"], coach: "Dallas N." },
];

const calendarDays = [
  { d: 14, avail: true }, { d: 15, avail: true }, { d: 16, avail: false },
  { d: 17, avail: true }, { d: 18, avail: false }, { d: 19, avail: true },
  { d: 20, avail: false }, { d: 21, avail: true }, { d: 22, avail: true },
];

interface Booking {
  day: string;
  dateLabel: string;
  time: string;
  coach: string;
}

export function ProposedFlow() {
  const [selected, setSelected] = useState("cage");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [calDay, setCalDay] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const handleSlotPick = (slot: typeof slots[0], time: string) => {
    setBooking({ day: slot.day, dateLabel: slot.dateLabel, time, coach: slot.coach });
    setCalDay(slot.day === "TODAY" ? 14 : 15);
    setTimeout(() => {
      document.getElementById("summary-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleCalendarDay = (d: number, avail: boolean) => {
    if (!avail) return;
    setCalDay(d);
    if (booking) {
      setBooking({ ...booking, dateLabel: `May ${d}`, day: d === 14 ? "TODAY" : d === 15 ? "TOMORROW" : `May ${d}` });
    }
  };

  if (confirmed) {
    return (
      <div style={{ background: DARK, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: TEXT, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#1A2A1A", border: `2px solid ${GREEN}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
          <CheckCircle2 size={36} color={GREEN} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, marginBottom: 8 }}>Booking Confirmed!</div>
        <div style={{ color: MUTED, fontSize: 14, textAlign: "center", marginBottom: 24 }}>
          {booking?.dateLabel} · {booking?.time}<br />with {booking?.coach}
        </div>
        <button onClick={() => { setConfirmed(false); setBooking(null); setCalDay(null); }}
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 24px", color: TEXT, fontSize: 13, cursor: "pointer" }}>
          Book Another
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: DARK, minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: TEXT, fontSize: 14 }}>
      {/* Status bar */}
      <div style={{ background: DARK, padding: "12px 16px 0", display: "flex", justifyContent: "space-between", fontSize: 12, color: MUTED }}>
        <span>9:41 AM</span><span>●●● WiFi 100%</span>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: `1px solid ${BORDER}` }}>
        <ChevronLeft size={20} color={GOLD} />
        <span style={{ flex: 1, textAlign: "center", fontWeight: 700, letterSpacing: 2, fontSize: 13, color: TEXT }}>BOOK A SESSION</span>
        <div style={{ width: 20 }} />
      </div>

      <div id="top" style={{ overflowY: "auto", maxHeight: "calc(100vh - 100px)", padding: "0 0 80px" }}>

        {/* Session Types */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 10 }}>WHAT CAN I BOOK?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessionTypes.map(s => (
              <button key={s.id} onClick={() => { setSelected(s.id); setBooking(null); setCalDay(null); }}
                style={{ background: selected === s.id ? "#1E1A0E" : CARD, border: `1.5px solid ${selected === s.id ? GOLD : BORDER}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", textAlign: "left" }}>
                <div>
                  <div style={{ fontWeight: 700, color: selected === s.id ? GOLD : TEXT, fontSize: 14 }}>{s.label}</div>
                  <div style={{ color: MUTED, fontSize: 12, marginTop: 2 }}>{s.desc} · {s.duration}</div>
                </div>
                <div style={{ fontWeight: 700, color: GOLD, fontSize: 15 }}>{s.price}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Available Slots */}
        <div style={{ padding: "8px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 10 }}>AVAILABLE SLOTS</div>
          {slots.map(slot => (
            <div key={slot.day} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: GOLD, fontWeight: 700, marginBottom: 6 }}>{slot.day} · {slot.date}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {slot.times.map(time => {
                  const isActive = booking?.day === slot.day && booking?.time === time;
                  return (
                    <button key={time} onClick={() => handleSlotPick(slot, time)}
                      style={{ background: isActive ? "#1E1A0E" : CARD, border: `1.5px solid ${isActive ? GOLD : BORDER}`, borderRadius: 8, padding: "8px 14px", color: TEXT, fontSize: 13, fontWeight: 600, cursor: "pointer", position: "relative" }}>
                      {time}
                      {isActive && <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: GREEN }} />}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Coach: {slot.coach}</div>
            </div>
          ))}
        </div>

        {/* Tap hint */}
        {!booking && (
          <div style={{ margin: "0 16px 12px", background: "#1A1A2E", border: `1px solid #2A2A4E`, borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={14} color="#7C7CEA" />
            <span style={{ fontSize: 12, color: "#7C7CEA" }}>Tap a slot to jump straight to confirmation</span>
          </div>
        )}

        {/* Jump-to indicator when slot is picked */}
        {booking && (
          <div style={{ margin: "0 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <div style={{ fontSize: 11, color: GREEN, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
              <Zap size={11} color={GREEN} /> JUMPED TO SUMMARY
            </div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
        )}

        {/* Calendar — still available for date browsing */}
        <div style={{ padding: "8px 16px 8px", opacity: booking ? 0.6 : 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED }}>DATE</div>
            <div style={{ fontSize: 10, color: MUTED }}>· Browse other dates</div>
          </div>
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <ChevronLeft size={16} color={MUTED} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>May 2026</span>
              <ChevronRight size={16} color={MUTED} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, textAlign: "center" }}>
              {["S","M","T","W","T","F","S"].map((d, i) => (
                <div key={i} style={{ fontSize: 10, color: MUTED, fontWeight: 600, padding: "2px 0" }}>{d}</div>
              ))}
              {[null, null, null, null, null, null].map((_, i) => <div key={`e${i}`} />)}
              {calendarDays.map(({ d, avail }) => (
                <button key={d} onClick={() => handleCalendarDay(d, avail)}
                  style={{ padding: "6px 2px", borderRadius: 6, border: "none", background: calDay === d ? GOLD : "transparent", color: calDay === d ? "#000" : avail ? TEXT : MUTED, fontWeight: calDay === d ? 700 : 400, cursor: avail ? "pointer" : "default", fontSize: 13, opacity: avail ? 1 : 0.4 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: MUTED }}>
            Want a different date? Pick above — slots will update.
          </div>
        </div>

        {/* SUMMARY — jump target */}
        <div id="summary-section" style={{ padding: "12px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: booking ? GOLD : MUTED, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            {booking && <CheckCircle2 size={13} color={GREEN} />}
            SUMMARY
          </div>
          {booking ? (
            <div style={{ background: "#141208", borderRadius: 12, border: `1.5px solid ${GOLD}`, padding: 14, boxShadow: `0 0 0 3px ${GOLD}22` }}>
              <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
                <Zap size={13} color={GREEN} />
                <span style={{ fontSize: 12, color: GREEN, fontWeight: 600 }}>Ready to confirm — all details filled from your slot</span>
              </div>
              {[["Session", "Cage Rental"], ["Date", booking.dateLabel], ["Time", booking.time], ["Coach", booking.coach], ["Price", "$25"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: MUTED, fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: k === "Price" ? GOLD : TEXT, fontSize: 13 }}>{v}</span>
                </div>
              ))}
              <button onClick={() => setConfirmed(true)}
                style={{ width: "100%", marginTop: 14, background: GOLD, color: "#000", fontWeight: 800, fontSize: 15, padding: "13px", borderRadius: 10, border: "none", cursor: "pointer", letterSpacing: 1 }}>
                CONFIRM BOOKING
              </button>
            </div>
          ) : (
            <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px", display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
              <span style={{ color: MUTED, fontSize: 13 }}>Tap any slot above — summary appears here instantly</span>
            </div>
          )}
        </div>

        {booking && (
          <div style={{ padding: "4px 16px 0", textAlign: "center" }}>
            <span style={{ fontSize: 11, color: GREEN }}>✓ 2 taps to book: select session type → tap slot</span>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA (only when no booking yet) */}
      {!booking && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 24px", background: DARK, borderTop: `1px solid ${BORDER}` }}>
          <button style={{ width: "100%", background: BORDER, color: MUTED, fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 12, border: "none", cursor: "default", letterSpacing: 1 }}>
            CONFIRM BOOKING
          </button>
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: MUTED }}>Tap any available slot to continue</div>
        </div>
      )}
    </div>
  );
}
