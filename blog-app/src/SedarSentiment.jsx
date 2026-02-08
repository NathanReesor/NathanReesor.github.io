import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  BarChart,
  ScatterChart,
  Scatter,
} from "recharts";

/* ═══ DESIGN TOKENS ═══ */
const C = { bg:"#f8f7f4", card:"#fff", bd:"#e4dfd7", tx:"#2a2623", dm:"#8a847a", g:"#1a6b3a", r:"#c24525", w:"#a87d1a", bl:"#1a4f7a", hi:"#f0ebe3", acc:"#d4583b" };

const CAT_META = {
  neg:    { label:"Negative",     color:"#c24525", short:"NEG",  risk:"up" },
  pos:    { label:"Positive",     color:"#1a6b3a", short:"POS",  risk:"down" },
  unc:    { label:"Uncertainty",  color:"#a87d1a", short:"UNC",  risk:"up" },
  lit:    { label:"Litigious",    color:"#1a4f7a", short:"LIT",  risk:"up" },
  constr: { label:"Constraining", color:"#7c5cbf", short:"CON",  risk:"up" },
};
const CATS = ["neg","pos","unc","lit","constr"];
const MIN_WORDS = 500;

const DT_LABELS = { interim_mda:"Interim MD&A", annual_mda:"Annual MD&A", interim_fs:"Interim FS", annual_fs:"Annual FS", aif:"AIF", mcr:"Material Change", news_release:"News Release" };

const DOC_GROUPS = {
  mda:  { label:"MD&A",       types:["interim_mda","annual_mda"] },
  fs:   { label:"Fin. Stmts", types:["interim_fs","annual_fs"] },
  periodic: { label:"All Periodic", types:["interim_mda","annual_mda","interim_fs","annual_fs","aif"] },
  news: { label:"News/MCR",   types:["news_release","mcr"] },
};

const EVENT_WEIGHTS = { neg:0.4, unc:0.25, lit:0.15, constr:0.1, pos:-0.1 };

/* ═══ SHARED UI ═══ */
const Card = ({ children, style }) => <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:4, padding:16, ...style }}>{children}</div>;
const Lbl = ({ children }) => <div style={{ fontSize:10, fontWeight:800, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:1.2, marginBottom:10, textTransform:"uppercase" }}>{children}</div>;
const StatBox = ({ l, v, sub, c }) => (
  <div style={{ background:C.hi, borderRadius:4, padding:"8px 10px", flex:1, minWidth:100 }}>
    <div style={{ fontSize:7, fontFamily:"'IBM Plex Mono', monospace", color:C.dm, letterSpacing:1, textTransform:"uppercase" }}>{l}</div>
    <div style={{ fontSize:17, fontWeight:800, color:c||C.tx, marginTop:2 }}>{v}</div>
    {sub && <div style={{ fontSize:8, color:C.dm, marginTop:1 }}>{sub}</div>}
  </div>
);
const Pill = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{ padding:"4px 10px", fontSize:9, fontWeight:700, fontFamily:"'IBM Plex Mono', monospace",
    background:active?(color||C.tx):"transparent", color:active?"#fff":C.dm,
    border:`1px solid ${active?(color||C.tx):C.bd}`, borderRadius:3, cursor:"pointer" }}>{label}</button>
);

/* ═══ RISK-AWARE COLORING ═══ */
function riskColor(value, metric) {
  if (value === 0) return C.dm;
  if (metric === "composite" || !metric) return value > 0 ? C.r : C.g;
  return CAT_META[metric]?.risk === "up" ? (value > 0 ? C.r : C.g) : (value > 0 ? C.g : C.r);
}
function zBg(z, metric, intensity) {
  const abs = Math.abs(z);
  const alpha = (abs < 1 ? 0.15 : abs < 1.5 ? 0.3 : abs < 2 ? 0.5 : 0.7) * (intensity || 1);
  const col = riskColor(z, metric);
  const r = parseInt(col.slice(1,3),16), g = parseInt(col.slice(3,5),16), b = parseInt(col.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ═══ DATA TRANSFORM ═══ */
function transformSedar(raw) {
  if (!raw) return null;
  const newsTypes = DOC_GROUPS.news.types;
  const timeline = (raw.timeline || []).map(t => {
    const d = t.delta || {}, l = t.level || {};
    const isNews = newsTypes.includes(t.doc_type);
    const row = { id:t.comparison_id, doc_type:t.doc_type, period:t.period,
      curr_words:t.curr_words, prev_words:t.prev_words, expansion_pct:t.expansion_pct??0,
      sentences_added:t.sentences_added??0, sentences_removed:t.sentences_removed??0,
      composite_delta:t.composite_delta??0, z_composite:t.z_composite_delta??0,
      reliable: isNews ? (t.curr_words||0) >= MIN_WORDS : Math.min(t.curr_words||0, t.prev_words||0) >= MIN_WORDS };
    for (const c of CATS) {
      row[`d_${c}`]=d[c]?.rate??0; row[`z_${c}`]=d[c]?.z??0;
      row[`l_${c}`]=l[c]?.curr_rate??0; row[`lp_${c}`]=l[c]?.prev_rate??0;
    }
    return row;
  });

  // Doc-type z (delta based)
  const byDocType = {};
  for (const t of timeline) { (byDocType[t.doc_type]??=[]).push(t); }
  for (const rows of Object.values(byDocType)) {
    for (const c of CATS) { const v=rows.map(r=>r[`d_${c}`]); const m=v.reduce((s,x)=>s+x,0)/v.length; const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length); for (const r of rows) r[`zdt_${c}`]=sd>0?(r[`d_${c}`]-m)/sd:0; }
    const v=rows.map(r=>r.composite_delta); const m=v.reduce((s,x)=>s+x,0)/v.length; const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length); for (const r of rows) r.zdt_composite=sd>0?(r.composite_delta-m)/sd:0;
  }
  // Group z (delta based)
  for (const { types } of Object.values(DOC_GROUPS)) {
    const rows = timeline.filter(t => types.includes(t.doc_type)); if (rows.length < 3) continue;
    for (const c of CATS) { const v=rows.map(r=>r[`d_${c}`]); const m=v.reduce((s,x)=>s+x,0)/v.length; const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length); for (const r of rows) r[`zgrp_${c}`]=sd>0?(r[`d_${c}`]-m)/sd:0; }
    const v=rows.map(r=>r.composite_delta); const m=v.reduce((s,x)=>s+x,0)/v.length; const sd=Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length); for (const r of rows) r.zgrp_composite=sd>0?(r.composite_delta-m)/sd:0;
  }

  // Event z-scores (absolute level) for news/MCR
  const newsRows = timeline.filter(t => newsTypes.includes(t.doc_type));
  if (newsRows.length >= 3) {
    for (const c of CATS) {
      const v = newsRows.map(r=>r[`l_${c}`]);
      const m = v.reduce((s,x)=>s+x,0)/v.length;
      const sd = Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/v.length);
      for (const r of newsRows) r[`zev_${c}`]=sd>0?(r[`l_${c}`]-m)/sd:0;
    }
    for (const r of newsRows) {
      r.zev_composite = CATS.reduce((s,c)=>s + (EVENT_WEIGHTS[c]||0) * (r[`zev_${c}`]||0), 0);
    }
  } else {
    for (const r of newsRows) {
      for (const c of CATS) r[`zev_${c}`]=0;
      r.zev_composite = 0;
    }
  }

  const alerts = (raw.alerts||[]).map(a => ({ doc_type:a.doc_type, section:a.section, category:a.category_label||a.category, delta_rate:a.delta_rate, period:a.period, z:a.z_score, severity:a.severity, direction:a.direction, sa:a.sentences_added??0, comparison_id:a.comparison_id }));
  const heatmap = []; for (const [dt,cells] of Object.entries(raw.heatmap||{})) for (const cell of cells) heatmap.push({ doc_type:dt, ...cell });

  return { timeline, alerts, heatmap, sectionDetail:raw.section_detail||[], categorySeries:raw.category_series||{},
    rankings:raw.rankings||{}, summaryStats:raw.summary_stats||{}, drilldown:raw.drilldown||{},
    drivers:raw.drivers||{}, meta:raw.meta||{}, byDocType };
}

/* ═══ UTILITIES ═══ */
function fmtTick(d) { return d?.length>=7 ? d.slice(2,7).replace("-","'") : d; }
function fmtSection(s) { return s.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase()); }
function fmtNum(v,d) { return v==null?"—":v.toFixed(d??1); }
function closestPrice(prices, date) {
  if (!prices?.length) return null;
  return prices.reduce((best,p) => Math.abs(new Date(p.d)-date) < Math.abs(new Date(best.d)-date) ? p : best, prices[0]);
}
function pearson(x, y) {
  if (!x?.length || x.length !== y.length || x.length < 2) return null;
  const n = x.length;
  const meanX = x.reduce((s,v)=>s+v,0)/n;
  const meanY = y.reduce((s,v)=>s+v,0)/n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i=0;i<n;i+=1) {
    const vx = x[i]-meanX;
    const vy = y[i]-meanY;
    num += vx*vy;
    dx += vx*vx;
    dy += vy*vy;
  }
  const den = Math.sqrt(dx*dy);
  return den === 0 ? null : num/den;
}

/* ═══ RICH TOOLTIP ═══ */
function ResearchTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload; if (!d) return null;
  const Row = ({l,v,c}) => <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:1}}><span style={{color:C.dm}}>{l}</span><span style={{fontWeight:600,color:c||C.tx}}>{v}</span></div>;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:4, padding:10, fontSize:9, minWidth:200, maxWidth:280, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:800, marginBottom:4 }}>{d.fullPeriod}{d.isAnnual?" ★ Annual":""}</div>
      {d.docLabel && <div style={{ color:C.dm, marginBottom:4 }}>{d.docLabel}</div>}
      {d.delta!=null && <Row l="Tone Δ" v={`${d.delta>0?"+":""}${fmtNum(d.delta)} /10K`} c={riskColor(d.delta,metric)} />}
      {d.z!=null && <Row l="Z-score" v={`${d.z>0?"+":""}${fmtNum(d.z,2)}σ`} c={riskColor(d.z,metric)} />}
      {d.price!=null && <Row l="Price" v={`C$${fmtNum(d.price,2)}`} c={C.bl} />}
      {d.currWords!=null && <Row l="Words" v={`${d.currWords.toLocaleString()} (prev: ${(d.prevWords||0).toLocaleString()})`} />}
      {d.exp!=null && <Row l="Expansion" v={`${d.exp>0?"+":""}${fmtNum(d.exp)}%`} />}
      {d.sa!=null && <Row l="Sentences" v={`+${d.sa} / −${d.sr??0}`} />}
      {d.reliable===false && <div style={{color:C.w,marginTop:3,fontSize:8}}>⚠ &lt;{MIN_WORDS} words — low reliability</div>}
    </div>
  );
}

function EventTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload; if (!d) return null;
  const Row = ({l,v,c}) => <div style={{display:"flex",justifyContent:"space-between",gap:12,marginBottom:1}}><span style={{color:C.dm}}>{l}</span><span style={{fontWeight:600,color:c||C.tx}}>{v}</span></div>;
  return (
    <div style={{ background:C.card, border:`1px solid ${C.bd}`, borderRadius:4, padding:10, fontSize:9, minWidth:200, maxWidth:280, boxShadow:"0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight:800, marginBottom:4 }}>{d.fullPeriod}</div>
      {d.docLabel && <div style={{ color:C.dm, marginBottom:4 }}>{d.docLabel}</div>}
      <Row l="Event Z" v={`${d.z>0?"+":""}${fmtNum(d.z,2)}σ`} c={riskColor(d.z,metric)} />
      {d.price!=null && <Row l="Price" v={`C$${fmtNum(d.price,2)}`} c={C.bl} />}
      {d.currWords!=null && <Row l="Words" v={`${d.currWords.toLocaleString()}`} />}
      {d.reliable===false && <div style={{color:C.w,marginTop:3,fontSize:8}}>⚠ &lt;{MIN_WORDS} words — low reliability</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
export default function SedarSentiment({ rawJson, priceData, ticker, tickerDisplay }) {
  const [docGroup, setDocGroup] = useState("mda");
  const [metric, setMetric] = useState("composite");
  const [view, setView] = useState("priceTone");
  const [toneMode, setToneMode] = useState("delta");
  const [hmMetric, setHmMetric] = useState("composite");
  const [hmSort, setHmSort] = useState("maxDelta");
  const [expandedCell, setExpandedCell] = useState(null);
  const [eventSort, setEventSort] = useState({ col:"period", asc:false });

  const data = useMemo(() => transformSedar(rawJson), [rawJson]);
  if (!data || data.timeline.length === 0) return <Card style={{textAlign:"center",padding:40}}><div style={{fontSize:13,fontWeight:700}}>No SEDAR+ sentiment data for {tickerDisplay}.</div></Card>;

  const availGroups = Object.entries(DOC_GROUPS).filter(([,{types}]) => types.some(dt => data.byDocType[dt]?.length>0)).map(([k])=>k);
  const effGroup = availGroups.includes(docGroup) ? docGroup : availGroups[0]||"mda";
  const groupTypes = DOC_GROUPS[effGroup].types;
  const filtered = data.timeline.filter(t => groupTypes.includes(t.doc_type)).sort((a,b) => a.period.localeCompare(b.period));
  const metricCat = metric==="composite" ? null : metric;
  const isNews = effGroup === "news";
  const isPeriodic = ["mda","fs","periodic"].includes(effGroup);
  const deltaKey = metricCat ? `d_${metricCat}` : "composite_delta";
  const zKey = isNews ? (metricCat ? `zev_${metricCat}` : "zev_composite") : (metricCat ? `zgrp_${metricCat}` : "zgrp_composite");
  const reliableF = filtered.filter(t => t.reliable);
  const outliers = reliableF.filter(t => Math.abs(t[zKey])>=1.5);
  const latestSpike = outliers.length ? outliers.reduce((a,b)=>a.period>b.period?a:b) : null;
  const maxInc = reliableF.length ? reliableF.reduce((a,b)=>b[zKey]>a[zKey]?b:a) : null;
  const maxDec = reliableF.length ? reliableF.reduce((a,b)=>b[zKey]<a[zKey]?b:a) : null;

  const viewOptions = isNews ? [
    { key:"eventAnalysis", label:"Event Analysis" },
    { key:"toneLevels", label:"Tone Levels" },
  ] : [
    { key:"priceTone", label:"Price × Tone" },
    { key:"filingAnalysis", label:"Filing Analysis" },
    { key:"sectionDrilldown", label:"Section Drilldown" },
    ...(isPeriodic ? [{ key:"signalBacktest", label:"Signal Backtest" }] : []),
  ];
  const effView = viewOptions.some(v => v.key === view) ? view : viewOptions[0].key;

  // ═══ PRICE × TONE ═══
  const renderPriceTone = (forcedMode) => {
    const prices = priceData || [];
    const mode = forcedMode || toneMode;
    if (mode === "delta") {
      const tonePoints = filtered.map(t => {
        const td = new Date(t.period);
        const near = prices.length ? prices.reduce((best,p) => Math.abs(new Date(p.d)-td)<Math.abs(new Date(best.d)-td)?p:best, prices[0]) : null;
        return { fullPeriod:t.period, delta:+t[deltaKey].toFixed(1), z:+t[zKey].toFixed(2),
          price:near?.c??null, docLabel:DT_LABELS[t.doc_type], isAnnual:t.doc_type.startsWith("annual"),
          currWords:t.curr_words, prevWords:t.prev_words, exp:t.expansion_pct,
          sa:t.sentences_added, sr:t.sentences_removed, reliable:t.reliable };
      });
      const dateRange = filtered.length>=2 ? [filtered[0].period, filtered[filtered.length-1].period] : null;
      const priceLine = dateRange ? prices.filter(p=>p.d>=dateRange[0]&&p.d<=dateRange[1]).filter((_,i)=>i%4===0).map(p=>({fullPeriod:p.d,price:p.c})) : [];
      const byDate = {};
      for (const p of [...tonePoints,...priceLine]) { if (!byDate[p.fullPeriod]) byDate[p.fullPeriod]={fullPeriod:p.fullPeriod}; Object.assign(byDate[p.fullPeriod],p); }
      const combined = Object.values(byDate).sort((a,b)=>a.fullPeriod.localeCompare(b.fullPeriod));
      const mxD = Math.max(...combined.filter(d=>d.delta!=null).map(d=>Math.abs(d.delta)),1);
      const pMin = prices.length ? Math.round(Math.min(...prices.map(p=>p.c))*0.9*100)/100 : 0;
      const pMax = prices.length ? Math.round(Math.max(...prices.map(p=>p.c))*1.1*100)/100 : 10;

      return (
        <Card style={{marginBottom:12}}>
          <Lbl>{tickerDisplay} Price × Tone — {metric==="composite"?"Composite":CAT_META[metric]?.label} Delta</Lbl>
          <div style={{width:"100%",height:320}}>
            <ResponsiveContainer>
              <ComposedChart data={combined} margin={{top:10,right:50,left:10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.4} />
                <XAxis dataKey="fullPeriod" tickFormatter={fmtTick} tick={{fontSize:8,fill:C.dm}} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{fontSize:8,fill:C.dm}} domain={[-mxD*1.3,mxD*1.3]} label={{value:"Δ hits/10K",angle:-90,position:"insideLeft",style:{fontSize:8,fill:C.dm}}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:8,fill:C.bl}} domain={[pMin,pMax]} tickFormatter={v=>v.toFixed(2)} label={{value:"C$",angle:90,position:"insideRight",style:{fontSize:8,fill:C.bl}}} />
                <Tooltip content={<ResearchTooltip metric={metricCat} />} />
                <ReferenceLine yAxisId="left" y={0} stroke={C.tx} strokeDasharray="4 4" opacity={0.3} />
                <Bar yAxisId="left" dataKey="delta" maxBarSize={16}>
                  {combined.map((d,i) => <Cell key={i} fill={d.delta!=null?riskColor(d.delta,metricCat)+"88":"transparent"} stroke={d.isAnnual?C.tx:"none"} strokeWidth={d.isAnnual?1.5:0} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="price" stroke={C.bl} strokeWidth={2} dot={{r:2,fill:C.bl}} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{fontSize:8,color:C.dm,marginTop:6}}>
            Tone deltas (bars) at period-end date vs {tickerDisplay} weekly close (line). Bordered bars = annual filings.
            {metricCat && CAT_META[metricCat]?.risk==="down" && <span style={{color:C.g}}> For {CAT_META[metricCat].label}: green (↑) = more positive language = favorable.</span>}
          </div>
        </Card>
      );
    }

    // LEVEL mode
    const levelCats = metricCat ? [metricCat] : ["neg","unc","lit","constr","pos"];
    const chartData = filtered.map(t => {
      const row = { fullPeriod:t.period, isAnnual:t.doc_type.startsWith("annual"), docLabel:DT_LABELS[t.doc_type] };
      for (const cat of levelCats) row[cat] = +t[`l_${cat}`].toFixed(1);
      const td = new Date(t.period);
      const near = priceData?.length ? priceData.reduce((best,p) => Math.abs(new Date(p.d)-td)<Math.abs(new Date(best.d)-td)?p:best, priceData[0]) : null;
      if (near) row.price = near.c;
      return row;
    });
    const pRange = priceData?.length ? [Math.round(Math.min(...priceData.map(p=>p.c))*0.9*100)/100, Math.round(Math.max(...priceData.map(p=>p.c))*1.1*100)/100] : [0,10];

    return (
      <Card style={{marginBottom:12}}>
        <Lbl>{tickerDisplay} Tone Level vs Price — {DOC_GROUPS[effGroup].label}</Lbl>
        <div style={{width:"100%",height:340}}>
          <ResponsiveContainer>
            <ComposedChart data={chartData} margin={{top:10,right:50,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.4} />
              <XAxis dataKey="fullPeriod" tickFormatter={fmtTick} tick={{fontSize:8,fill:C.dm}} />
              <YAxis yAxisId="left" tick={{fontSize:8,fill:C.dm}} label={{value:"hits / 10K words",angle:-90,position:"insideLeft",style:{fontSize:8,fill:C.dm}}} />
              <YAxis yAxisId="right" orientation="right" tick={{fontSize:8,fill:C.bl}} domain={pRange} tickFormatter={v=>v.toFixed(2)} label={{value:"C$",angle:90,position:"insideRight",style:{fontSize:8,fill:C.bl}}} />
              <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.bd}`,borderRadius:4,fontSize:9}} formatter={(val,name)=>name==="price"?[`C$${fmtNum(val,2)}`,"Price"]:[`${fmtNum(val)} /10K`,CAT_META[name]?.label||name]} labelFormatter={fmtTick} />
              {levelCats.map(cat => <Line key={cat} yAxisId="left" type="monotone" dataKey={cat} stroke={CAT_META[cat].color} strokeWidth={2}
                dot={props => { const {cx,cy,payload}=props; return payload?.isAnnual ? <rect x={cx-3} y={cy-3} width={6} height={6} fill={CAT_META[cat].color} stroke={C.tx} strokeWidth={1} /> : <circle cx={cx} cy={cy} r={3} fill={CAT_META[cat].color} strokeWidth={0} />; }}
                name={cat} />)}
              <Line yAxisId="right" type="monotone" dataKey="price" stroke={C.bl} strokeWidth={2} strokeDasharray="6 3" dot={false} name="price" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
          {levelCats.map(cat => <div key={cat} style={{display:"flex",alignItems:"center",gap:4,fontSize:8,color:C.dm}}><div style={{width:10,height:3,background:CAT_META[cat].color,borderRadius:1}} />{CAT_META[cat].label}</div>)}
          <div style={{display:"flex",alignItems:"center",gap:4,fontSize:8,color:C.dm}}><div style={{width:10,height:0,borderTop:`2px dashed ${C.bl}`}} />Price</div>
        </div>
        <div style={{fontSize:8,color:C.dm,marginTop:4}}>Absolute tone density (hits / 10K words). ■ = annual, ● = interim. Dashed = {tickerDisplay} weekly close.</div>
      </Card>
    );
  };

  // ═══ FILING ANALYSIS (Z-Scores + Event Table + Alerts) ═══
  const renderFilingAnalysis = () => {
    const chartData = filtered.map(t => ({
      fullPeriod:t.period, z:+t[zKey].toFixed(2), delta:+t[deltaKey].toFixed(1),
      docLabel:DT_LABELS[t.doc_type], isAnnual:t.doc_type.startsWith("annual"),
      currWords:t.curr_words, prevWords:t.prev_words, exp:t.expansion_pct,
      sa:t.sentences_added, sr:t.sentences_removed, reliable:t.reliable,
    }));

    const events = filtered.map(t => ({ ...t, docLabel:DT_LABELS[t.doc_type], zVal:t[zKey], deltaVal:t[deltaKey] }));
    const sortedEv = [...events].sort((a,b) => {
      const av = eventSort.col==="period"?a.period : eventSort.col==="z"?Math.abs(a.zVal) : eventSort.col==="delta"?Math.abs(a.deltaVal) : a.expansion_pct;
      const bv = eventSort.col==="period"?b.period : eventSort.col==="z"?Math.abs(b.zVal) : eventSort.col==="delta"?Math.abs(b.deltaVal) : b.expansion_pct;
      return eventSort.asc ? (av>bv?1:-1) : (av<bv?1:-1);
    });

    const groupAlerts = data.alerts.filter(a => groupTypes.includes(a.doc_type) && Math.abs(a.z)>=2.0).sort((a,b) => Math.abs(b.z)-Math.abs(a.z));

    return (<>
      <Card style={{marginBottom:12,background:C.hi,border:"none"}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Filing Analysis — {tickerDisplay} {DOC_GROUPS[effGroup].label}</div>
        <div style={{fontSize:10,color:C.dm,lineHeight:1.7,maxWidth:800}}>
          Change in tone between consecutive filings. Z-scores within {DOC_GROUPS[effGroup].label} group.
          <b style={{color:C.r}}> Red = risk language increased.</b> <b style={{color:C.g}}> Green = risk decreased.</b>
          {metric==="pos" && <span style={{color:C.g}}> (For Positive: green = more positive language = favorable.)</span>}
        </div>
      </Card>

      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <StatBox l="Filings" v={filtered.length} sub={`${DOC_GROUPS[effGroup].label} (${groupTypes.map(dt=>data.byDocType[dt]?.length||0).join("+")})`} />
        <StatBox l="Outliers |z|≥1.5" v={outliers.length} sub={`of ${reliableF.length} reliable`} c={outliers.length?C.w:C.dm} />
        <StatBox l="Latest Spike" v={latestSpike?`z=${latestSpike[zKey]>0?"+":""}${latestSpike[zKey].toFixed(1)}`:"—"} sub={latestSpike?`${DT_LABELS[latestSpike.doc_type]} ${latestSpike.period}`:"none"} c={latestSpike?riskColor(latestSpike[zKey],metricCat):C.dm} />
        <StatBox l="Max ↑ Risk" v={maxInc?`z=${maxInc[zKey]>0?"+":""}${maxInc[zKey].toFixed(1)}`:"—"} c={C.r} />
        <StatBox l="Max ↓ Risk" v={maxDec?`z=${maxDec[zKey].toFixed(1)}`:"—"} c={C.g} />
      </div>

      <Card style={{marginBottom:12}}>
        <Lbl>Z-Score Timeline — {metric==="composite"?"Composite":CAT_META[metric]?.label}</Lbl>
        <div style={{width:"100%",height:280}}>
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{top:10,right:20,left:10,bottom:5}}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.4} />
              <XAxis dataKey="fullPeriod" tickFormatter={fmtTick} tick={{fontSize:8,fill:C.dm}} />
              <YAxis tick={{fontSize:8,fill:C.dm}} />
              <Tooltip content={<ResearchTooltip metric={metricCat} />} />
              <ReferenceLine y={0} stroke={C.tx} opacity={0.3} />
              <ReferenceLine y={1.5} stroke={C.r} strokeDasharray="4 4" opacity={0.3} />
              <ReferenceLine y={-1.5} stroke={C.g} strokeDasharray="4 4" opacity={0.3} />
              <Bar dataKey="z" maxBarSize={18}>
                {chartData.map((d,i) => <Cell key={i} fill={d.reliable?zBg(d.z,metricCat,1.5):`${C.dm}44`} stroke={d.isAnnual?C.tx:"none"} strokeWidth={d.isAnnual?1.5:0} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{fontSize:8,color:C.dm,marginTop:4}}>Group z-scores. Bordered = annual. Faded = &lt;{MIN_WORDS} words.</div>
      </Card>

      {/* Event Table */}
      <Card style={{marginBottom:12}}>
        <Lbl>Filing Event Table</Lbl>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:"'IBM Plex Mono', monospace"}}>
            <thead><tr style={{borderBottom:`2px solid ${C.bd}`}}>
              {[{k:"period",l:"Period"},{k:null,l:"Type"},{k:"z",l:"Z-Score"},{k:"delta",l:"Δ Rate"},{k:"exp",l:"Expansion"},{k:null,l:"Words"},{k:null,l:"Sent +/−"}].map(h =>
                <th key={h.l} onClick={()=>h.k&&setEventSort(p=>({col:h.k,asc:p.col===h.k?!p.asc:false}))} style={{padding:"6px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase",cursor:h.k?"pointer":"default",background:eventSort.col===h.k?C.hi:"transparent"}}>
                  {h.l} {eventSort.col===h.k?(eventSort.asc?"↑":"↓"):""}
                </th>
              )}
            </tr></thead>
            <tbody>
              {sortedEv.map((t,i) =>
                <tr key={t.id||i} style={{borderBottom:`1px solid ${C.bd}`,background:Math.abs(t.zVal)>=1.5?zBg(t.zVal,metricCat,0.3):i%2===0?"transparent":C.hi,opacity:t.reliable?1:0.5}}>
                  <td style={{padding:"5px 6px",fontWeight:700}}>{t.period}</td>
                  <td style={{padding:"5px 6px"}}>{DT_LABELS[t.doc_type]?.replace("Interim ","").replace("Annual ","Ann. ")}{t.doc_type.startsWith("annual")?" ★":""}</td>
                  <td style={{padding:"5px 6px",fontWeight:700,color:riskColor(t.zVal,metricCat)}}>{t.zVal>0?"+":""}{t.zVal.toFixed(2)}σ</td>
                  <td style={{padding:"5px 6px",color:riskColor(t.deltaVal,metricCat)}}>{t.deltaVal>0?"+":""}{t.deltaVal.toFixed(1)}</td>
                  <td style={{padding:"5px 6px"}}>{t.expansion_pct>0?"+":""}{t.expansion_pct.toFixed(1)}%</td>
                  <td style={{padding:"5px 6px",color:C.dm}}>{t.curr_words.toLocaleString()}</td>
                  <td style={{padding:"5px 6px",color:C.dm}}>+{t.sentences_added} / −{t.sentences_removed}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Section alerts */}
      {groupAlerts.length>0 && (
        <Card style={{marginBottom:12}}>
          <Lbl>Section Alerts (|z| ≥ 2.0) — {groupAlerts.length} flagged</Lbl>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:"'IBM Plex Mono', monospace"}}>
              <thead><tr style={{borderBottom:`2px solid ${C.bd}`}}>
                {["Period","Section","Category","Z","Δ Rate","Dir"].map(h => <th key={h} style={{padding:"5px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase"}}>{h}</th>)}
              </tr></thead>
              <tbody>{groupAlerts.slice(0,15).map((a,i) =>
                <tr key={i} style={{borderBottom:`1px solid ${C.bd}`,background:i%2===0?"transparent":C.hi}}>
                  <td style={{padding:"4px 6px",fontWeight:700}}>{a.period}</td>
                  <td style={{padding:"4px 6px"}}>{fmtSection(a.section)}</td>
                  <td style={{padding:"4px 6px"}}>{a.category}</td>
                  <td style={{padding:"4px 6px",fontWeight:700,color:riskColor(a.z,null)}}>{a.z>0?"+":""}{a.z.toFixed(1)}σ</td>
                  <td style={{padding:"4px 6px",color:riskColor(a.delta_rate,null)}}>{a.delta_rate>0?"+":""}{a.delta_rate.toFixed(0)}</td>
                  <td style={{padding:"4px 6px",color:C.dm}}>{a.direction}</td>
                </tr>
              )}</tbody>
            </table>
            {groupAlerts.length>15 && <div style={{fontSize:8,color:C.dm,marginTop:4}}>+{groupAlerts.length-15} more</div>}
          </div>
        </Card>
      )}

      {/* Rankings */}
      {Object.keys(data.rankings).length>0 && (
        <Card style={{marginBottom:12}}>
          <Lbl>All-Time Extremes</Lbl>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:12}}>
            {CATS.map(cat => { const rk=data.rankings[cat]; if(!rk) return null; return (
              <div key={cat} style={{borderLeft:`3px solid ${CAT_META[cat].color}`,paddingLeft:8}}>
                <div style={{fontSize:9,fontWeight:700,color:CAT_META[cat].color,marginBottom:3}}>{CAT_META[cat].label}</div>
                {rk.top_increases?.slice(0,2).map((r,i) => <div key={`i${i}`} style={{fontSize:8,marginBottom:1}}><span style={{color:riskColor(1,cat)}}>▲ {r.delta_rate>0?"+":""}{r.delta_rate.toFixed(0)}</span><span style={{color:C.dm}}> {DT_LABELS[r.doc_type]?.slice(0,8)} {r.period.slice(0,7)}</span></div>)}
                {rk.top_decreases?.slice(0,2).map((r,i) => <div key={`d${i}`} style={{fontSize:8,marginBottom:1}}><span style={{color:riskColor(-1,cat)}}>▼ {r.delta_rate.toFixed(0)}</span><span style={{color:C.dm}}> {DT_LABELS[r.doc_type]?.slice(0,8)} {r.period.slice(0,7)}</span></div>)}
              </div>
            ); })}
          </div>
        </Card>
      )}
    </>);
  };

  // ═══ EVENT ANALYSIS (News/MCR) ═══
  const renderEventAnalysis = () => {
    const prices = priceData || [];
    const eventPoints = filtered.map(t => {
      const td = new Date(t.period);
      const near = prices.length ? prices.reduce((best,p) => Math.abs(new Date(p.d)-td)<Math.abs(new Date(best.d)-td)?p:best, prices[0]) : null;
      return {
        fullPeriod:t.period,
        z:+(t[zKey]||0).toFixed(2),
        price:near?.c??null,
        docLabel:DT_LABELS[t.doc_type],
        currWords:t.curr_words,
        reliable:t.reliable,
      };
    });

    const pMin = prices.length ? Math.round(Math.min(...prices.map(p=>p.c))*0.9*100)/100 : 0;
    const pMax = prices.length ? Math.round(Math.max(...prices.map(p=>p.c))*1.1*100)/100 : 10;

    const eventLog = filtered.map(t => ({
      ...t,
      docLabel:DT_LABELS[t.doc_type],
      zVal:t[zKey]||0,
    }));

    return (
      <>
        <Card style={{marginBottom:12,background:C.hi,border:"none"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Event Analysis — {tickerDisplay} News/MCR</div>
          <div style={{fontSize:10,color:C.dm,lineHeight:1.7,maxWidth:820}}>
            Each filing is treated as a standalone event. Z-scores are computed on absolute tone levels across all News/MCR releases.
            <b style={{color:C.r}}> Red = higher risk language vs peer events.</b> <b style={{color:C.g}}> Green = lower risk language.</b>
          </div>
        </Card>

        <Card style={{marginBottom:12}}>
          <Lbl>Event Tone Timeline — {metric==="composite"?"Composite":CAT_META[metric]?.label}</Lbl>
          <div style={{width:"100%",height:280}}>
            <ResponsiveContainer>
              <ComposedChart data={eventPoints} margin={{top:10,right:50,left:10,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.4} />
                <XAxis dataKey="fullPeriod" tickFormatter={fmtTick} tick={{fontSize:8,fill:C.dm}} />
                <YAxis yAxisId="left" tick={{fontSize:8,fill:C.dm}} />
                <YAxis yAxisId="right" orientation="right" tick={{fontSize:8,fill:C.bl}} domain={[pMin,pMax]} tickFormatter={v=>v.toFixed(2)} label={{value:"C$",angle:90,position:"insideRight",style:{fontSize:8,fill:C.bl}}} />
                <Tooltip content={<EventTooltip metric={metricCat} />} />
                <ReferenceLine yAxisId="left" y={0} stroke={C.tx} opacity={0.3} />
                <ReferenceLine yAxisId="left" y={1.5} stroke={C.r} strokeDasharray="4 4" opacity={0.3} />
                <ReferenceLine yAxisId="left" y={-1.5} stroke={C.g} strokeDasharray="4 4" opacity={0.3} />
                <Bar yAxisId="left" dataKey="z" maxBarSize={16}>
                  {eventPoints.map((d,i) => <Cell key={i} fill={d.reliable?zBg(d.z,metricCat,1.5):`${C.dm}44`} />)}
                </Bar>
                <Line yAxisId="right" type="monotone" dataKey="price" stroke={C.bl} strokeWidth={2} dot={{r:2,fill:C.bl}} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{fontSize:8,color:C.dm,marginTop:4}}>Event z-scores (bars) with {tickerDisplay} weekly close (line). Faded = &lt;{MIN_WORDS} words.</div>
        </Card>

        <Card style={{marginBottom:12}}>
          <Lbl>Event Log — Absolute Tone Levels</Lbl>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:"'IBM Plex Mono', monospace"}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.bd}`}}>
                  {[
                    "Period",
                    "Type",
                    "Event Z",
                    "Neg",
                    "Neg Z",
                    "Unc",
                    "Unc Z",
                    "Lit",
                    "Lit Z",
                    "Con",
                    "Con Z",
                    "Pos",
                    "Pos Z",
                    "Words",
                  ].map(h => <th key={h} style={{padding:"6px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {eventLog.map((t,i) => (
                  <tr key={t.id||i} style={{borderBottom:`1px solid ${C.bd}`,background:Math.abs(t.zVal)>=1.5?zBg(t.zVal,metricCat,0.2):i%2===0?"transparent":C.hi,opacity:t.reliable?1:0.5}}>
                    <td style={{padding:"5px 6px",fontWeight:700}}>{t.period}</td>
                    <td style={{padding:"5px 6px"}}>{t.docLabel}</td>
                    <td style={{padding:"5px 6px",fontWeight:700,color:riskColor(t.zVal,metricCat)}}>{t.zVal>0?"+":""}{t.zVal.toFixed(2)}σ</td>
                    {eventCats.flatMap(cat => ([
                      <td key={`${t.period}-${cat}`} style={{padding:"5px 6px",color:CAT_META[cat].color}}>
                        {t[`l_${cat}`].toFixed(1)}
                      </td>,
                      <td key={`${t.period}-${cat}-z`} style={{padding:"5px 6px",color:riskColor(t[`zev_${cat}`]||0,cat)}}>
                        {(t[`zev_${cat}`]||0)>0?"+":""}{(t[`zev_${cat}`]||0).toFixed(2)}
                      </td>,
                    ]))}
                    <td style={{padding:"5px 6px",color:C.dm}}>{t.curr_words.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  };

  // ═══ SIGNAL BACKTEST ═══
  const renderSignalBacktest = () => {
    const prices = priceData || [];
    const windows = [
      { key:"1W", days:7 },
      { key:"2W", days:14 },
      { key:"4W", days:28 },
      { key:"8W", days:56 },
      { key:"12W", days:84 },
    ];

    const filings = filtered
      .map(t => {
        const filingDate = new Date(t.period);
        const base = closestPrice(prices, filingDate);
        if (!base) return null;
        const ret = {};
        for (const w of windows) {
          const targetDate = new Date(filingDate);
          targetDate.setDate(targetDate.getDate() + w.days);
          const target = closestPrice(prices, targetDate);
          ret[w.key] = target ? ((target.c / base.c) - 1) * 100 : null;
        }
        return {
          period: t.period,
          delta: t.composite_delta,
          returns: ret,
        };
      })
      .filter(Boolean);

    if (filings.length < 3) {
      return (
        <Card>
          <div style={{fontSize:10,color:C.dm}}>Not enough filings with price coverage to run the signal backtest.</div>
        </Card>
      );
    }

    const sortedByDelta = [...filings].sort((a,b)=>a.delta-b.delta);
    const cut1 = Math.floor(sortedByDelta.length / 3);
    const cut2 = Math.floor((sortedByDelta.length * 2) / 3);
    sortedByDelta.forEach((f,idx) => {
      if (idx < cut1) f.tercile = "Low";
      else if (idx < cut2) f.tercile = "Mid";
      else f.tercile = "High";
    });

    const statsByWindow = windows.map(w => {
      const deltaVals = [];
      const returnVals = [];
      const terciles = { Low:[], Mid:[], High:[] };
      for (const f of sortedByDelta) {
        const val = f.returns[w.key];
        if (val == null) continue;
        deltaVals.push(f.delta);
        returnVals.push(val);
        terciles[f.tercile].push(val);
      }
      const r = pearson(deltaVals, returnVals);
      const tercileStats = Object.fromEntries(Object.entries(terciles).map(([k,vals]) => {
        if (!vals.length) return [k,{ avg:null, win:null, n:0 }];
        const avg = vals.reduce((s,v)=>s+v,0)/vals.length;
        const win = vals.filter(v=>v>0).length / vals.length * 100;
        return [k,{ avg, win, n:vals.length }];
      }));
      return { window:w.key, r, tercileStats };
    });

    const best = statsByWindow
      .filter(s => s.r != null)
      .sort((a,b) => Math.abs(b.r) - Math.abs(a.r))[0];
    const bestWindow = best?.window || "—";
    const bestStrength = best?.r == null ? "—" : Math.abs(best.r) >= 0.4 ? "Strong" : Math.abs(best.r) >= 0.2 ? "Moderate" : "Weak";
    const spread8w = statsByWindow.find(s => s.window === "8W");
    const spreadVal = spread8w?.tercileStats?.High?.avg != null && spread8w?.tercileStats?.Low?.avg != null
      ? spread8w.tercileStats.High.avg - spread8w.tercileStats.Low.avg
      : null;

    const scatterData = sortedByDelta
      .map(f => ({ x:f.delta, y:f.returns["8W"] }))
      .filter(p => p.y != null);

    return (
      <>
        <Card style={{marginBottom:12,background:C.hi,border:"none"}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Signal Backtest — {tickerDisplay} {DOC_GROUPS[effGroup].label}</div>
          <div style={{fontSize:10,color:C.dm,lineHeight:1.7,maxWidth:820}}>
            Forward returns after each filing, sorted into terciles by composite tone delta. Measures whether tone shifts predict price performance.
          </div>
        </Card>

        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          <StatBox l="Best Window" v={bestWindow} sub="Highest |r|" />
          <StatBox l="Signal Strength" v={bestStrength} sub={best?.r != null ? `r=${best.r>0?"+":""}${best.r.toFixed(2)}` : "—"} />
          <StatBox l="8W Spread" v={spreadVal != null ? `${spreadVal>0?"+":""}${spreadVal.toFixed(1)}%` : "—"} sub="High − Low" c={spreadVal>0?C.g:spreadVal<0?C.r:C.dm} />
        </div>

        <Card style={{marginBottom:12}}>
          <Lbl>Tercile Return Matrix</Lbl>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:"'IBM Plex Mono', monospace"}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.bd}`}}>
                  <th style={{padding:"6px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase"}}>Window</th>
                  {['Low','Mid','High'].map(t => (
                    <th key={t} style={{padding:"6px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase"}}>{t} Avg / Win%</th>
                  ))}
                  <th style={{padding:"6px 6px",textAlign:"left",fontSize:8,color:C.dm,textTransform:"uppercase"}}>Pearson r</th>
                </tr>
              </thead>
              <tbody>
                {statsByWindow.map((row,i) => (
                  <tr key={row.window} style={{borderBottom:`1px solid ${C.bd}`,background:i%2===0?"transparent":C.hi}}>
                    <td style={{padding:"5px 6px",fontWeight:700}}>{row.window}</td>
                    {['Low','Mid','High'].map(t => {
                      const stat = row.tercileStats[t];
                      return (
                        <td key={`${row.window}-${t}`} style={{padding:"5px 6px",color:stat.avg!=null?(stat.avg>=0?C.g:C.r):C.dm}}>
                          {stat.avg!=null ? `${stat.avg>0?"+":""}${stat.avg.toFixed(1)}% / ${stat.win.toFixed(0)}%` : "—"}
                        </td>
                      );
                    })}
                    <td style={{padding:"5px 6px",color:row.r!=null?(row.r>=0?C.g:C.r):C.dm}}>
                      {row.r!=null ? `${row.r>0?"+":""}${row.r.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card style={{marginBottom:12}}>
          <Lbl>Scatter: Composite Δ vs 8W Return</Lbl>
          <div style={{width:"100%",height:260}}>
            <ResponsiveContainer>
              <ScatterChart margin={{top:10,right:20,left:10,bottom:10}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bd} opacity={0.4} />
                <XAxis type="number" dataKey="x" tick={{fontSize:8,fill:C.dm}} label={{value:"Composite Δ (hits/10K)",position:"insideBottom",offset:-5,style:{fontSize:8,fill:C.dm}}} />
                <YAxis type="number" dataKey="y" tick={{fontSize:8,fill:C.dm}} label={{value:"8W Return %",angle:-90,position:"insideLeft",style:{fontSize:8,fill:C.dm}}} />
                <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.bd}`,borderRadius:4,fontSize:9}} formatter={(val,name)=>name==="y"?[`${val.toFixed(1)}%`,`8W Return`]:[val.toFixed(1),"Composite Δ"]} />
                <Scatter data={scatterData} fill={C.acc} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div style={{fontSize:8,color:C.dm,marginTop:4}}>Each point = a filing. X = composite tone delta, Y = forward 8-week return.</div>
        </Card>
      </>
    );
  };

  // ═══ SECTION DRILLDOWN ═══
  const renderSectionDrilldown = () => {
    const hmData = data.sectionDetail.filter(s => groupTypes.includes(s.doc_type));
    if (!hmData.length) return <Card><div style={{fontSize:10,color:C.dm}}>No section data for {DOC_GROUPS[effGroup].label}.</div></Card>;
    const hmField = hmMetric==="composite"?"composite_delta":`delta_${hmMetric}`;
    const sections = [...new Set(hmData.map(h=>h.section))];
    const periods = [...new Set(hmData.map(h=>h.period))].sort();
    const lookup = {};
    for (const h of hmData) { const k=`${h.section}__${h.period}`; if(!lookup[k]) lookup[k]={...h}; }
    const sectionMax = {};
    for (const s of sections) { const vals=hmData.filter(h=>h.section===s).map(h=>Math.abs(h[hmField]||0)); sectionMax[s]=Math.max(...vals,0); }
    const sortedSec = hmSort==="alpha" ? [...sections].sort() : [...sections].sort((a,b)=>(sectionMax[b]||0)-(sectionMax[a]||0));
    const allVals = Object.values(lookup).map(h=>Math.abs(h[hmField]||0)).filter(v=>v>0);
    const maxVal = allVals.length ? Math.max(...allVals) : 1;

    return (<>
      <Card style={{marginBottom:12,background:C.hi,border:"none"}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>Section Drilldown — {tickerDisplay} {DOC_GROUPS[effGroup].label}</div>
        <div style={{fontSize:10,color:C.dm,lineHeight:1.7}}>Tone delta by section and period. Click a cell to view sentence-level changes.</div>
      </Card>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9,fontWeight:700,color:C.dm}}>METRIC:</span>
        {["composite",...CATS].map(m => <Pill key={m} label={m==="composite"?"COMP":CAT_META[m].short} active={hmMetric===m} onClick={()=>setHmMetric(m)} color={hmMetric===m&&m!=="composite"?CAT_META[m].color:undefined} />)}
        <span style={{fontSize:9,fontWeight:700,color:C.dm,marginLeft:8}}>SORT:</span>
        <Pill label="Impact" active={hmSort==="maxDelta"} onClick={()=>setHmSort("maxDelta")} />
        <Pill label="A-Z" active={hmSort==="alpha"} onClick={()=>setHmSort("alpha")} />
      </div>
      <Card style={{marginBottom:12,padding:8,overflowX:"auto"}}>
        <table style={{borderCollapse:"collapse",width:"100%",fontSize:8,fontFamily:"'IBM Plex Mono', monospace"}}>
          <thead><tr>
            <th style={{padding:"4px 6px",textAlign:"left",fontSize:7,color:C.dm,position:"sticky",left:0,background:C.card,zIndex:1,minWidth:130}}>Section</th>
            {periods.map(p => <th key={p} style={{padding:"4px 2px",textAlign:"center",fontSize:7,color:C.dm,minWidth:38,writingMode:periods.length>10?"vertical-rl":undefined}}>{fmtTick(p)}</th>)}
          </tr></thead>
          <tbody>{sortedSec.map(sec =>
            <tr key={sec}>
              <td style={{padding:"3px 6px",fontWeight:600,fontSize:7,position:"sticky",left:0,background:C.card,zIndex:1,borderRight:`1px solid ${C.bd}`}}>{fmtSection(sec)}</td>
              {periods.map(p => {
                const key=`${sec}__${p}`, cell=lookup[key], val=cell?.[hmField]??null, isExp=expandedCell===key;
                if (val===null) return <td key={p} style={{padding:"2px",background:"#f9f9f7",textAlign:"center",border:`1px solid ${C.bd}22`}}>·</td>;
                const intensity=Math.min(Math.abs(val)/(maxVal||1),1);
                const bg = val>0 ? `rgba(194,69,37,${0.06+intensity*0.5})` : val<0 ? `rgba(26,107,58,${0.06+intensity*0.5})` : "#fafaf8";
                return (
                  <td key={p} onClick={()=>setExpandedCell(isExp?null:key)} style={{padding:"2px",textAlign:"center",background:bg,border:`1px solid ${C.bd}22`,
                    cursor:"pointer",fontWeight:intensity>0.3?700:400,color:intensity>0.4?"#fff":C.tx,fontSize:7,outline:isExp?`2px solid ${C.tx}`:"none"}}
                    title={`${fmtSection(sec)} · ${p}\nΔ: ${val>0?"+":""}${val.toFixed(1)}\nWords: ${cell.curr_words?.toLocaleString()}`}>
                    {val>0?"+":""}{Math.abs(val)>=10?val.toFixed(0):val.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          )}</tbody>
        </table>
      </Card>

      {/* Drilldown panel */}
      {expandedCell && (() => {
        const [sec,p] = expandedCell.split("__");
        const cell = lookup[expandedCell]; if (!cell) return null;
        const matchDet = data.sectionDetail.find(s => s.section===sec && s.period===p && groupTypes.includes(s.doc_type));
        const compId = matchDet?.comparison_id || cell?.comparison_id;
        const drill = compId ? data.drilldown[compId] : null;
        const secDrill = drill?.sections?.[sec];
        const drivers = compId ? data.drivers[compId]?.sections?.[sec] : null;

        const SentBlock = ({ items, label, color, limit }) => {
          if (!items?.length) return null;
          return (
            <div style={{marginBottom:6}}>
              <div style={{fontSize:8,fontWeight:700,color,textTransform:"uppercase",letterSpacing:0.6,marginBottom:2}}>{label} ({items.length})</div>
              {items.slice(0,limit||4).map((s,i) => {
                const text = typeof s==="string"?s:s.sentence;
                const words = s.matched_words;
                return (
                  <div key={i} style={{fontSize:8,padding:"2px 6px",marginBottom:1,background:color===C.r?"#fde8e322":"#dff0df22",borderLeft:`2px solid ${color}44`,borderRadius:"0 2px 2px 0",lineHeight:1.4}}>
                    {text?.slice(0,200)}{text?.length>200?"…":""}
                    {words?.length>0 && <span style={{color:C.dm,fontSize:7}}> [{words.slice(0,4).join(", ")}]</span>}
                  </div>
                );
              })}
              {items.length>(limit||4) && <div style={{fontSize:7,color:C.dm}}>+{items.length-(limit||4)} more</div>}
            </div>
          );
        };

        return (
          <Card style={{marginBottom:12,borderLeft:`3px solid ${C.acc}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <div style={{fontSize:11,fontWeight:700}}>{fmtSection(sec)} — {p}</div>
                <div style={{fontSize:8,color:C.dm}}>{DT_LABELS[cell.doc_type]||cell.doc_type} · Words: {cell.curr_words?.toLocaleString()} · Exp: {cell.expansion_pct>0?"+":""}{cell.expansion_pct?.toFixed(1)}% · Sent: +{cell.sentences_added} / −{cell.sentences_removed}</div>
              </div>
              <button onClick={()=>setExpandedCell(null)} style={{background:"none",border:`1px solid ${C.bd}`,borderRadius:3,padding:"3px 8px",fontSize:9,cursor:"pointer",color:C.dm}}>✕</button>
            </div>
            {drivers ? CATS.filter(cat=>drivers[cat]).map(cat => {
              const cd = drivers[cat]; if(!cd?.top_added?.length && !cd?.top_removed?.length) return null;
              return (
                <div key={cat} style={{marginBottom:6}}>
                  <div style={{fontSize:8,fontWeight:700,color:CAT_META[cat].color,marginBottom:2}}>{CAT_META[cat].label} Drivers</div>
                  <SentBlock items={cd.top_added} label="+Added" color={C.r} limit={2} />
                  <SentBlock items={cd.top_removed} label="−Removed" color={C.g} limit={2} />
                </div>
              );
            }) : secDrill ? <>
              <SentBlock items={secDrill.added} label="Added" color={C.r} />
              <SentBlock items={secDrill.removed} label="Removed" color={C.g} />
            </> : <div style={{fontSize:9,color:C.dm}}>No sentence-level data for this cell.</div>}
          </Card>
        );
      })()}
    </>);
  };

  // ═══ MAIN RENDER ═══
  return (
    <div>
      <Card style={{marginBottom:12,background:C.hi,border:"none"}}>
        <div style={{fontSize:13,fontWeight:700,marginBottom:4}}>SEDAR+ Filing Sentiment — {tickerDisplay}</div>
        <div style={{fontSize:10,color:C.dm,lineHeight:1.7,maxWidth:800}}>
          Dictionary-based NLP comparison of {data.meta.total_comparisons||data.timeline.length} SEDAR+ filings across {data.meta.doc_types?.length||7} document types.
          Measures negative, uncertainty, litigious, constraining, and positive language density (hits per 10,000 words).
          Z-scores normalize tone shifts within each document group.
        </div>
      </Card>

      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9,fontWeight:700,color:C.dm}}>DOC GROUP:</span>
        {availGroups.map(g => <Pill key={g} label={DOC_GROUPS[g].label} active={effGroup===g} onClick={()=>{setDocGroup(g);setExpandedCell(null);setView(g==="news"?"eventAnalysis":"priceTone");}} />)}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9,fontWeight:700,color:C.dm}}>METRIC:</span>
        <Pill label="COMP" active={metric==="composite"} onClick={()=>setMetric("composite")} />
        {CATS.map(m => <Pill key={m} label={CAT_META[m].short} active={metric===m} onClick={()=>setMetric(m)} color={metric===m?CAT_META[m].color:undefined} />)}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        <span style={{fontSize:9,fontWeight:700,color:C.dm}}>VIEW:</span>
        {viewOptions.map(v => <Pill key={v.key} label={v.label} active={effView===v.key} onClick={()=>setView(v.key)} />)}
        {effView==="priceTone" && !isNews && <>
          <span style={{fontSize:9,fontWeight:700,color:C.dm,marginLeft:8}}>MODE:</span>
          <Pill label="Delta" active={toneMode==="delta"} onClick={()=>setToneMode("delta")} />
          <Pill label="Level" active={toneMode==="level"} onClick={()=>setToneMode("level")} />
        </>}
      </div>

      {effView==="priceTone" && renderPriceTone()}
      {effView==="filingAnalysis" && renderFilingAnalysis()}
      {effView==="sectionDrilldown" && renderSectionDrilldown()}
      {effView==="signalBacktest" && renderSignalBacktest()}
      {effView==="eventAnalysis" && renderEventAnalysis()}
      {effView==="toneLevels" && renderPriceTone("level")}
    </div>
  );
}
