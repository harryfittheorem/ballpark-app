import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function PageHead({ title, sub, children }: { title: string; sub: string; children?: ReactNode }) {
  return <div className="page-heading"><div><h1>{title}</h1><div className="subhead">{sub}</div></div>{children}</div>;
}

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const focusables = () => Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []);
    focusables()[0]?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      const elements = focusables();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", trap);
    return () => { window.removeEventListener("keydown", trap); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) close(); }}>
    <div ref={dialogRef} className="modal" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-head"><div><div className="eyebrow">Clubhouse · simulated review</div><div className="modal-title">{title}</div></div><button className="icon-btn" onClick={close} aria-label="Close dialog"><X size={15}/></button></div>
      {children}
    </div>
  </div>;
}
