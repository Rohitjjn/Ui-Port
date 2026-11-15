import { cn } from "@/utils/cn";
import { artwork } from "@/utils/artwork";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUiStore } from "@/store/uiStore";

/* ---------- Buttons ---------- */
export function IconButton({ className, children, size = "md", tone = "ghost", ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "md" | "lg"; tone?: "ghost" | "soft" | "ink" }) {
  const sz = size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";
  const tn =
    tone === "ink"
      ? "bg-ink text-paper hover:opacity-90"
      : tone === "soft"
        ? "bg-ivory text-ink hover:bg-sand/60"
        : "text-charcoal hover:bg-ivory hover:text-ink";
  return (
    <button type="button" className={cn("inline-flex shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40 disabled:active:scale-100", sz, tn, className)} {...rest}>
      {children}
    </button>
  );
}

export function Button({ className, children, variant = "primary", size = "md", icon, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "soft" | "outline" | "danger"; size?: "sm" | "md"; icon?: ReactNode }) {
  const v =
    variant === "primary"
      ? "bg-ink text-paper hover:opacity-90"
      : variant === "danger"
        ? "bg-rose/20 text-rose hover:bg-rose/30"
        : variant === "outline"
          ? "border border-sand text-ink hover:bg-ivory"
          : "bg-ivory text-ink hover:bg-sand/60";
  const s = size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-5 text-sm";
  return (
    <button type="button" className={cn("inline-flex items-center justify-center gap-2 rounded-full font-medium transition active:scale-[0.98] disabled:opacity-40", v, s, className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Chip({ active, children, onClick, className }: { active?: boolean; children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13px] font-medium transition active:scale-95", active ? "bg-ink text-paper" : "bg-ivory text-charcoal hover:bg-sand/60", className)}>
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", checked ? "bg-sage" : "bg-sand")}>
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}

/* ---------- Artwork ---------- */
export function Art({ palette, seed = 0, className, shape = "square", alt = "" }: { palette: number; seed?: number; className?: string; shape?: "square" | "wide" | "circle"; alt?: string }) {
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-ivory", shape === "circle" ? "rounded-full" : "rounded-sm", className)}>
      <img src={artwork(palette, seed, shape)} alt={alt} className="h-full w-full object-cover" draggable={false} />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-ink/10" />
    </div>
  );
}

export function Mosaic({ palettes, className }: { palettes: number[]; className?: string }) {
  const p = palettes.length ? palettes : [14];
  if (p.length < 4) return <Art palette={p[0]} className={className} />;
  return (
    <div className={cn("relative grid shrink-0 grid-cols-2 grid-rows-2 overflow-hidden rounded-sm bg-ivory", className)}>
      {p.slice(0, 4).map((pl, i) => (
        <img key={i} src={artwork(pl, i)} alt="" className="h-full w-full object-cover" />
      ))}
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-ink/10" />
    </div>
  );
}

/* ---------- Typography / layout ---------- */
export function Kicker({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("kicker", className)}>{children}</div>;
}

export function SectionHeader({ title, subtitle, action, onAction }: { title: string; subtitle?: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4 px-4 lg:px-0">
      <div>
        <h2 className="font-serif text-[24px] leading-tight text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-mute">{subtitle}</p>}
      </div>
      {action && (
        <button type="button" onClick={onAction} className="flex items-center gap-0.5 text-[13px] font-medium text-sage hover:underline">
          {action}
          <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, right, back = true, children }: { title?: string; subtitle?: string; right?: ReactNode; back?: boolean; children?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-2 bg-paper/85 px-4 pt-3 pb-2 backdrop-blur-md lg:mx-0 lg:px-0">
      <div className="flex items-center gap-2">
        {back && (
          <IconButton size="sm" onClick={() => nav(-1)} aria-label="Back">
            <ChevronLeft size={20} />
          </IconButton>
        )}
        <div className="min-w-0 flex-1">
          {title && <h1 className="truncate font-serif text-[22px] leading-tight">{title}</h1>}
          {subtitle && <p className="truncate text-[12px] text-mute">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

export function Empty({ title, body, action, children }: { title: string; body?: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <Botanical className="mb-4 h-20 w-20 text-olive" />
      <h3 className="font-serif text-[22px]">{title}</h3>
      {body && <p className="mt-1 max-w-xs text-[14px] text-mute">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <div className={cn("h-6 w-6 animate-spin rounded-full border-2 border-sand border-t-ink", className)} />;
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-mute">
      <Spinner />
      <span className="text-[13px]">{label}…</span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-sm", className)} />;
}

export function Botanical({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="1.2" className={className} aria-hidden>
      <path d="M50 92 C 48 70, 52 55, 50 40" />
      <path d="M50 70 C 38 68, 30 60, 28 50 C 40 52, 48 60, 50 70z" />
      <path d="M50 60 C 62 58, 70 50, 72 40 C 60 42, 52 50, 50 60z" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="50" cy="26" rx="7" ry="14" transform={`rotate(${a} 50 38)`} />
      ))}
      <circle cx="50" cy="38" r="4" fill="currentColor" />
    </svg>
  );
}

/* ---------- Sheet shell ---------- */
export function SheetShell({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 z-[70] bg-ink/30 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal
            className={cn("fixed inset-x-0 bottom-0 z-[80] mx-auto max-h-[88dvh] overflow-hidden rounded-t-xl bg-card shadow-lift sm:bottom-6 sm:rounded-xl", wide ? "sm:max-w-2xl" : "sm:max-w-md")}
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <div className="flex items-center justify-between px-5 pt-3">
              <div className="mx-auto h-1 w-10 rounded-full bg-sand sm:hidden" />
            </div>
            {title && (
              <div className="flex items-center justify-between px-5 pt-2">
                <h3 className="font-serif text-[20px]">{title}</h3>
                <IconButton size="sm" onClick={onClose} aria-label="Close">
                  <X size={18} />
                </IconButton>
              </div>
            )}
            <div className="max-h-[78dvh] overflow-y-auto px-5 pb-6 pt-2 safe-bottom">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export function SheetRow({ icon, label, sub, onClick, danger, trailing, disabled }: { icon: ReactNode; label: string; sub?: string; onClick?: () => void; danger?: boolean; trailing?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cn("flex w-full items-center gap-4 rounded-md px-2 py-3 text-left transition hover:bg-ivory disabled:opacity-40", danger && "text-rose")}>
      <span className={cn("text-charcoal", danger && "text-rose")}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px]">{label}</span>
        {sub && <span className="block truncate text-[12px] text-mute">{sub}</span>}
      </span>
      {trailing}
    </button>
  );
}

export function OptionList<T extends string>({ options, value, onChange }: { options: { id: T; label: string; sub?: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="divide-y divide-line">
      {options.map((o) => (
        <button key={o.id} type="button" onClick={() => onChange(o.id)} className="flex w-full items-center justify-between py-3 text-left">
          <span>
            <span className="block text-[15px]">{o.label}</span>
            {o.sub && <span className="block text-[12px] text-mute">{o.sub}</span>}
          </span>
          {value === o.id && <Check size={18} className="text-sage" />}
        </button>
      ))}
    </div>
  );
}

/* ---------- Toast ---------- */
export function Toast() {
  const msg = useUiStore((s) => s.toastMsg);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => useUiStore.setState({ toastMsg: null }), 2400);
    return () => clearTimeout(id);
  }, [msg]);
  return (
    <AnimatePresence>
      {msg && (
        <motion.div key={msg.id} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }} className="pointer-events-none fixed inset-x-0 bottom-[150px] z-[90] flex justify-center px-4 lg:bottom-28">
          <div className="rounded-full bg-ink px-4 py-2.5 text-[13px] font-medium text-paper shadow-lift">{msg.text}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Slider({ value, min = 0, max = 100, step = 1, onChange, onCommit, className, ariaLabel }: { value: number; min?: number; max?: number; step?: number; onChange: (v: number) => void; onCommit?: (v: number) => void; className?: string; ariaLabel?: string }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      aria-label={ariaLabel}
      className={cn("slider", className)}
      style={{ ["--pct" as string]: `${pct}%` }}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onMouseUp={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
      onTouchEnd={(e) => onCommit?.(parseFloat((e.target as HTMLInputElement).value))}
    />
  );
}
