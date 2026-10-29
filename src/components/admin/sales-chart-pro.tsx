"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";
import type { DailyPoint } from "@/lib/admin-data";
import { formatPrice, formatDate } from "@/lib/format";

type Tip = { x: number; y: number; width: number; date: string; revenue: number; orders: number };
type Stats = { revenue: number; orders: number; avg: number; change: number | null; label: string };

const PRESETS: { key: string; label: string; days: number | "all" }[] = [
  { key: "1W", label: "1W", days: 7 },
  { key: "1M", label: "1M", days: 30 },
  { key: "3M", label: "3M", days: 90 },
  { key: "6M", label: "6M", days: 180 },
  { key: "1Y", label: "1Y", days: 365 },
  { key: "ALL", label: "All", days: "all" },
];

function shortMoney(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1)}M`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(a >= 10_000 ? 0 : 1)}k`;
  return String(Math.round(n));
}

function timeToKey(t: Time | undefined): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  if (typeof t === "object" && "year" in t) {
    const b = t as { year: number; month: number; day: number };
    return `${b.year}-${String(b.month).padStart(2, "0")}-${String(b.day).padStart(2, "0")}`;
  }
  return String(t);
}

function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y) return key;
  return formatDate(new Date(y, m - 1, d));
}

function palette() {
  const dark =
    typeof document !== "undefined" && document.documentElement.getAttribute("data-theme") === "dark";
  return dark
    ? {
        text: "#dcc6ad",
        grid: "rgba(230,205,139,0.10)",
        border: "rgba(230,205,139,0.18)",
        line: "#cda65a",
        top: "rgba(205,166,90,0.5)",
        bottom: "rgba(205,166,90,0.02)",
        cross: "#e6cd8b",
        marker: "#241319",
        orders: "#818cf8",
      }
    : {
        text: "#8a6f63",
        grid: "rgba(91,26,43,0.07)",
        border: "rgba(91,26,43,0.14)",
        line: "#a97e30",
        top: "rgba(195,154,78,0.45)",
        bottom: "rgba(195,154,78,0.02)",
        cross: "#a97e30",
        marker: "#ffffff",
        orders: "#6366f1",
      };
}


export function SalesChartPro({ points }: { points: DailyPoint[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const [preset, setPreset] = useState("3M");
  const [stats, setStats] = useState<Stats>({ revenue: 0, orders: 0, avg: 0, change: null, label: "" });

  const idxByTime = useMemo(() => {
    const m = new Map<string, number>();
    points.forEach((p, i) => m.set(p.time, i));
    return m;
  }, [points]);
  const ordersByTime = useMemo(() => new Map(points.map((p) => [p.time, p.orders])), [points]);

  // Compute the insight tiles for the currently visible window (updates on zoom/pan).
  const recompute = () => {
    const chart = chartRef.current;
    if (!chart || points.length === 0) return;
    const vr = chart.timeScale().getVisibleRange();
    let from = points[0].time;
    let to = points[points.length - 1].time;
    if (vr) {
      from = timeToKey(vr.from) || from;
      to = timeToKey(vr.to) || to;
    }
    let fromIdx = idxByTime.get(from);
    let toIdx = idxByTime.get(to);
    if (fromIdx == null) fromIdx = 0;
    if (toIdx == null) toIdx = points.length - 1;
    let rev = 0;
    let ord = 0;
    for (let i = fromIdx; i <= toIdx; i++) {
      rev += points[i].revenue;
      ord += points[i].orders;
    }
    const len = toIdx - fromIdx + 1;
    let prev = 0;
    const pTo = fromIdx - 1;
    const pFrom = pTo - len + 1;
    if (pFrom >= 0) for (let i = pFrom; i <= pTo; i++) prev += points[i].revenue;
    const change = prev > 0 ? Math.round(((rev - prev) / prev) * 100) : rev > 0 && pFrom >= 0 ? 100 : null;
    setStats({
      revenue: rev,
      orders: ord,
      avg: ord > 0 ? Math.round(rev / ord) : 0,
      change,
      label: `${prettyDate(from)} — ${prettyDate(to)}`,
    });
  };

  const applyPreset = (days: number | "all") => {
    const chart = chartRef.current;
    if (!chart || points.length === 0) return;
    const ts = chart.timeScale();
    if (days === "all") {
      ts.fitContent();
      return;
    }
    const lastIdx = points.length - 1;
    const fromIdx = Math.max(0, lastIdx - (days - 1));
    ts.setVisibleRange({
      from: points[fromIdx].time as Time,
      to: points[lastIdx].time as Time,
    });
  };

  const zoom = (factor: number) => {
    const chart = chartRef.current;
    if (!chart) return;
    const ts = chart.timeScale();
    const lr = ts.getVisibleLogicalRange();
    if (!lr) return;
    const center = (lr.from + lr.to) / 2;
    const half = ((lr.to - lr.from) / 2) * factor;
    ts.setVisibleLogicalRange({ from: center - half, to: center + half });
  };

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || points.length === 0) return;
    const c = palette();

    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: c.text,
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      rightPriceScale: { borderColor: c.border, scaleMargins: { top: 0.15, bottom: 0.1 } },
      leftPriceScale: { visible: true, borderColor: c.border, scaleMargins: { top: 0.15, bottom: 0.1 } },
      timeScale: { borderColor: c.border, fixLeftEdge: true, fixRightEdge: true, minBarSpacing: 0.5 },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: c.cross, width: 1, style: 2, labelBackgroundColor: c.line },
        horzLine: { color: c.cross, width: 1, style: 2, labelBackgroundColor: c.line },
      },
      handleScroll: true,
      handleScale: true,
    });

    const series = chart.addAreaSeries({
      lineColor: c.line,
      topColor: c.top,
      bottomColor: c.bottom,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => `Rs ${shortMoney(v)}`, minMove: 1 },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 5,
      crosshairMarkerBorderColor: c.marker,
      crosshairMarkerBackgroundColor: c.line,
    });
    series.setData(points.map((p) => ({ time: p.time as Time, value: p.revenue })));

    // Orders line on a separate (left) axis
    const ordersSeries = chart.addLineSeries({
      color: c.orders,
      lineWidth: 2,
      priceScaleId: "left",
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: "custom", formatter: (v: number) => `${Math.round(v)}`, minMove: 1 },
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: c.marker,
      crosshairMarkerBackgroundColor: c.orders,
    });
    ordersSeries.setData(points.map((p) => ({ time: p.time as Time, value: p.orders })));

    chartRef.current = chart;
    seriesRef.current = series;

    // initial view: 3 months
    applyPreset(90);
    recompute();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        setTip(null);
        return;
      }
      const key = timeToKey(param.time);
      const sd = param.seriesData.get(series) as { value?: number } | undefined;
      const revenue = sd && typeof sd.value === "number" ? sd.value : 0;
      setTip({
        x: param.point.x,
        y: param.point.y,
        // measured here (event time), not during render
        width: wrapRef.current?.clientWidth ?? 300,
        date: key,
        revenue,
        orders: ordersByTime.get(key) ?? 0,
      });
    });

    chart.timeScale().subscribeVisibleTimeRangeChange(recompute);

    // re-theme on light/dark toggle
    const obs = new MutationObserver(() => {
      const p = palette();
      chart.applyOptions({
        layout: { textColor: p.text },
        grid: { vertLines: { color: p.grid }, horzLines: { color: p.grid } },
        rightPriceScale: { borderColor: p.border },
        leftPriceScale: { borderColor: p.border },
        timeScale: { borderColor: p.border },
        crosshair: {
          vertLine: { color: p.cross, labelBackgroundColor: p.line },
          horzLine: { color: p.cross, labelBackgroundColor: p.line },
        },
      });
      series.applyOptions({
        lineColor: p.line,
        topColor: p.top,
        bottomColor: p.bottom,
        crosshairMarkerBorderColor: p.marker,
        crosshairMarkerBackgroundColor: p.line,
      });
      ordersSeries.applyOptions({
        color: p.orders,
        crosshairMarkerBorderColor: p.marker,
        crosshairMarkerBackgroundColor: p.orders,
      });
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

    return () => {
      obs.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);

  const onPreset = (key: string, days: number | "all") => {
    setPreset(key);
    applyPreset(days);
    // recompute after the range settles
    requestAnimationFrame(recompute);
  };

  const empty = points.every((p) => p.revenue === 0);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-surface p-5 shadow-[0_10px_30px_-22px_rgba(38,8,16,0.4)] sm:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="eyebrow">Analytics</span>
          <h2 className="mt-1 font-serif text-xl font-semibold text-ink">Sales performance</h2>
          <p className="mt-0.5 text-xs text-muted">{stats.label || "Scroll to zoom · drag to pan"}</p>
          {/* Legend */}
          <div className="mt-2 flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-gold-deep" /> Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm" style={{ background: "#6366f1" }} /> Orders
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Range presets */}
          <div className="inline-flex rounded-full border border-[var(--line)] bg-cream-soft p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => onPreset(p.key, p.days)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                  preset === p.key ? "bg-maroon text-light shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {/* Zoom controls */}
          <div className="inline-flex items-center gap-1">
            <ZoomBtn label="Zoom out" onClick={() => zoom(1.6)}>
              <path d="M5 12h14" strokeLinecap="round" />
            </ZoomBtn>
            <ZoomBtn label="Zoom in" onClick={() => zoom(0.6)}>
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </ZoomBtn>
            <ZoomBtn label="Reset zoom" onClick={() => onPreset("ALL", "all")}>
              <path d="M4 4v6h6M20 20v-6h-6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 10a8 8 0 0 0-14-4M4 14a8 8 0 0 0 14 4" strokeLinecap="round" />
            </ZoomBtn>
          </div>
        </div>
      </div>

      {/* Insight tiles (reflect the visible window) */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Insight label="Sales (shown)" value={formatPrice(stats.revenue)} />
        <Insight label="Orders (shown)" value={String(stats.orders)} />
        <Insight label="Avg. order value" value={formatPrice(stats.avg)} />
        <Insight
          label="Growth"
          value={stats.change == null ? "—" : `${stats.change >= 0 ? "+" : ""}${stats.change}%`}
          hint="vs previous equal window"
          tone={stats.change == null ? "neutral" : stats.change >= 0 ? "up" : "down"}
        />
      </div>

      {/* Chart */}
      <div className="relative mt-6">
        <div ref={wrapRef} style={{ width: "100%", height: 340 }} />
        {tip && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-[var(--line)] bg-surface px-3.5 py-2.5 shadow-[0_18px_44px_-18px_rgba(38,8,16,0.5)]"
            style={{
              left: Math.min(Math.max(tip.x, 70), tip.width - 70),
              top: Math.max(tip.y - 16, 4),
              transform: "translate(-50%, -100%)",
            }}
          >
            <p className="text-[0.7rem] font-medium uppercase tracking-wider text-muted">
              {prettyDate(tip.date)}
            </p>
            <p className="mt-0.5 font-serif text-lg font-semibold text-ink [font-variant-numeric:tabular-nums]">
              {formatPrice(tip.revenue)}
            </p>
            <p className="text-xs text-muted">
              {tip.orders} order{tip.orders === 1 ? "" : "s"}
            </p>
          </div>
        )}
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-full bg-cream-soft px-4 py-1.5 text-xs text-muted">
              No sales yet — your daily revenue will chart here as orders arrive.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ZoomBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line)] bg-cream-soft text-ink transition-colors hover:border-gold hover:text-gold-deep"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        {children}
      </svg>
    </button>
  );
}

function Insight({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "up" | "down" | "neutral";
}) {
  const toneCls =
    tone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-ink";
  return (
    <div className="rounded-xl border border-[var(--line)] bg-cream-soft px-4 py-3">
      <p className="text-[0.62rem] font-medium uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className={`mt-1 font-serif text-xl font-bold [font-variant-numeric:tabular-nums] ${toneCls}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[0.65rem] text-muted">{hint}</p>}
    </div>
  );
}
