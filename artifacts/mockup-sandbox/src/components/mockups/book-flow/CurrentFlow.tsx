import { useState } from "react";
import { ChevronLeft, Lock, CheckCircle2, ChevronRight } from "lucide-react";

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
  { day: "TODAY", date: "May 14", times: ["9:00 AM", "10:00 AM", "11:00 AM"], coach: "Mike Anderson" },
  { day: "TOMORROW", date: "May 15", times: ["10:00 AM", "2:00 PM"], coach: "Dallas N." },
];

const calendarDays = [
  { d: 14, avail: true }, { d: 15, avail: true }, { d: 16, avail: false },
  { d: 17, avail: true }, { d: 18, avail: false }, { d: 19, avail: true },
  { d: 20, avail: false }, { d: 21, avail: true }, { d: 22, avail: true },
];

type Step = "slots" | "calendar";

export function CurrentFlow() {
  const [selected, setSelected] = useState("cage");
  const [step, setStep] = useState<Step>("slots");
  const [pickedSlot, setPickedSlot] = useState<{ day: string; time: string; coach: string } | null>(null);
  const [calDay, setCalDay] = useState<number | null>(null);
  const [pickedTime, setPickedTime] = useState<string | null>(null);

  const handleSlotPick = (day: string, time: string, coach: string) => {
    setPickedSlot({ day, time, coach });
    setStep("calendar");
    setCalDay(day === "TODAY" ? 14 : 15);
    setPickedTime(time);
  };

  const ready = pickedSlot && calDay && pickedTime;

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

      <div style={{ overflowY: "auto", maxHeight: "calc(100vh - 100px)", padding: "0 0 80px" }}>

        {/* Session Types */}
        <div style={{ padding: "16px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 10 }}>WHAT CAN I BOOK?</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessionTypes.map(s => (
              <button key={s.id} onClick={() => setSelected(s.id)}
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
                {slot.times.map(time => (
                  <button key={time} onClick={() => handleSlotPick(slot.day, time, slot.coach)}
                    style={{ background: pickedSlot?.time === time && pickedSlot?.day === slot.day ? "#1E1A0E" : CARD, border: `1.5px solid ${pickedSlot?.time === time && pickedSlot?.day === slot.day ? GOLD : BORDER}`, borderRadius: 8, padding: "8px 14px", color: TEXT, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {time}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 4 }}>Coach: {slot.coach}</div>
            </div>
          ))}
        </div>

        {/* Arrow indicator */}
        {step === "calendar" && (
          <div style={{ padding: "0 16px 8px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
            <div style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>↓ SCROLL TO SELECT DATE</div>
            <div style={{ flex: 1, height: 1, background: BORDER }} />
          </div>
        )}

        {/* DATE — calendar (always visible) */}
        <div style={{ padding: "8px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 8 }}>DATE</div>
          <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${step === "calendar" ? GOLD : BORDER}`, padding: 14, boxShadow: step === "calendar" ? `0 0 0 2px ${GOLD}33` : "none" }}>
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
                <button key={d} onClick={() => avail && setCalDay(d)}
                  style={{ padding: "6px 2px", borderRadius: 6, border: "none", background: calDay === d ? GOLD : "transparent", color: calDay === d ? "#000" : avail ? TEXT : MUTED, fontWeight: calDay === d ? 700 : 400, cursor: avail ? "pointer" : "default", fontSize: 13, opacity: avail ? 1 : 0.4 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {step === "calendar" && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} color={GREEN} />
              <span style={{ fontSize: 12, color: GREEN }}>Scrolled here from slot tap — date pre-filled</span>
            </div>
          )}
        </div>

        {/* TIME */}
        <div style={{ padding: "8px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 8 }}>TIME</div>
          {pickedTime ? (
            <div style={{ display: "flex", gap: 8 }}>
              {["9:00 AM", "10:00 AM", "11:00 AM"].map(t => (
                <button key={t} onClick={() => setPickedTime(t)}
                  style={{ background: pickedTime === t ? "#1E1A0E" : CARD, border: `1.5px solid ${pickedTime === t ? GOLD : BORDER}`, borderRadius: 8, padding: "8px 12px", color: TEXT, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {t}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px", display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
              <Lock size={14} color={MUTED} /><span style={{ color: MUTED, fontSize: 13 }}>Pick a date first</span>
            </div>
          )}
        </div>

        {/* COACH */}
        <div style={{ padding: "8px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 8 }}>COACH</div>
          {pickedSlot ? (
            <div style={{ background: "#1E1A0E", borderRadius: 10, border: `1.5px solid ${GOLD}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#000", fontSize: 14 }}>M</div>
              <div>
                <div style={{ fontWeight: 700, color: TEXT }}>Mike Anderson</div>
                <div style={{ fontSize: 12, color: MUTED }}>Hitting Mechanics · Auto-selected</div>
              </div>
            </div>
          ) : (
            <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px", display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
              <Lock size={14} color={MUTED} /><span style={{ color: MUTED, fontSize: 13 }}>Pick a session type first</span>
            </div>
          )}
        </div>

        {/* SUMMARY */}
        <div style={{ padding: "8px 16px 8px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: MUTED, marginBottom: 8 }}>SUMMARY</div>
          {ready ? (
            <div style={{ background: CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 14 }}>
              {[["Session", "Cage Rental"], ["Date", `${pickedSlot!.day === "TODAY" ? "Thu May 14" : "Fri May 15"}`], ["Time", pickedTime!], ["Coach", "Mike Anderson"], ["Price", "$25"]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: MUTED, fontSize: 13 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: k === "Price" ? GOLD : TEXT, fontSize: 13 }}>{v}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ background: CARD, borderRadius: 10, border: `1px solid ${BORDER}`, padding: "14px", display: "flex", alignItems: "center", gap: 8, opacity: 0.5 }}>
              <Lock size={14} color={MUTED} /><span style={{ color: MUTED, fontSize: 13 }}>Complete steps above</span>
            </div>
          )}
        </div>

        {/* Steps counter */}
        <div style={{ padding: "4px 16px 0", textAlign: "center" }}>
          <span style={{ fontSize: 11, color: MUTED }}>
            {step === "slots" ? "Step 1 of 4: Pick a slot →" : "Step 2 of 4: Confirm date →"}
          </span>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, padding: "12px 16px 24px", background: DARK, borderTop: `1px solid ${BORDER}` }}>
        <button style={{ width: "100%", background: ready ? GOLD : BORDER, color: ready ? "#000" : MUTED, fontWeight: 800, fontSize: 15, padding: "14px", borderRadius: 12, border: "none", cursor: ready ? "pointer" : "default", letterSpacing: 1 }}>
          CONFIRM BOOKING
        </button>
        {!ready && (
          <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: MUTED }}>
            {pickedSlot ? "Scroll down to complete remaining steps" : "Select a slot above to begin"}
          </div>
        )}
      </div>
    </div>
  );
}
