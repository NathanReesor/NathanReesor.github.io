// SPX OpEx Analysis Dashboard — Fetches weekly CSV from GitHub Pages
// Deploy instructions: see codex-prompt.md
import { useState, useEffect, useMemo } from "react";
import { bin, max } from "d3-array";
import { scaleBand, scaleLinear } from "d3-scale";

const CSV_URL = import.meta.env.BASE_URL + "data/spx_weekly.csv";

const fmt=(v,d=2)=>v==null||isNaN(v)?"—":(v>=0?"+":"")+(v*100).toFixed(d)+"%";
const fmtN=(v,d=1)=>v==null||isNaN(v)?"—":v.toFixed(d);
const avg=a=>a.length?a.reduce((s,v)=>s+v,0)/a.length:null;
const med=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const sd=a=>{if(a.length<2)return null;const m=avg(a);return Math.sqrt(a.reduce((s,v)=>s+(v-m)**2,0)/(a.length-1));};
const wr=a=>a.length?a.filter(v=>v>0).length/a.length:null;
const ts=a=>{if(a.length<3)return null;const m=avg(a),se=sd(a)/Math.sqrt(a.length);return se===0?null:m/se;};
function getThirdFriday(y,m){const d=new Date(y,m,1),dow=d.getDay();return new Date(y,m,(dow<=5?5-dow+1:12-dow)+14);}

function parseCSV(text){
  const lines=text.trim().split("\n"),rows=[];
  for(let i=1;i<lines.length;i++){const c=lines[i].split(",");if(c.length<5)continue;const date=c[0].trim(),close=parseFloat(c[4]);if(!date||isNaN(close))continue;rows.push({date,close});}
  rows.sort((a,b)=>a.date.localeCompare(b.date));return rows;
}

function classifyWeeks(rows){
  return rows.map((row,i)=>{
    const d=new Date(row.date+"T12:00:00"),month=d.getMonth(),year=d.getFullYear(),dom=d.getDate();
    const tf=getThirdFriday(year,month).getDate(),isOpex=tf>=dom-4&&tf<=dom;
    const ret=i>0?(row.close-rows[i-1].close)/rows[i-1].close:null;
    return{...row,i,year,month,dom,weekReturn:ret,isOpexWeek:isOpex,isQuarterly:isOpex&&[2,5,8,11].includes(month)};
  });
}

function analyzeOpex(cl){
  return cl.filter(w=>w.isOpexWeek).map(o=>{
    const i=o.i,g=idx=>(idx>=0&&idx<cl.length)?cl[idx]:null;
    return{date:o.date,year:o.year,month:o.month,isQuarterly:o.isQuarterly,close:o.close,
      opexReturn:o.weekReturn,w1Before:g(i-1)?.weekReturn??null,w2Before:g(i-2)?.weekReturn??null,
      w1After:g(i+1)?.weekReturn??null,w2After:g(i+2)?.weekReturn??null,
      runup2w:g(i-2)?(o.close-g(i-2).close)/g(i-2).close:null,
      drift2w:g(i+2)?(g(i+2).close-o.close)/o.close:null};
  });
}

function cStats(entries,field){
  const v=entries.map(e=>e[field]).filter(x=>x!=null);
  if(!v.length)return null;
  return{mean:avg(v),median:med(v),stdev:sd(v),winRate:wr(v),tStat:ts(v),n:v.length};
}

const K={bg:"#0a0e17",card:"#111827",bdr:"#1e293b",text:"#e2e8f0",mut:"#64748b",grn:"#22c55e",red:"#ef4444",blu:"#3b82f6",amb:"#f59e0b",cyn:"#06b6d4",pur:"#a855f7",grd:"#1e293b",acc:"#f97316"};
const crd={background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:14,overflow:"auto"};
const ff="'JetBrains Mono','Fira Code',monospace";

function SVGBar({data,w:W=480,h:H=210,title}){
  const mg={t:28,r:12,b:34,l:50},w=W-mg.l-mg.r,h=H-mg.t-mg.b;
  const x=scaleBand().domain(data.map(d=>d.l)).range([0,w]).padding(.22);
  const mx=Math.max(...data.map(d=>Math.abs(d.v)),.001);
  const y=scaleLinear().domain([-mx*1.3,mx*1.3]).range([h,0]);
  return(
    <svg width={W} height={H} style={{overflow:"visible"}}>
      <g transform={`translate(${mg.l},${mg.t})`}>
        <text x={w/2} y={-10} textAnchor="middle" fill={K.text} style={{fontSize:11,fontFamily:ff,fontWeight:600}}>{title}</text>
        {y.ticks(5).map(t=><line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={K.grd} strokeDasharray="2,3"/>)}
        <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke={K.mut}/>
        {data.map((d,i)=>{
          const bY=d.v>=0?y(d.v):y(0),bH=Math.abs(y(d.v)-y(0));
          return(<g key={i}>
            <rect x={x(d.l)} y={bY} width={x.bandwidth()} height={Math.max(bH,1)} fill={d.v>=0?K.grn:K.red} opacity={.85} rx={2}/>
            <text x={x(d.l)+x.bandwidth()/2} y={d.v>=0?bY-3:bY+bH+11} textAnchor="middle" fill={d.v>=0?K.grn:K.red} style={{fontSize:8,fontFamily:ff}}>{fmt(d.v)}</text>
          </g>);
        })}
        {data.map((d,i)=><text key={i} x={x(d.l)+x.bandwidth()/2} y={h+13} textAnchor="middle" fill={d.hl?K.acc:K.mut} style={{fontSize:9,fontFamily:ff,fontWeight:d.hl?700:400}}>{d.l}</text>)}
        {y.ticks(5).map(t=><text key={t} x={-6} y={y(t)+3} textAnchor="end" fill={K.mut} style={{fontSize:8,fontFamily:ff}}>{fmt(t)}</text>)}
      </g>
    </svg>
  );
}

function SVGDist({data,w:W=480,h:H=190,title,color=K.blu}){
  const mg={t:28,r:12,b:28,l:50},w=W-mg.l-mg.r,h=H-mg.t-mg.b;
  const bins=bin().thresholds(16)(data);
  const x=scaleLinear().domain([bins[0].x0,bins[bins.length-1].x1]).range([0,w]);
  const y=scaleLinear().domain([0,max(bins,b=>b.length)]).range([h,0]);
  const m=avg(data);
  return(
    <svg width={W} height={H} style={{overflow:"visible"}}>
      <g transform={`translate(${mg.l},${mg.t})`}>
        <text x={w/2} y={-10} textAnchor="middle" fill={K.text} style={{fontSize:11,fontFamily:ff,fontWeight:600}}>{title}</text>
        {bins.map((b,i)=><rect key={i} x={x(b.x0)+1} y={y(b.length)} width={Math.max(x(b.x1)-x(b.x0)-2,1)} height={h-y(b.length)} fill={color} opacity={.7} rx={1}/>)}
        {m!=null&&<><line x1={x(m)} x2={x(m)} y1={0} y2={h} stroke={K.acc} strokeWidth={2} strokeDasharray="4,3"/><text x={x(m)} y={-2} textAnchor="middle" fill={K.acc} style={{fontSize:8,fontFamily:ff}}>{"μ="+fmt(m)}</text></>}
        <line x1={x(0)} x2={x(0)} y1={0} y2={h} stroke={K.mut}/>
        <line x1={0} x2={w} y1={h} y2={h} stroke={K.grd}/>
        {x.ticks(6).map(t=><text key={t} x={x(t)} y={h+13} textAnchor="middle" fill={K.mut} style={{fontSize:8,fontFamily:ff}}>{fmt(t)}</text>)}
      </g>
    </svg>
  );
}

function SVGHeat({entries,field="opexReturn",w:W=680,title}){
  const mg={t:32,r:12,b:20,l:46};
  const years=[...new Set(entries.map(e=>e.year))].sort();
  const mos=["J","F","M","A","M","J","J","A","S","O","N","D"];
  const cW=(W-mg.l-mg.r)/12,cH=Math.min(26,240/years.length),H2=mg.t+mg.b+years.length*cH;
  const mx=Math.max(...entries.map(e=>Math.abs(e[field]||0)),.005);
  const cs=scaleLinear().domain([-mx,0,mx]).range([K.red,K.bg,K.grn]);
  return(
    <svg width={W} height={H2} style={{overflow:"visible"}}>
      <g transform={`translate(${mg.l},${mg.t})`}>
        <text x={(W-mg.l-mg.r)/2} y={-16} textAnchor="middle" fill={K.text} style={{fontSize:11,fontFamily:ff,fontWeight:600}}>{title}</text>
        {mos.map((m,i)=><text key={i} x={i*cW+cW/2} y={-4} textAnchor="middle" fill={[2,5,8,11].includes(i)?K.amb:K.mut} style={{fontSize:9,fontFamily:ff,fontWeight:[2,5,8,11].includes(i)?700:400}}>{m}</text>)}
        {years.map((yr,yi)=>(
          <g key={yr}>
            <text x={-6} y={yi*cH+cH/2+3} textAnchor="end" fill={K.mut} style={{fontSize:8,fontFamily:ff}}>{yr}</text>
            {mos.map((_,mi)=>{
              const e=entries.find(x=>x.year===yr&&x.month===mi);
              const v=e?.[field];
              return(<g key={mi}>
                <rect x={mi*cW+1} y={yi*cH+1} width={cW-2} height={cH-2} fill={v!=null?cs(v):"#0f1520"} rx={2} opacity={.9} stroke={e?.isQuarterly?K.amb:"transparent"} strokeWidth={e?.isQuarterly?1.5:0}/>
                {v!=null&&cH>14&&<text x={mi*cW+cW/2} y={yi*cH+cH/2+3} textAnchor="middle" fill={Math.abs(v)>mx*.4?"#fff":K.mut} style={{fontSize:7,fontFamily:ff}}>{fmt(v,1)}</text>}
              </g>);
            })}
          </g>
        ))}
      </g>
    </svg>
  );
}

function Card({label,value,sub,color=K.text,delay=0}){
  return(<div style={{background:K.card,border:"1px solid "+K.bdr,borderRadius:8,padding:"12px 14px",minWidth:115,animation:`fadeUp .5s ease ${delay}s both`}}>
    <div style={{fontSize:9,color:K.mut,fontFamily:ff,textTransform:"uppercase",letterSpacing:1,marginBottom:5}}>{label}</div>
    <div style={{fontSize:20,fontWeight:700,color,fontFamily:ff}}>{value}</div>
    {sub&&<div style={{fontSize:9,color:K.mut,fontFamily:ff,marginTop:3}}>{sub}</div>}
  </div>);
}

function StatsTable({st,title,fields}){
  const th={textAlign:"right",padding:"5px 7px",color:K.mut,borderBottom:"1px solid "+K.bdr,fontSize:9};
  return(<div style={crd}>
    <div style={{fontSize:12,fontWeight:600,color:K.text,fontFamily:ff,marginBottom:10}}>{title}</div>
    <table style={{width:"100%",borderCollapse:"collapse",fontFamily:ff,fontSize:10}}>
      <thead><tr><th style={{...th,textAlign:"left"}}>Period</th><th style={th}>Mean</th><th style={th}>Median</th><th style={th}>Win%</th><th style={th}>StDev</th><th style={th}>t-Stat</th><th style={th}>N</th></tr></thead>
      <tbody>{fields.map(({key,label})=>{
        const s=st[key];if(!s)return null;
        const sc=s.tStat&&Math.abs(s.tStat)>2?K.amb:s.tStat&&Math.abs(s.tStat)>1.5?K.cyn:K.mut;
        return(<tr key={key} style={{borderBottom:"1px solid "+K.bdr+"22"}}>
          <td style={{padding:"5px 7px",color:K.text}}>{label}</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:s.mean>=0?K.grn:K.red}}>{fmt(s.mean)}</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:s.median>=0?K.grn:K.red}}>{fmt(s.median)}</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:s.winRate>=.55?K.grn:s.winRate<=.45?K.red:K.text}}>{(s.winRate*100).toFixed(1)}%</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:K.mut}}>{fmt(s.stdev)}</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:sc,fontWeight:Math.abs(s.tStat)>1.5?700:400}}>{fmtN(s.tStat)}</td>
          <td style={{padding:"5px 7px",textAlign:"right",color:K.mut}}>{s.n}</td>
        </tr>);
      })}</tbody>
    </table>
  </div>);
}

const TABS=["Overview","Monthly","Quarterly","Comparison","Heatmap"];
const FIELDS=[
  {key:"w2Before",label:"W-2 (2 weeks before)"},{key:"w1Before",label:"W-1 (week before)"},
  {key:"opexReturn",label:"OpEx Week"},{key:"w1After",label:"W+1 (week after)"},
  {key:"w2After",label:"W+2 (2 weeks after)"},{key:"runup2w",label:"2-Wk Runup (W-2 to OpEx)"},
  {key:"drift2w",label:"2-Wk Drift (OpEx to W+2)"},
];

export default function OpExDashboard(){
  const [tab,setTab]=useState("Overview");
  const [rawData,setRawData]=useState(null);
  const [error,setError]=useState(null);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    fetch(CSV_URL).then(r=>{if(!r.ok)throw new Error("HTTP "+r.status);return r.text();})
      .then(text=>{setRawData(parseCSV(text));setLoading(false);})
      .catch(e=>{setError(e.message);setLoading(false);});
  },[]);

  const classified=useMemo(()=>rawData?classifyWeeks(rawData):[],[rawData]);
  const allOpex=useMemo(()=>analyzeOpex(classified),[classified]);
  const quarterly=useMemo(()=>allOpex.filter(e=>e.isQuarterly),[allOpex]);
  const nonQ=useMemo(()=>allOpex.filter(e=>!e.isQuarterly),[allOpex]);
  const mSt=useMemo(()=>{const r={};FIELDS.forEach(f=>{r[f.key]=cStats(allOpex,f.key);});return r;},[allOpex]);
  const qSt=useMemo(()=>{const r={};FIELDS.forEach(f=>{r[f.key]=cStats(quarterly,f.key);});return r;},[quarterly]);
  const nqSt=useMemo(()=>{const r={};FIELDS.forEach(f=>{r[f.key]=cStats(nonQ,f.key);});return r;},[nonQ]);
  const dateRange=rawData?rawData[0].date+" to "+rawData[rawData.length-1].date:"";

  if(loading)return(<div style={{minHeight:"100vh",background:K.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><div style={{color:K.acc,fontFamily:ff,fontSize:14}}>Loading SPX data...</div></div>);
  if(error)return(<div style={{minHeight:"100vh",background:K.bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}><div style={{color:K.red,fontFamily:ff,fontSize:14}}>Failed to load CSV: {error}</div><div style={{color:K.mut,fontFamily:ff,fontSize:11}}>Expected at: {CSV_URL}</div></div>);

  const bf=[{l:"W-2",v:mSt.w2Before?.mean||0},{l:"W-1",v:mSt.w1Before?.mean||0},{l:"OpEx",v:mSt.opexReturn?.mean||0,hl:true},{l:"W+1",v:mSt.w1After?.mean||0},{l:"W+2",v:mSt.w2After?.mean||0}];
  const qbf=[{l:"W-2",v:qSt.w2Before?.mean||0},{l:"W-1",v:qSt.w1Before?.mean||0},{l:"OpEx",v:qSt.opexReturn?.mean||0,hl:true},{l:"W+1",v:qSt.w1After?.mean||0},{l:"W+2",v:qSt.w2After?.mean||0}];
  const nqbf=[{l:"W-2",v:nqSt.w2Before?.mean||0},{l:"W-1",v:nqSt.w1Before?.mean||0},{l:"OpEx",v:nqSt.opexReturn?.mean||0,hl:true},{l:"W+1",v:nqSt.w1After?.mean||0},{l:"W+2",v:nqSt.w2After?.mean||0}];

  return(
    <div style={{minHeight:"100vh",background:K.bg,color:K.text,fontFamily:ff}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}.tb{background:none;border:none;color:${K.mut};font-family:${ff};font-size:11px;padding:7px 14px;cursor:pointer;border-bottom:2px solid transparent;transition:all .2s;letter-spacing:.4px}.tb:hover{color:${K.text}}.tb.a{color:${K.acc};border-bottom-color:${K.acc}}`}</style>

      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(255,255,255,.008) 2px,rgba(255,255,255,.008) 4px)",pointerEvents:"none",zIndex:1000}}/>

      <div style={{maxWidth:1050,margin:"0 auto",padding:"20px 16px"}}>
        <div style={{marginBottom:18,animation:"fadeUp .5s ease both"}}>
          <div style={{display:"flex",alignItems:"baseline",gap:10,marginBottom:3}}>
            <h1 style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:900,margin:0,background:"linear-gradient(135deg,"+K.acc+","+K.amb+")",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>SPX OpEx Analysis</h1>
            <span style={{fontSize:10,color:K.mut,letterSpacing:1}}>WEEKLY DATA</span>
          </div>
          <div style={{fontSize:10,color:K.mut,letterSpacing:.4}}>{dateRange} | {rawData.length} weekly bars | {allOpex.length} monthly OpEx | {quarterly.length} quarterly witching</div>
        </div>

        <div style={{display:"flex",borderBottom:"1px solid "+K.bdr,marginBottom:16,flexWrap:"wrap"}}>
          {TABS.map(t=><button key={t} className={"tb"+(tab===t?" a":"")} onClick={()=>setTab(t)}>{t}</button>)}
        </div>

        {tab==="Overview"&&<div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
            <Card label="OpEx Week Mean" value={fmt(mSt.opexReturn?.mean)} color={mSt.opexReturn?.mean>=0?K.grn:K.red} delay={.05}/>
            <Card label="OpEx Win Rate" value={mSt.opexReturn?.winRate?(mSt.opexReturn.winRate*100).toFixed(0)+"%":"--"} color={K.cyn} delay={.1} sub={"n="+String(mSt.opexReturn?.n||0)}/>
            <Card label="Quarterly Mean" value={fmt(qSt.opexReturn?.mean)} color={qSt.opexReturn?.mean>=0?K.grn:K.red} delay={.15}/>
            <Card label="Q Win Rate" value={qSt.opexReturn?.winRate?(qSt.opexReturn.winRate*100).toFixed(0)+"%":"--"} color={K.amb} delay={.2} sub={"n="+String(qSt.opexReturn?.n||0)}/>
            <Card label="Post-OpEx Drift" value={fmt(mSt.w1After?.mean)} color={mSt.w1After?.mean>=0?K.grn:K.red} delay={.25} sub={"t="+fmtN(mSt.w1After?.tStat)}/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={crd}><SVGBar data={bf} title="All Monthly OpEx | Avg Weekly Returns"/></div>
            <div style={crd}>{mSt.opexReturn&&<SVGDist data={allOpex.map(e=>e.opexReturn).filter(v=>v!=null)} title="OpEx Week Return Distribution"/>}</div>
          </div>
          <StatsTable st={mSt} title="All Monthly OpEx | Summary Statistics" fields={FIELDS}/>
        </div>}

        {tab==="Monthly"&&<div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={crd}><SVGBar data={bf} title="Monthly OpEx | Avg Weekly Returns"/></div>
            <div style={crd}><SVGDist data={allOpex.map(e=>e.runup2w).filter(v=>v!=null)} title="2-Week Runup Distribution" color={K.cyn}/></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={crd}><SVGDist data={allOpex.map(e=>e.w1Before).filter(v=>v!=null)} title="Week Before OpEx" color={K.blu}/></div>
            <div style={crd}><SVGDist data={allOpex.map(e=>e.w1After).filter(v=>v!=null)} title="Week After OpEx" color={K.pur}/></div>
          </div>
          <StatsTable st={mSt} title="Monthly OpEx | Full Statistics" fields={FIELDS}/>
        </div>}

        {tab==="Quarterly"&&<div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={crd}><SVGBar data={qbf} title="Quarterly Witching | Avg Weekly Returns"/></div>
            <div style={crd}><SVGDist data={quarterly.map(e=>e.opexReturn).filter(v=>v!=null)} title="Quarterly OpEx Week Distribution" color={K.amb}/></div>
          </div>
          <StatsTable st={qSt} title="Quarterly Witching (Mar/Jun/Sep/Dec) | Statistics" fields={FIELDS}/>
        </div>}

        {tab==="Comparison"&&<div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
            <div style={crd}><SVGBar data={qbf} title="Quarterly Witching"/></div>
            <div style={crd}><SVGBar data={nqbf} title="Non-Quarterly Monthly"/></div>
          </div>
          <div style={crd}>
            <div style={{fontSize:12,fontWeight:600,color:K.text,marginBottom:10}}>Quarterly vs Non-Quarterly</div>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:10,fontFamily:ff}}>
              <thead><tr>
                <th style={{textAlign:"left",padding:"5px 7px",color:K.mut,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Period</th>
                <th style={{textAlign:"right",padding:"5px 7px",color:K.amb,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Q Mean</th>
                <th style={{textAlign:"right",padding:"5px 7px",color:K.amb,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Q Win%</th>
                <th style={{textAlign:"right",padding:"5px 7px",color:K.blu,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Non-Q Mean</th>
                <th style={{textAlign:"right",padding:"5px 7px",color:K.blu,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Non-Q Win%</th>
                <th style={{textAlign:"right",padding:"5px 7px",color:K.mut,borderBottom:"1px solid "+K.bdr,fontSize:9}}>Delta Mean</th>
              </tr></thead>
              <tbody>{FIELDS.map(({key,label})=>{
                const q=qSt[key],nq=nqSt[key],delta=q&&nq?q.mean-nq.mean:null;
                return(<tr key={key}>
                  <td style={{padding:"5px 7px",color:K.text}}>{label}</td>
                  <td style={{padding:"5px 7px",textAlign:"right",color:q?.mean>=0?K.grn:K.red}}>{q?fmt(q.mean):"--"}</td>
                  <td style={{padding:"5px 7px",textAlign:"right",color:K.mut}}>{q?(q.winRate*100).toFixed(0)+"%":"--"}</td>
                  <td style={{padding:"5px 7px",textAlign:"right",color:nq?.mean>=0?K.grn:K.red}}>{nq?fmt(nq.mean):"--"}</td>
                  <td style={{padding:"5px 7px",textAlign:"right",color:K.mut}}>{nq?(nq.winRate*100).toFixed(0)+"%":"--"}</td>
                  <td style={{padding:"5px 7px",textAlign:"right",color:delta>=0?K.grn:K.red,fontWeight:600}}>{delta!=null?fmt(delta):"--"}</td>
                </tr>);
              })}</tbody>
            </table>
          </div>
        </div>}

        {tab==="Heatmap"&&<div style={{animation:"fadeUp .4s ease both"}}>
          <div style={{...crd,marginBottom:16}}>
            <SVGHeat entries={allOpex} title="OpEx Week Return by Year x Month"/>
            <div style={{display:"flex",gap:14,marginTop:10,fontSize:9,color:K.mut}}>
              <span>Green = Positive</span><span>Red = Negative</span>
              <span style={{color:K.amb}}>Gold border = Quarterly</span>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div style={crd}>
              <SVGBar data={Array.from({length:12},(_,i)=>{
                const v=allOpex.filter(e=>e.month===i).map(e=>e.opexReturn).filter(x=>x!=null);
                return{l:["J","F","M","A","M","J","J","A","S","O","N","D"][i],v:avg(v)||0,hl:[2,5,8,11].includes(i)};
              })} title="Mean OpEx Return by Month"/>
            </div>
            <div style={crd}>
              <SVGBar data={[...new Set(allOpex.map(e=>e.year))].sort().map(y=>{
                const v=allOpex.filter(e=>e.year===y).map(e=>e.opexReturn).filter(x=>x!=null);
                return{l:String(y).slice(2),v:avg(v)||0};
              })} title="Mean OpEx Return by Year"/>
            </div>
          </div>
        </div>}

        <div style={{marginTop:28,paddingTop:14,borderTop:"1px solid "+K.bdr,fontSize:9,color:K.mut,display:"flex",justifyContent:"space-between"}}>
          <span>OpEx = 3rd Friday week | Quarterly = Mar/Jun/Sep/Dec (triple/quad witching)</span>
          <span>Source: Yahoo Finance ^GSPC weekly</span>
        </div>
      </div>
    </div>
  );
}