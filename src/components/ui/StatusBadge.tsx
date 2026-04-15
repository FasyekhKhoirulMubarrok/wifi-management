type Status =
  | "online"
  | "offline"
  | "active"
  | "expired"
  | "unused"
  | "blocked"
  | "warning";

const STATUS_CONFIG: Record<Status, { label: string; dot: string; badge: string }> = {
  online:   { label: "Online",     dot: "bg-green-400",   badge: "bg-green-500/10 text-green-400 border-green-500/20" },
  offline:  { label: "Offline",    dot: "bg-red-400",     badge: "bg-red-500/10 text-red-400 border-red-500/20" },
  active:   { label: "Aktif",      dot: "bg-blue-400",    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  expired:  { label: "Expired",    dot: "bg-slate-400",   badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  unused:   { label: "Tersedia",   dot: "bg-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  blocked:  { label: "Diblokir",   dot: "bg-red-500",     badge: "bg-red-600/10 text-red-400 border-red-600/20" },
  warning:  { label: "Peringatan", dot: "bg-amber-400",   badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
};

export function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.offline;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
