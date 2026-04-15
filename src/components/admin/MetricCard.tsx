import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;   // percent change
    label: string;
  };
  variant?: "default" | "success" | "warning" | "danger";
}

const VARIANT_CLASSES = {
  default: "bg-blue-500/10 text-blue-400",
  success: "bg-emerald-500/10 text-emerald-400",
  warning: "bg-amber-500/10 text-amber-400",
  danger:  "bg-red-500/10 text-red-400",
};

export function MetricCard({
  title,
  value,
  description,
  icon,
  trend,
  variant = "default",
}: MetricCardProps) {
  const iconClasses = VARIANT_CLASSES[variant];

  const TrendIcon =
    !trend ? null
    : trend.value > 0 ? TrendingUp
    : trend.value < 0 ? TrendingDown
    : Minus;

  const trendColor =
    trend?.value === undefined ? ""
    : trend.value > 0  ? "text-emerald-400"
    : trend.value < 0  ? "text-red-400"
    : "text-slate-400";

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/[0.07] transition-colors">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm text-slate-400 font-medium">{title}</p>
        {icon && (
          <div className={`p-2 rounded-xl ${iconClasses}`}>
            {icon}
          </div>
        )}
      </div>

      <p className="text-2xl font-bold text-white tabular-nums">{value}</p>

      <div className="flex items-center justify-between mt-2">
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
        {trend && TrendIcon && (
          <span className={`flex items-center gap-1 text-xs font-medium ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            {Math.abs(trend.value)}% {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}
