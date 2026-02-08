// Updated component source (SedarSentiment (1).jsx).
import { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell, BarChart,
  LineChart, Legend,
} from "recharts";

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS — matches App.jsx exactly
   ═══════════════════════════════════════════════════ */
const C = {
  bg: "#f8f7f4", card: "#fff", bd: "#e4dfd7", tx: "#2a2623",
  dm: "#8a847a", g: "#1a6b3a", r: "#c24525", w: "#a87d1a",
  bl: "#1a4f7a", hi: "#f0ebe3", acc: "#d4583b",
};

const CAT_META = {
  neg:    { label: "Negative",     color: "#c24525", short: "NEG" },
  pos:    { label: "Positive",     color: "#1a6b3a", short: "POS" },
  unc:    { label: "Uncertainty",  color: "#a87d1a", short: "UNC" },
  lit:    { label: "Litigious",    color: "#1a4f7a", short: "LIT" },
  constr: { label: "Constraining", color: "#7c5cbf", short: "CON" },
  modal_strong: { label: "Strong Modal", color: "#0d7377", short: "STR" },
  modal_weak:   { label: "Weak Modal",   color: "#8a847a", short: "WK" },
};

const DT_LABELS = {
  interim_mda: "Interim MD&A", annual_mda: "Annual MD&A",
  interim_fs: "Interim FS", annual_fs: "Annual FS",
  aif: "AIF", mcr: "Material Change", news_release: "News Release",
};

const DT_ORDER = ["interim_mda", "annual_mda", "interim_fs", "annual_fs", "aif", "mcr", "news_release"];

/* ═══════════════════════════════════════════════════
   SHARED UI COMPONENTS
   ═══════════════════════════════════════════════════ */
const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: 4, padding: 16, ...style }}>
    {children}
  </div>
);

const Lbl = ({ children }) => (
  <div style={{
    fontSize: 10, fontWeight: 800, fontFamily: "'IBM Plex Mono', monospace",
    letterSpacing: 1.2, marginBottom: 10, textTransform: "uppercase",
  }}>{children}</div>
);

const StatBox = ({ l, v, sub, c }) => (
  <div style={{ background: C.hi, borderRadius: 4, padding: "8px 10px", flex: 1 }}>
    <div style={{ fontSize: 7, fontFamily: "'IBM Plex Mono', monospace", color: C.dm, letterSpacing: 1, textTransform: "uppercase" }}>{l}</div>
    <div style={{ fontSize: 17, fontWeight: 800, color: c || C.tx, marginTop: 2 }}>{v}</div>
    {sub && <div style={{ fontSize: 8, color: C.dm, marginTop: 1 }}>{sub}</div>}
  </div>
);

const Pill = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    padding: "4px 10px", fontSize: 9, fontWeight: 700,
    fontFamily: "'IBM Plex Mono', monospace",
    background: active ? (color || C.tx) : "transparent",
    color: active ? "#fff" : C.dm,
    border: `1px solid ${active ? (color || C.tx) : C.bd}`,
    borderRadius: 3, cursor: "pointer", transition: "all 0.15s",
  }}>{label}</button>
);

/* ═══════════════════════════════════════════════════
   DATA TRANSFORM
   ═══════════════════════════════════════════════════ */
function transformSedar(raw) {
  if (!raw) return null;

  const cats = ["neg", "pos", "unc", "lit", "constr", "modal_strong", "modal_weak"];

  // Timeline with full data
  const timeline = (raw.timeline || []).map(t => {
    const d = t.delta || {};
    const l = t.level || {};
    const row = {
      id: t.comparison_id, doc_type: t.doc_type, period: t.period,
      filed_date: t.filed_date, curr_words: t.curr_words, prev_words: t.prev_words,
      expansion_pct: t.expansion_pct ?? 0,
      sentences_added: t.sentences_added ?? 0, sentences_removed: t.sentences_removed ?? 0,
      composite_delta: t.composite_delta ?? 0, z_composite: t.z_composite_delta ?? 0,
    };
    for (const c of cats) {
      row[`d_${c}`] = d[c]?.rate ?? 0;       // delta rate
      row[`z_${c}`] = d[c]?.z ?? 0;          // global z
      row[`l_${c}`] = l[c]?.curr_rate ?? 0;  // absolute level (curr)
      row[`lp_${c}`] = l[c]?.prev_rate ?? 0; // absolute level (prev)
      row[`lc_${c}`] = l[c]?.level_change ?? 0;
      row[`ar_${c}`] = d[c]?.added_rate ?? 0;   // added rate
      row[`rr_${c}`] = d[c]?.removed_rate ?? 0; // removed rate
    }
    return row;
  });

  // Compute doc-type-specific z-scores
  const byDocType = {};
  for (const t of timeline) {
    if (!byDocType[t.doc_type]) byDocType[t.doc_type] = [];
    byDocType[t.doc_type].push(t);
  }

  for (const [dt, rows] of Object.entries(byDocType)) {
    for (const c of cats) {
      const vals = rows.map(r => r[`d_${c}`]);
      const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length);
      for (const r of rows) {
        r[`zdt_${c}`] = std > 0 ? (r[`d_${c}`] - mean) / std : 0;
      }
    }
    // Composite doc-type z
    const compVals = rows.map(r => r.composite_delta);
    const compMean = compVals.reduce((s, v) => s + v, 0) / compVals.length;
    const compStd = Math.sqrt(compVals.reduce((s, v) => s + (v - compMean) ** 2, 0) / compVals.length);
    for (const r of rows) {
      r.zdt_composite = compStd > 0 ? (r.composite_delta - compMean) / compStd : 0;
    }
  }

  // Category series (pre-grouped by doc type)
  const categorySeries = raw.category_series || {};

  // Section detail
  const sectionDetail = raw.section_detail || [];

  // Alerts
  const alerts = (raw.alerts || []).map(a => ({
    doc_type: a.doc_type, section: a.section, category: a.category_label || a.category,
    delta_rate: a.delta_rate, period: a.period, z: a.z_score,
    severity: a.severity, direction: a.direction, sa: a.sentences_added ?? 0,
  }));

  // Heatmap: flatten
  const heatmap = [];
  for (const [dtKey, cells] of Object.entries(raw.heatmap || {})) {
    for (const cell of cells) {
      heatmap.push({ doc_type: dtKey, period: cell.period, section: cell.section, ...cell });
    }
  }

  return {
    timeline, alerts, heatmap, categorySeries, sectionDetail,
    rankings: raw.rankings || {},
    summaryStats: raw.summary_stats || {},
    drilldown: raw.drilldown || {},
    meta: raw.meta || {},
    byDocType,
  };
}

/* ═══════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ═══════════════════════════════════════════════════ */
function formatPeriod(p) {
  if (!p || p.length < 7) return p;
  return p.slice(2, 7).replace("-", "'");
}

function zColor(z, opacity = 1) {
  const abs = Math.abs(z);
  if (abs < 1) return `rgba(138,132,122,${0.3 * opacity})`;
  if (abs < 1.5) return z > 0 ? `rgba(194,69,37,${0.5 * opacity})` : `rgba(26,107,58,${0.5 * opacity})`;
  if (abs < 2) return z > 0 ? `rgba(194,69,37,${0.7 * opacity})` : `rgba(26,107,58,${0.7 * opacity})`;
  return z > 0 ? `rgba(194,69,37,${opacity})` : `rgba(26,107,58,${opacity})`;
}

function deltaColor(v) {
  return v > 0 ? C.r : v < 0 ? C.g : C.dm;
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function SedarSentiment({ rawJson, priceData, ticker, tickerDisplay }) {
  // State
  const [docType, setDocType] = useState("interim_mda");
  const [metric, setMetric] = useState("composite");
  const [view, setView] = useState("priceTone");
  const [toneMode, setToneMode] = useState("delta"); // delta or level
  const [hmMetric, setHmMetric] = useState("composite");
  const [hmSort, setHmSort] = useState("maxDelta");
  const [expandedCell, setExpandedCell] = useState(null);

  // Transform
  const data = useMemo(() => transformSedar(rawJson), [rawJson]);

  if (!data || data.timeline.length === 0) {
    return (
      <Card style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>No SEDAR+ sentiment data available for {tickerDisplay}.</div>
      </Card>
    );
  }

  // Available doc types for this ticker
  const availDocTypes = DT_ORDER.filter(dt => data.byDocType[dt]?.length > 0);

  // Filtered timeline
  const filtered = data.timeline
    .filter(t => t.doc_type === docType)
    .sort((a, b) => a.period.localeCompare(b.period));

  // Metric keys
  const metricCat = metric === "composite" ? null : metric;
  const deltaKey = metricCat ? `d_${metricCat}` : "composite_delta";
  const zKey = metricCat ? `zdt_${metricCat}` : "zdt_composite";
  const levelKey = metricCat ? `l_${metricCat}` : null;

  // Stats
  const zVals = filtered.map(t => t[zKey]);
  const outliers = filtered.filter(t => Math.abs(t[zKey]) >= 1.5);
  const latestSpike = outliers.length > 0
    ? outliers.reduce((a, b) => a.period > b.period ? a : b)
    : null;
  const maxIncrease = filtered.length > 0 ? filtered.reduce((a, b) => b[zKey] > a[zKey] ? b : a) : null;
  const maxDecrease = filtered.length > 0 ? filtered.reduce((a, b) => b[zKey] < a[zKey] ? b : a) : null;

  // ═══════════════════════════════════════════════════
  // VIEW: Price × Tone
  // ═══════════════════════════════════════════════════
  const renderPriceTone = () => {
    const prices = priceData || [];

    if (toneMode === "delta") {
      // Merge tone deltas with price data
      const merged = filtered.map(t => {
        const lag = ["interim_mda","annual_mda","interim_fs","annual_fs","aif"].includes(t.doc_type) ? 45 : 0;
        const targetDate = new Date(t.period);
        targetDate.setDate(targetDate.getDate() + lag);
        const tStr = targetDate.toISOString().slice(0, 10);
        const nearest = prices.reduce((best, p) =>
          Math.abs(new Date(p.d) - targetDate) < Math.abs(new Date(best.d) - targetDate) ? p : best
        , prices[0]);
        return {
          period: formatPeriod(t.period),
          fullPeriod: t.period,
          delta: +(t[deltaKey] * (metric === "composite" ? 1 : 1)).toFixed(2),
          z: +t[zKey].toFixed(2),
          price: nearest?.c ?? null,
          docType: DT_LABELS[t.doc_type] || t.doc_type,
          sa: t.sentences_added,
          sr: t.sentences_removed,
          exp: t.expansion_pct,
        };
      });

      // Interleave price-only points for smoother line
      const priceLine = prices
        .filter(p => {
          if (merged.length < 2) return false;
          return p.d >= merged[0].fullPeriod && p.d <= merged[merged.length - 1].fullPeriod;
        })
        .filter((_, i) => i % 4 === 0)
        .map(p => ({ period: formatPeriod(p.d), fullPeriod: p.d, price: p.c, delta: null, z: null }));

      const combined = [...merged, ...priceLine]
        .sort((a, b) => a.fullPeriod.localeCompare(b.fullPeriod))
        .reduce((acc, cur) => {
          const existing = acc.find(a => a.period === cur.period);
          if (existing) {
            if (cur.delta !== null && cur.delta !== undefined) existing.delta = cur.delta;
            if (cur.z !== null && cur.z !== undefined) existing.z = cur.z;
            if (cur.price !== null) existing.price = cur.price;
            if (cur.docType) existing.docType = cur.docType;
            if (cur.sa) existing.sa = cur.sa;
          } else {
            acc.push({ ...cur });
          }
          return acc;
        }, []);

      const maxDelta = Math.max(...combined.filter(d => d.delta != null).map(d => Math.abs(d.delta)), 1);
      const priceRange = prices.length > 0
        ? [Math.min(...prices.map(p => p.c)) * 0.9, Math.max(...prices.map(p => p.c)) * 1.1]
        : [0, 10];

      return (
        <Card style={{ marginBottom: 12 }}>
          <Lbl>{tickerDisplay} Price Overlay — {metric === "composite" ? "Composite" : CAT_META[metric]?.label} Tone Delta vs Weekly Close</Lbl>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart data={combined} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.5} />
                <XAxis dataKey="period" tick={{ fontSize: 8, fill: C.dm }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 8, fill: C.dm }} domain={[-maxDelta * 1.2, maxDelta * 1.2]} label={{ value: "δ×1000", angle: -90, position: "insideLeft", style: { fontSize: 8, fill: C.dm } }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: C.r }} domain={priceRange} label={{ value: "C$", angle: 90, position: "insideRight", style: { fontSize: 8, fill: C.r } }} />
                <Tooltip
                  contentStyle={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: 4, fontSize: 9 }}
                  formatter={(val, name) => {
                    if (name === "price") return [`C$${val?.toFixed(2)}`, "Price"];
                    if (name === "delta") return [val?.toFixed(2), "Tone Delta"];
                    return [val, name];
                  }}
                />
                <ReferenceLine yAxisId="left" y={0} stroke={C.r} strokeDasharray="4 4" opacity={0.5} />
                <Bar yAxisId="left" dataKey="delta" name="delta" maxBarSize={18}>
                  {combined.map((d, i) => (
                    <Cell key={i} fill={d.delta > 0 ? `${C.r}99` : `${C.g}99`} />
                  ))}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="price" stroke={C.bl} strokeWidth={2} dot={{ r: 2.5, fill: C.bl }} connectNulls name="price" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ fontSize: 8, color: C.dm, marginTop: 6 }}>
            Filing tone deltas (bars) vs {tickerDisplay} weekly close (line). Periodic filings use +45 day lag; news/MCR use filing date directly.
          </div>
        </Card>
      );
    }

    // Level mode
    const catSeries = data.categorySeries[docType];
    if (!catSeries) return <Card><div style={{ fontSize: 10, color: C.dm }}>No category series data for {DT_LABELS[docType]}.</div></Card>;

    const levelCats = metricCat ? [metricCat] : ["neg", "unc", "lit", "constr", "pos"];
    const chartData = [];
    const periods = catSeries[levelCats[0]]?.map(p => p.period) || [];

    for (let i = 0; i < periods.length; i++) {
      const row = { period: formatPeriod(periods[i]), fullPeriod: periods[i] };
      for (const cat of levelCats) {
        const entry = catSeries[cat]?.[i];
        if (entry) row[cat] = entry.curr_rate;
      }
      // Find nearest price
      const targetDate = new Date(periods[i]);
      targetDate.setDate(targetDate.getDate() + 45);
      const nearest = priceData?.reduce((best, p) =>
        Math.abs(new Date(p.d) - targetDate) < Math.abs(new Date(best.d) - targetDate) ? p : best
      , priceData[0]);
      if (nearest) row.price = nearest.c;
      chartData.push(row);
    }

    const priceRange = priceData?.length > 0
      ? [Math.min(...priceData.map(p => p.c)) * 0.9, Math.max(...priceData.map(p => p.c)) * 1.1]
      : [0, 10];

    return (
      <Card style={{ marginBottom: 12 }}>
        <Lbl>{tickerDisplay} Tone Level vs Price — {DT_LABELS[docType]} ({metric === "composite" ? "All Categories" : CAT_META[metric]?.label})</Lbl>
        <div style={{ width: "100%", height: 340 }}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{ top: 10, right: 50, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.5} />
              <XAxis dataKey="period" tick={{ fontSize: 8, fill: C.dm }} />
              <YAxis yAxisId="left" tick={{ fontSize: 8, fill: C.dm }} label={{ value: "hits / 10K words", angle: -90, position: "insideLeft", style: { fontSize: 8, fill: C.dm } }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 8, fill: C.r }} domain={priceRange} label={{ value: "C$", angle: 90, position: "insideRight", style: { fontSize: 8, fill: C.r } }} />
              <Tooltip contentStyle={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: 4, fontSize: 9 }} />
              {levelCats.map(cat => (
                <Area
                  key={cat} yAxisId="left" type="monotone" dataKey={cat}
                  stroke={CAT_META[cat].color} fill={CAT_META[cat].color}
                  fillOpacity={0.08} strokeWidth={1.5}
                  name={CAT_META[cat].label}
                  dot={{ r: 2, fill: CAT_META[cat].color }}
                />
              ))}
              <Line yAxisId="right" type="monotone" dataKey="price" stroke={C.bl} strokeWidth={2} strokeDasharray="6 3" dot={false} name="Price" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 8, color: C.dm, marginTop: 6 }}>
          Absolute tone levels (hits per 10,000 words) for {DT_LABELS[docType]} filings. Dashed line = {tickerDisplay} weekly close (+45d lag).
        </div>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════
  // VIEW: Tone Levels
  // ═══════════════════════════════════════════════════
  const renderToneLevels = () => {
    const catSeries = data.categorySeries[docType];
    if (!catSeries) {
      return <Card><div style={{ fontSize: 10, color: C.dm }}>No level data for {DT_LABELS[docType]}.</div></Card>;
    }

    const activeCats = ["neg", "unc", "lit", "constr", "pos"];
    const periods = catSeries[activeCats[0]]?.map(p => p.period) || [];

    // Build chart data
    const chartData = periods.map((p, i) => {
      const row = { period: formatPeriod(p), fullPeriod: p };
      for (const cat of activeCats) {
        const entry = catSeries[cat]?.[i];
        if (entry) {
          row[cat] = +entry.curr_rate.toFixed(1);
          row[`${cat}_delta`] = +entry.delta_rate.toFixed(1);
        }
      }
      row.expansion = catSeries[activeCats[0]]?.[i] ? undefined : undefined;
      return row;
    });

    // Compute historical means for reference bands
    const means = {};
    for (const cat of activeCats) {
      const vals = chartData.map(d => d[cat]).filter(v => v != null);
      means[cat] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }

    // Latest values for summary
    const latest = chartData[chartData.length - 1];
    const prevQ = chartData.length > 1 ? chartData[chartData.length - 2] : null;

    return (<>
      <Card style={{ marginBottom: 12, background: C.hi, border: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Absolute Tone Levels — {tickerDisplay} {DT_LABELS[docType]}
        </div>
        <div style={{ fontSize: 10, color: C.dm, lineHeight: 1.7, maxWidth: 800 }}>
          Hits per 10,000 words for each sentiment category. Shows the absolute density of risk/tone language in each filing,
          independent of changes between filings. Useful for tracking long-term trends and cross-ticker comparisons.
        </div>
      </Card>

      {/* Summary stats */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${activeCats.length}, 1fr)`, gap: 8, marginBottom: 12 }}>
        {activeCats.map(cat => {
          const curr = latest?.[cat];
          const prev = prevQ?.[cat];
          const chg = curr != null && prev != null ? curr - prev : null;
          return (
            <StatBox
              key={cat}
              l={CAT_META[cat].label}
              v={curr != null ? curr.toFixed(0) : "—"}
              sub={chg != null ? `${chg > 0 ? "+" : ""}${chg.toFixed(0)} vs prior` : `avg: ${means[cat]?.toFixed(0)}`}
              c={CAT_META[cat].color}
            />
          );
        })}
      </div>

      <Card style={{ marginBottom: 12 }}>
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.5} />
              <XAxis dataKey="period" tick={{ fontSize: 8, fill: C.dm }} />
              <YAxis tick={{ fontSize: 8, fill: C.dm }} label={{ value: "hits / 10K words", angle: -90, position: "insideLeft", style: { fontSize: 8, fill: C.dm } }} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: 4, fontSize: 9 }}
                formatter={(val, name) => [`${val?.toFixed(1)} /10K`, CAT_META[name]?.label || name]}
              />
              {activeCats.map(cat => (
                <Line
                  key={cat} type="monotone" dataKey={cat}
                  stroke={CAT_META[cat].color} strokeWidth={2}
                  dot={{ r: 3, fill: CAT_META[cat].color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  name={cat}
                />
              ))}
              {/* Historical mean reference lines */}
              {activeCats.map(cat => (
                <ReferenceLine
                  key={`mean_${cat}`}
                  y={means[cat]}
                  stroke={CAT_META[cat].color}
                  strokeDasharray="3 6"
                  opacity={0.3}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
          {activeCats.map(cat => (
            <div key={cat} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 8, color: C.dm }}>
              <div style={{ width: 10, height: 3, background: CAT_META[cat].color, borderRadius: 1 }} />
              {CAT_META[cat].label}
              <span style={{ opacity: 0.6 }}>(avg: {means[cat]?.toFixed(0)})</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 8, color: C.dm, marginTop: 6 }}>
          Dashed lines = historical mean for each category within {DT_LABELS[docType]} filings.
        </div>
      </Card>
    </>);
  };

  // ═══════════════════════════════════════════════════
  // VIEW: Tone Deltas (Z-Scores)
  // ═══════════════════════════════════════════════════
  const renderToneDeltas = () => {
    const chartData = filtered.map(t => ({
      period: formatPeriod(t.period),
      fullPeriod: t.period,
      z: +t[zKey].toFixed(2),
      delta: +t[deltaKey].toFixed(2),
      docType: DT_LABELS[t.doc_type],
      sa: t.sentences_added,
      sr: t.sentences_removed,
      exp: t.expansion_pct,
    }));

    return (<>
      <Card style={{ marginBottom: 12, background: C.hi, border: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Tone Deltas — {tickerDisplay} {DT_LABELS[docType]} (Doc-Type Z-Scores)
        </div>
        <div style={{ fontSize: 10, color: C.dm, lineHeight: 1.7, maxWidth: 800 }}>
          Change in tone between consecutive filings, z-scored <b>within {DT_LABELS[docType]}</b> only.
          This eliminates skew from mixing annual and interim reports.
          <b style={{ color: C.r }}> Red = more risk language added.</b>
          <b style={{ color: C.g }}> Green = risk language removed.</b>
        </div>
      </Card>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
        <StatBox l="Comparisons" v={filtered.length} sub={DT_LABELS[docType]} />
        <StatBox l="Outliers |z|≥1.5" v={outliers.length} sub={`of ${filtered.length} filings`} c={outliers.length > 0 ? C.w : C.dm} />
        <StatBox
          l="Latest Spike"
          v={latestSpike ? `z=${latestSpike[zKey] > 0 ? "+" : ""}${latestSpike[zKey].toFixed(1)}` : "—"}
          sub={latestSpike ? `${DT_LABELS[latestSpike.doc_type]} ${latestSpike.period}` : "none"}
          c={latestSpike ? deltaColor(latestSpike[zKey]) : C.dm}
        />
        <StatBox
          l="Max Risk Increase"
          v={maxIncrease ? `z=${maxIncrease[zKey] > 0 ? "+" : ""}${maxIncrease[zKey].toFixed(1)}` : "—"}
          sub={metric === "composite" ? "composite delta" : CAT_META[metric]?.label}
          c={C.r}
        />
        <StatBox
          l="Max Risk Decrease"
          v={maxDecrease ? `z=${maxDecrease[zKey].toFixed(1)}` : "—"}
          sub={metric === "composite" ? "composite delta" : CAT_META[metric]?.label}
          c={C.g}
        />
      </div>

      <Card style={{ marginBottom: 12 }}>
        <Lbl>Z-Score Timeline — {metric === "composite" ? "Composite" : CAT_META[metric]?.label}</Lbl>
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.5} />
              <XAxis dataKey="period" tick={{ fontSize: 8, fill: C.dm }} />
              <YAxis tick={{ fontSize: 8, fill: C.dm }} />
              <Tooltip
                contentStyle={{ background: C.card, border: `1px solid ${C.bd}`, borderRadius: 4, fontSize: 9 }}
                formatter={(val, name) => {
                  if (name === "z") return [val.toFixed(2), "Z-Score (doc-type)"];
                  return [val, name];
                }}
              />
              <ReferenceLine y={0} stroke={C.tx} opacity={0.3} />
              <ReferenceLine y={1.5} stroke={C.r} strokeDasharray="4 4" opacity={0.4} />
              <ReferenceLine y={-1.5} stroke={C.g} strokeDasharray="4 4" opacity={0.4} />
              <ReferenceLine y={2} stroke={C.r} strokeDasharray="2 2" opacity={0.6} />
              <ReferenceLine y={-2} stroke={C.g} strokeDasharray="2 2" opacity={0.6} />
              <Bar dataKey="z" name="z" maxBarSize={20}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={zColor(d.z)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{ fontSize: 8, color: C.dm, marginTop: 6 }}>
          Z-scores computed within {DT_LABELS[docType]} history only. Dashed lines at ±1.5σ and ±2.0σ.
        </div>
      </Card>

      {/* Outlier table */}
      {outliers.length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <Lbl>Significant Outliers (|z| ≥ 1.5)</Lbl>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.bd}` }}>
                  {["Period", "Doc Type", "Z-Score", "Delta Rate", "Expansion", "Sentences +/-"].map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 8, color: C.dm, textTransform: "uppercase", letterSpacing: 0.8 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outliers.sort((a, b) => Math.abs(b[zKey]) - Math.abs(a[zKey])).map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.bd}`, background: i % 2 === 0 ? "transparent" : C.hi }}>
                    <td style={{ padding: "5px 8px", fontWeight: 700 }}>{t.period}</td>
                    <td style={{ padding: "5px 8px" }}>{DT_LABELS[t.doc_type]}</td>
                    <td style={{ padding: "5px 8px", fontWeight: 700, color: deltaColor(t[zKey]) }}>
                      {t[zKey] > 0 ? "+" : ""}{t[zKey].toFixed(2)}σ
                    </td>
                    <td style={{ padding: "5px 8px", color: deltaColor(t[deltaKey]) }}>
                      {t[deltaKey] > 0 ? "+" : ""}{t[deltaKey].toFixed(1)}
                    </td>
                    <td style={{ padding: "5px 8px" }}>{t.expansion_pct > 0 ? "+" : ""}{t.expansion_pct.toFixed(1)}%</td>
                    <td style={{ padding: "5px 8px" }}>+{t.sentences_added} / -{t.sentences_removed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>);
  };

  // ═══════════════════════════════════════════════════
  // VIEW: Section Heatmap
  // ═══════════════════════════════════════════════════
  const renderHeatmap = () => {
    const hmData = data.sectionDetail.filter(s => s.doc_type === docType);
    if (hmData.length === 0) {
      return <Card><div style={{ fontSize: 10, color: C.dm }}>No section data for {DT_LABELS[docType]}.</div></Card>;
    }

    const hmMetricField = hmMetric === "composite" ? "composite_delta"
      : `delta_${hmMetric === "constr" ? "constr" : hmMetric}`;
    const hmZField = hmMetric === "composite" ? "composite_delta"
      : `z_${hmMetric}_doctype`;

    const sections = [...new Set(hmData.map(h => h.section))];
    const periods = [...new Set(hmData.map(h => h.period))].sort();

    // Sort sections by max absolute delta
    const sectionMaxDelta = {};
    for (const s of sections) {
      const vals = hmData.filter(h => h.section === s).map(h => Math.abs(h[hmMetricField] || 0));
      sectionMaxDelta[s] = Math.max(...vals, 0);
    }
    const sortedSections = hmSort === "alpha"
      ? sections.sort()
      : sections.sort((a, b) => (sectionMaxDelta[b] || 0) - (sectionMaxDelta[a] || 0));

    // Lookup
    const lookup = {};
    for (const h of hmData) {
      lookup[`${h.section}__${h.period}`] = h;
    }

    // Get max value for color scaling
    const allVals = hmData.map(h => Math.abs(h[hmMetricField] || 0)).filter(v => v > 0);
    const maxVal = allVals.length > 0 ? Math.max(...allVals) : 1;

    // Format section name
    const fmtSection = (s) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    return (<>
      <Card style={{ marginBottom: 12, background: C.hi, border: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Section Heatmap — {tickerDisplay} {DT_LABELS[docType]}
        </div>
        <div style={{ fontSize: 10, color: C.dm, lineHeight: 1.7, maxWidth: 800 }}>
          Tone delta by section and filing period. Click a cell to view sentence-level changes.
          <b style={{ color: C.r }}> Red = more risk language added.</b>
          <b style={{ color: C.g }}> Green = risk language removed.</b>
        </div>
      </Card>

      {/* Heatmap metric + sort controls */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginRight: 4 }}>METRIC:</span>
        {["composite", "neg", "unc", "pos", "lit", "constr"].map(m => (
          <Pill key={m} label={m === "composite" ? "COMP" : CAT_META[m]?.short || m.toUpperCase()}
            active={hmMetric === m} onClick={() => setHmMetric(m)} />
        ))}
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginLeft: 12, marginRight: 4 }}>SORT:</span>
        <Pill label="By Impact" active={hmSort === "maxDelta"} onClick={() => setHmSort("maxDelta")} />
        <Pill label="A-Z" active={hmSort === "alpha"} onClick={() => setHmSort("alpha")} />
      </div>

      <Card style={{ marginBottom: 12, padding: 8, overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 8, fontFamily: "'IBM Plex Mono', monospace" }}>
          <thead>
            <tr>
              <th style={{ padding: "4px 6px", textAlign: "left", fontSize: 7, color: C.dm, position: "sticky", left: 0, background: C.card, zIndex: 1, minWidth: 140 }}>Section</th>
              {periods.map(p => (
                <th key={p} style={{ padding: "4px 3px", textAlign: "center", fontSize: 7, color: C.dm, minWidth: 42, writingMode: periods.length > 8 ? "vertical-rl" : undefined }}>
                  {formatPeriod(p)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedSections.map(sec => (
              <tr key={sec}>
                <td style={{ padding: "3px 6px", fontWeight: 600, fontSize: 7, position: "sticky", left: 0, background: C.card, zIndex: 1, borderRight: `1px solid ${C.bd}` }}>
                  {fmtSection(sec)}
                </td>
                {periods.map(p => {
                  const cell = lookup[`${sec}__${p}`];
                  const val = cell?.[hmMetricField] ?? null;
                  const isExpanded = expandedCell === `${sec}__${p}`;
                  if (val === null) {
                    return <td key={p} style={{ padding: "3px 3px", background: "#f5f5f5", textAlign: "center", border: `1px solid ${C.bd}33` }}>—</td>;
                  }
                  const intensity = Math.min(Math.abs(val) / maxVal, 1);
                  const bg = val > 0
                    ? `rgba(194,69,37,${0.08 + intensity * 0.45})`
                    : val < 0
                      ? `rgba(26,107,58,${0.08 + intensity * 0.45})`
                      : "#fafafa";
                  return (
                    <td key={p}
                      onClick={() => setExpandedCell(isExpanded ? null : `${sec}__${p}`)}
                      style={{
                        padding: "3px 3px", textAlign: "center", background: bg,
                        border: `1px solid ${C.bd}33`, cursor: "pointer",
                        fontWeight: Math.abs(val) > maxVal * 0.5 ? 700 : 400,
                        color: Math.abs(val) > maxVal * 0.3 ? "#fff" : C.tx,
                        fontSize: 7, transition: "all 0.1s",
                        outline: isExpanded ? `2px solid ${C.tx}` : "none",
                      }}
                      title={`${fmtSection(sec)} · ${p}\nDelta: ${val > 0 ? "+" : ""}${val.toFixed(1)}\nExpansion: ${cell.expansion_pct > 0 ? "+" : ""}${cell.expansion_pct?.toFixed(1)}%\nSentences: +${cell.sentences_added} / -${cell.sentences_removed}`}
                    >
                      {val > 0 ? "+" : ""}{val.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Drilldown panel */}
      {expandedCell && (() => {
        const [sec, p] = expandedCell.split("__");
        const cell = lookup[expandedCell];
        if (!cell) return null;
        const drill = data.drilldown[cell.comparison_id];
        const secDrill = drill?.sections?.[sec];
        if (!secDrill) {
          return (
            <Card style={{ marginBottom: 12, borderLeft: `3px solid ${C.w}` }}>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{fmtSection(sec)} — {p}</div>
              <div style={{ fontSize: 9, color: C.dm, marginTop: 4 }}>No sentence-level drilldown available for this cell.</div>
            </Card>
          );
        }
        return (
          <Card style={{ marginBottom: 12, borderLeft: `3px solid ${C.acc}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{fmtSection(sec)} — {p}</div>
                <div style={{ fontSize: 8, color: C.dm }}>
                  Expansion: {cell.expansion_pct > 0 ? "+" : ""}{cell.expansion_pct?.toFixed(1)}% · Sentences: +{cell.sentences_added} / -{cell.sentences_removed}
                </div>
              </div>
              <button onClick={() => setExpandedCell(null)} style={{ background: "none", border: `1px solid ${C.bd}`, borderRadius: 3, padding: "3px 8px", fontSize: 8, cursor: "pointer", color: C.dm }}>✕ Close</button>
            </div>
            {secDrill.added?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.r, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Added ({secDrill.added.length})</div>
                {secDrill.added.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ fontSize: 8, color: C.tx, padding: "3px 6px", marginBottom: 2, background: "#fde8e344", borderRadius: 2, lineHeight: 1.5, borderLeft: `2px solid ${C.r}44` }}>
                    {typeof s === "string" ? s.slice(0, 200) : s.sentence?.slice(0, 200)}
                    {(typeof s === "string" ? s : s.sentence)?.length > 200 ? "…" : ""}
                  </div>
                ))}
                {secDrill.added.length > 5 && <div style={{ fontSize: 7, color: C.dm, marginTop: 2 }}>+{secDrill.added.length - 5} more</div>}
              </div>
            )}
            {secDrill.removed?.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 8, fontWeight: 700, color: C.g, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>Removed ({secDrill.removed.length})</div>
                {secDrill.removed.slice(0, 5).map((s, i) => (
                  <div key={i} style={{ fontSize: 8, color: C.tx, padding: "3px 6px", marginBottom: 2, background: "#dff0df44", borderRadius: 2, lineHeight: 1.5, borderLeft: `2px solid ${C.g}44` }}>
                    {typeof s === "string" ? s.slice(0, 200) : s.sentence?.slice(0, 200)}
                    {(typeof s === "string" ? s : s.sentence)?.length > 200 ? "…" : ""}
                  </div>
                ))}
                {secDrill.removed.length > 5 && <div style={{ fontSize: 7, color: C.dm, marginTop: 2 }}>+{secDrill.removed.length - 5} more</div>}
              </div>
            )}
          </Card>
        );
      })()}
    </>);
  };

  // ═══════════════════════════════════════════════════
  // VIEW: Alerts & Rankings
  // ═══════════════════════════════════════════════════
  const renderAlerts = () => {
    const highAlerts = data.alerts
      .filter(a => a.doc_type === docType && Math.abs(a.z) >= 1.5)
      .sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

    const fmtSection = (s) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

    return (<>
      <Card style={{ marginBottom: 12, background: C.hi, border: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          Alerts & Rankings — {tickerDisplay} {DT_LABELS[docType]}
        </div>
        <div style={{ fontSize: 10, color: C.dm, lineHeight: 1.7 }}>
          Section-level alerts where tone shifted ≥1.5σ from historical norms, plus all-time extremes across the full filing corpus.
        </div>
      </Card>

      {/* Alerts table */}
      <Card style={{ marginBottom: 12 }}>
        <Lbl>Significant Section Alerts ({highAlerts.length})</Lbl>
        {highAlerts.length === 0 ? (
          <div style={{ fontSize: 10, color: C.dm, textAlign: "center", padding: 20 }}>No significant alerts for {DT_LABELS[docType]} filings.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9, fontFamily: "'IBM Plex Mono', monospace" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.bd}` }}>
                  {["Period", "Section", "Category", "Z-Score", "Delta", "Direction", "Sentences"].map(h => (
                    <th key={h} style={{ padding: "6px 8px", textAlign: "left", fontSize: 8, color: C.dm, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {highAlerts.slice(0, 20).map((a, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.bd}`, background: i % 2 === 0 ? "transparent" : C.hi }}>
                    <td style={{ padding: "5px 8px", fontWeight: 700 }}>{a.period}</td>
                    <td style={{ padding: "5px 8px" }}>{fmtSection(a.section)}</td>
                    <td style={{ padding: "5px 8px" }}>{a.category}</td>
                    <td style={{ padding: "5px 8px", fontWeight: 700, color: deltaColor(a.z) }}>{a.z > 0 ? "+" : ""}{a.z.toFixed(2)}σ</td>
                    <td style={{ padding: "5px 8px", color: deltaColor(a.delta_rate) }}>{a.delta_rate > 0 ? "+" : ""}{a.delta_rate.toFixed(1)}</td>
                    <td style={{ padding: "5px 8px" }}>{a.direction}</td>
                    <td style={{ padding: "5px 8px" }}>+{a.sa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* All-time rankings */}
      {Object.keys(data.rankings).length > 0 && (
        <Card style={{ marginBottom: 12 }}>
          <Lbl>All-Time Extremes (Full Corpus)</Lbl>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {["neg", "unc", "pos", "lit", "constr"].map(cat => {
              const rk = data.rankings[cat];
              if (!rk) return null;
              return (
                <div key={cat} style={{ borderLeft: `3px solid ${CAT_META[cat].color}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: CAT_META[cat].color, marginBottom: 4 }}>{CAT_META[cat].label}</div>
                  {rk.top_increases?.slice(0, 2).map((r, i) => (
                    <div key={`inc_${i}`} style={{ fontSize: 8, color: C.tx, marginBottom: 2 }}>
                      <span style={{ color: C.r }}>▲ +{r.delta_rate.toFixed(0)}</span> {DT_LABELS[r.doc_type]} {r.period} (z={r.z?.toFixed(1)})
                    </div>
                  ))}
                  {rk.top_decreases?.slice(0, 2).map((r, i) => (
                    <div key={`dec_${i}`} style={{ fontSize: 8, color: C.tx, marginBottom: 2 }}>
                      <span style={{ color: C.g }}>▼ {r.delta_rate.toFixed(0)}</span> {DT_LABELS[r.doc_type]} {r.period} (z={r.z?.toFixed(1)})
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </>);
  };

  // ═══════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════
  const VIEWS = [
    { key: "priceTone", label: "Price × Tone" },
    { key: "levels", label: "Tone Levels" },
    { key: "deltas", label: "Z-Scores" },
    { key: "heatmap", label: "Section Heatmap" },
    { key: "alerts", label: "Alerts" },
  ];

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: 12, background: C.hi, border: "none" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
          SEDAR+ Filing Sentiment — {tickerDisplay} Disclosure Language Analysis
        </div>
        <div style={{ fontSize: 10, color: C.dm, lineHeight: 1.7, maxWidth: 800 }}>
          NLP-based comparison of consecutive SEDAR+ filings across {data.meta.total_comparisons || data.timeline.length} filing pairs
          and {data.meta.doc_types?.length || 7} document types.
          Measures changes in uncertainty, negative, litigious, constraining, and positive language.
          Z-scores computed <b>within each doc type</b> to normalize for structural differences between annual and interim reports.
        </div>
      </Card>

      {/* Controls row */}
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginRight: 2 }}>DOC TYPE:</span>
        {availDocTypes.map(dt => (
          <Pill key={dt} label={DT_LABELS[dt]?.replace("Interim ", "Int. ").replace("Annual ", "Ann. ").replace("Material Change", "MCR").replace("News Release", "News") || dt}
            active={docType === dt} onClick={() => setDocType(dt)} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginRight: 2 }}>METRIC:</span>
        <Pill label="COMP" active={metric === "composite"} onClick={() => setMetric("composite")} />
        {["neg", "unc", "pos", "lit", "constr"].map(m => (
          <Pill key={m} label={CAT_META[m].short} active={metric === m} onClick={() => setMetric(m)}
            color={metric === m ? CAT_META[m].color : undefined} />
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginRight: 2 }}>VIEW:</span>
        {VIEWS.map(v => (
          <Pill key={v.key} label={v.label} active={view === v.key} onClick={() => setView(v.key)} />
        ))}
        {view === "priceTone" && (<>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.dm, marginLeft: 12, marginRight: 2 }}>MODE:</span>
          <Pill label="Delta" active={toneMode === "delta"} onClick={() => setToneMode("delta")} />
          <Pill label="Level" active={toneMode === "level"} onClick={() => setToneMode("level")} />
        </>)}
      </div>

      {/* View content */}
      {view === "priceTone" && renderPriceTone()}
      {view === "levels" && renderToneLevels()}
      {view === "deltas" && renderToneDeltas()}
      {view === "heatmap" && renderHeatmap()}
      {view === "alerts" && renderAlerts()}
    </div>
  );
}
