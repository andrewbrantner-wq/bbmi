"use client";

import React from "react";
import Link from "next/link";
import LogoBadge from "@/components/LogoBadge";

// ── Layout constants ──────────────────────────────────────────────────────────
const TEAM_H   = 28;
const TEAM_W   = 185;
const CONN_W   = 22;
const SLOT_GAP = 3;
const PAIR_H   = TEAM_H * 2 + SLOT_GAP;
const LABEL_H  = 15;
const BBMI_H   = 13;
const PAIR_FULL = LABEL_H + PAIR_H + BBMI_H + 8;
const QF_GAP   = 22;

// ── Simulation probabilities (10,000 Monte Carlo sims, BBMI ratings) ─────────
// Simulated pre-tournament using end-of-season BBMI scores.
// Indiana (37.5) was a heavy favorite; all others clustered in the low 30s.
const SIM_PROBS: Record<string, { qf: number; sf: number; final: number; champ: number }> = {
  "Indiana":      { qf: 88.1, sf: 65.6, final: 65.6, champ: 51.2 },
  "Georgia":      { qf: 58.9, sf: 35.4, final: 35.4, champ: 12.8 },
  "Texas Tech":   { qf: 55.4, sf: 16.9, final: 16.9, champ:  9.1 },
  "Oregon":       { qf: 43.0, sf: 13.5, final: 13.5, champ:  7.3 },
  "Ole Miss":     { qf: 38.5, sf: 21.5, final: 21.5, champ:  6.7 },
  "Miami (FL)":   { qf: 42.8, sf: 20.5, final: 20.5, champ:  6.0 },
  "Ohio State":   { qf: 49.5, sf: 20.4, final: 20.4, champ:  4.9 },
  "Oklahoma":     { qf:  9.2, sf:  3.3, final:  3.3, champ:  1.3 },
  "Texas A&M":    { qf:  7.6, sf:  1.5, final:  1.5, champ:  0.3 },
  "Alabama":      { qf:  2.6, sf:  0.6, final:  0.6, champ:  0.2 },
  "James Madison":{ qf:  1.6, sf:  0.1, final:  0.1, champ:  0.1 },
  "Tulane":       { qf:  2.6, sf:  0.6, final:  0.6, champ:  0.0 },
};

// ── CFP bracket data ──────────────────────────────────────────────────────────
type CFPGame = {
  top: { name: string; seed: number; score?: number };
  bot: { name: string; seed: number; score?: number };
  bowl: string; date: string; bbmiPick: string; edge: number;
  probKey: "qf" | "sf" | "final" | "champ";
};

const FIRST_ROUND: CFPGame[] = [
  { top:{name:"James Madison",seed:12,score:34}, bot:{name:"Oregon",   seed: 5,score:51}, bowl:"Fiesta Bowl", date:"Dec 21", bbmiPick:"Oregon",    edge: 2.0, probKey:"qf"    },
  { top:{name:"Alabama",      seed: 9,score:34}, bot:{name:"Oklahoma", seed: 8,score:24}, bowl:"Rose Bowl",   date:"Dec 20", bbmiPick:"Oklahoma",  edge: 3.0, probKey:"qf"    },
  { top:{name:"Tulane",       seed:11,score:10}, bot:{name:"Ole Miss", seed: 6,score:41}, bowl:"Sugar Bowl",  date:"Dec 20", bbmiPick:"Ole Miss",  edge: 1.0, probKey:"qf"    },
  { top:{name:"Miami (FL)",   seed:10,score:10}, bot:{name:"Texas A&M",seed: 7,score: 3}, bowl:"Cotton Bowl", date:"Dec 20", bbmiPick:"Miami (FL)",edge:12.5, probKey:"qf"    },
];

// QF order top→bottom: Oregon side (top) Indiana side, Ole Miss side, Miami side
const QUARTERFINALS: CFPGame[] = [
  { top:{name:"Oregon",    seed: 5,score:23}, bot:{name:"Texas Tech",seed:4,score: 0}, bowl:"Orange Bowl", date:"Jan 1",  bbmiPick:"Oregon",    edge: 2.0, probKey:"sf"    },
  { top:{name:"Alabama",   seed: 9,score: 3}, bot:{name:"Indiana",   seed:1,score:38}, bowl:"Rose Bowl",   date:"Jan 1",  bbmiPick:"Indiana",   edge:12.0, probKey:"sf"    },
  { top:{name:"Ole Miss",  seed: 6,score:39}, bot:{name:"Georgia",   seed:3,score:34}, bowl:"Sugar Bowl",  date:"Jan 2",  bbmiPick:"Georgia",   edge: 4.5, probKey:"sf"    },
  { top:{name:"Miami (FL)",seed:10,score:24}, bot:{name:"Ohio State",seed:2,score:14}, bowl:"Cotton Bowl", date:"Jan 1",  bbmiPick:"Miami (FL)",edge:10.0, probKey:"sf"    },
];

const SEMIFINALS: CFPGame[] = [
  { top:{name:"Oregon",   seed: 5,score:22}, bot:{name:"Indiana",   seed: 1,score:56}, bowl:"Peach Bowl",  date:"Jan 10", bbmiPick:"Indiana",  edge: 5.5, probKey:"final" },
  { top:{name:"Ole Miss", seed: 6,score:27}, bot:{name:"Miami (FL)",seed:10,score:31}, bowl:"Fiesta Bowl", date:"Jan 9",  bbmiPick:"Ole Miss", edge: 3.5, probKey:"final" },
];

const CHAMPIONSHIP: CFPGame[] = [
  { top:{name:"Miami (FL)",seed:10,score:21}, bot:{name:"Indiana",seed:1,score:27}, bowl:"National Championship", date:"Jan 20", bbmiPick:"Indiana", edge:7.0, probKey:"champ" },
];

// FR → which QF slot does the winner feed?
const FR_TO_QF: {qfIdx:number; slot:"top"|"bot"}[] = [
  {qfIdx:0, slot:"top"},
  {qfIdx:1, slot:"top"},
  {qfIdx:2, slot:"top"},
  {qfIdx:3, slot:"top"},
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function gWinner(g: CFPGame): string | null {
  if (g.top.score == null || g.bot.score == null) return null;
  return g.top.score > g.bot.score ? g.top.name : g.bot.name;
}
function gCorrect(g: CFPGame): boolean | null {
  const w = gWinner(g); if (!w) return null;
  return g.bbmiPick === w;
}
function fmtPct(v: number) { return `${v.toFixed(1)}%`; }

// ── BracketConn ───────────────────────────────────────────────────────────────
function BracketConn({x,topY,botY,color="#c0bbb5"}:{x:number;topY:number;botY:number;color?:string}) {
  const midY = (topY + botY) / 2;
  const stubW = CONN_W / 2;
  const s: React.CSSProperties = {position:"absolute",backgroundColor:color};
  return (
    <>
      <div style={{...s,top:topY,left:x,         width:stubW,height:1}}/>
      <div style={{...s,top:topY,left:x+stubW,   width:1,height:botY-topY+1}}/>
      <div style={{...s,top:botY,left:x,         width:stubW,height:1}}/>
      <div style={{...s,top:midY,left:x+stubW,   width:stubW,height:1}}/>
    </>
  );
}

// ── TeamSlot ──────────────────────────────────────────────────────────────────
function TeamSlot({name,seed,score,prob,isWinner,isBye,probKey}:{
  name:string; seed:number; score?:number; prob?:number;
  isWinner?:boolean; isBye?:boolean;
  probKey?: "qf"|"sf"|"final"|"champ";
}) {
  const finished = score !== undefined;
  const dim = finished && !isWinner;
  const borderColor = isBye ? "#c97a2a" : isWinner ? "#15803d" : "#d4d0cc";
  const bgColor     = isBye ? "#fffbf5" : isWinner ? "rgba(22,163,74,0.07)" : "#ffffff";
  const simProb = probKey && SIM_PROBS[name] ? SIM_PROBS[name][probKey] : undefined;

  return (
    <div style={{
      height:TEAM_H, width:TEAM_W, border:`1px solid ${borderColor}`, background:bgColor,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      paddingLeft:6, paddingRight:6, fontSize:12.5, boxSizing:"border-box",
      opacity: dim ? 0.38 : 1,
    }}>
      <div style={{display:"flex",alignItems:"center",gap:5,overflow:"hidden",flex:1}}>
        <span style={{fontSize:10.5,color:"#64748b",fontWeight:700,minWidth:16,textAlign:"right",flexShrink:0}}>{seed}</span>
        <span style={{
          fontWeight: isWinner ? 700 : 500,
          color: dim ? "#94a3b8" : "#0f172a",
          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        }}>{name}</span>
        {isBye && (
          <span style={{fontSize:8,fontWeight:700,color:"#c97a2a",backgroundColor:"#fff3e0",border:"1px solid #fde68a",borderRadius:3,padding:"0 3px",flexShrink:0}}>BYE</span>
        )}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}}>
        {simProb !== undefined && !finished && (
          <span style={{fontSize:10,color:"#64748b",fontFamily:"ui-monospace,monospace"}}>{fmtPct(simProb)}</span>
        )}
        {score !== undefined && (
          <span style={{fontFamily:"ui-monospace,monospace",fontWeight:isWinner?800:500,fontSize:12,color:dim?"#94a3b8":isWinner?"#0f172a":"#475569"}}>{score}</span>
        )}
        {isWinner && finished && <span style={{fontSize:9,color:"#15803d"}}>◀</span>}
      </div>
    </div>
  );
}

// ── GamePair ──────────────────────────────────────────────────────────────────
function GamePair({g,topY,left}:{g:CFPGame;topY:number;left:number}) {
  const w       = gWinner(g);
  const correct = gCorrect(g);
  const topProbKey = g.probKey;
  const botProbKey = g.probKey;

  return (
    <>
      {/* Bowl label */}
      <div style={{
        position:"absolute", top:topY-LABEL_H, left,
        width:TEAM_W, fontSize:9, fontWeight:700, color:"#374151",
        textTransform:"uppercase", letterSpacing:"0.05em",
        textAlign:"center", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
      }}>
        {g.bowl} · {g.date}
      </div>
      {/* Top team */}
      <div style={{position:"absolute",top:topY,left}}>
        <TeamSlot name={g.top.name} seed={g.top.seed} score={g.top.score}
          isWinner={w===g.top.name} probKey={topProbKey} />
      </div>
      {/* Bot team */}
      <div style={{position:"absolute",top:topY+TEAM_H+SLOT_GAP,left}}>
        <TeamSlot name={g.bot.name} seed={g.bot.seed} score={g.bot.score}
          isWinner={w===g.bot.name} probKey={botProbKey} />
      </div>
      {/* BBMI pick strip */}
      <div style={{
        position:"absolute", top:topY+PAIR_H+2, left,
        width:TEAM_W, fontSize:9.5, color:"#374151",
        display:"flex", alignItems:"center", justifyContent:"space-between",
      }}>
        <span>BBMI: <strong style={{color:"#0f172a"}}>{g.bbmiPick}</strong><span style={{color:"#64748b",marginLeft:4}}>edge {g.edge}</span></span>
        {correct!==null && (
          <span style={{fontSize:10,fontWeight:800,color:correct?"#15803d":"#dc2626"}}>
            {correct?"✓ WIN":"✗ LOSS"}
          </span>
        )}
      </div>
    </>
  );
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar() {
  const all = [...FIRST_ROUND,...QUARTERFINALS,...SEMIFINALS,...CHAMPIONSHIP];
  const fin = all.filter(g=>g.top.score!=null);
  const cor = fin.filter(g=>gCorrect(g)===true).length;
  const pct = ((cor/fin.length)*100).toFixed(0);
  const he  = fin.filter(g=>g.edge>=5);
  const hec = he.filter(g=>gCorrect(g)===true).length;
  const hePct = he.length>0?((hec/he.length)*100).toFixed(0):"—";
  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,maxWidth:520,margin:"0 auto 28px"}}>
      {[
        {value:`${cor}/${fin.length}`, label:"BBMI Correct",  sub:`${pct}% across all games`,   color:Number(pct)>=50?"#15803d":"#dc2626"},
        {value:`${hec}/${he.length}`,  label:"High-Edge (≥5)", sub:`${hePct}% win rate`,          color:Number(hePct)>=50?"#15803d":"#dc2626"},
        {value:"Indiana",              label:"2025 Champion",  sub:"51.2% sim prob · BBMI ✓",   color:"#15803d"},
      ].map(c=>(
        <div key={c.label} style={{backgroundColor:"#fff",border:"1px solid #e7e5e4",borderRadius:10,padding:"0.875rem 0.75rem",textAlign:"center",boxShadow:"0 1px 3px rgba(0,0,0,0.06)"}}>
          <div style={{fontSize:"1.4rem",fontWeight:800,color:c.color,lineHeight:1}}>{c.value}</div>
          <div style={{fontSize:"0.7rem",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:"#0f172a",margin:"4px 0 3px"}}>{c.label}</div>
          <div style={{fontSize:"0.68rem",color:"#475569"}}>{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function NCAAFBracketPulsePage() {
  const FR_X    = 0;
  const QF_X    = FR_X    + TEAM_W + CONN_W;
  const SF_X    = QF_X    + TEAM_W + CONN_W;
  const CHAMP_X = SF_X    + TEAM_W + CONN_W;
  const TOTAL_W = CHAMP_X + TEAM_W;

  const qfTops = [0,1,2,3].map(i => LABEL_H + i*(PAIR_FULL+QF_GAP));
  const TOTAL_H = qfTops[3] + PAIR_H + BBMI_H + 20;

  const qfPairMidY = (i:number) => qfTops[i] + PAIR_H/2;
  const qfTopMidY  = (i:number) => qfTops[i] + TEAM_H/2;
  const qfBotMidY  = (i:number) => qfTops[i] + TEAM_H + SLOT_GAP + TEAM_H/2;

  const frPairMidYs = FR_TO_QF.map(({qfIdx,slot})=>
    slot==="top" ? qfTopMidY(qfIdx) : qfBotMidY(qfIdx)
  );
  const frTops = frPairMidYs.map(m => m - PAIR_H/2);

  const sfMidYs = [
    (qfPairMidY(0)+qfPairMidY(1))/2,
    (qfPairMidY(2)+qfPairMidY(3))/2,
  ];
  const sfTops = sfMidYs.map(m => m - PAIR_H/2 + LABEL_H);

  const champMidY = (sfMidYs[0]+sfMidYs[1])/2;
  const champTop  = champMidY - PAIR_H/2 + LABEL_H;

  const colHeaders = [
    {label:"First Round",   w:TEAM_W+CONN_W},
    {label:"Quarterfinals", w:TEAM_W+CONN_W},
    {label:"Semifinals",    w:TEAM_W+CONN_W},
    {label:"Championship",  w:TEAM_W},
  ];

  return (
    <div className="section-wrapper">
      <div className="w-full max-w-[1100px] mx-auto px-4 py-8">

        {/* HEADER */}
        <div style={{marginTop:40,display:"flex",flexDirection:"column",alignItems:"center",marginBottom:24}}>
          <h1 style={{display:"flex",alignItems:"center",gap:12,fontSize:"1.875rem",fontWeight:700,letterSpacing:"-0.02em",textAlign:"center"}}>
            <LogoBadge league="ncaa-football" size={36} />
            <span>College Football Playoff</span>
          </h1>
          <p style={{color:"#475569",fontSize:14,textAlign:"center",maxWidth:560,marginTop:8}}>
            12-team bracket with BBMI win probabilities from 10,000 Monte Carlo simulations.
          </p>
          <div style={{marginTop:12,backgroundColor:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"8px 16px",fontSize:13,color:"#166534",fontWeight:600}}>
            ✅ 2025 CFP Complete — Indiana wins the National Championship
          </div>
        </div>

        <SummaryBar />

        {/* METHODOLOGY NOTE */}
        <div style={{backgroundColor:"#f0f9ff",border:"1px solid #bae6fd",borderRadius:8,padding:"10px 16px",marginBottom:24,fontSize:13,color:"#0369a1",lineHeight:1.5,maxWidth:900,margin:"0 auto 24px"}}>
          <strong style={{color:"#0c4a6e"}}>Methodology:</strong>{" "}
          Win probabilities shown on each slot are pre-tournament BBMI simulation results (10,000 runs).
          Indiana entered as a heavy favorite at 51.2% to win the title — the only team above 13%.
          Actual results and BBMI pick accuracy shown after games completed.
        </div>

        {/* BRACKET — sized to content, centered */}
        <div style={{display:"flex",justifyContent:"center",marginBottom:32,overflowX:"auto"}}>
          <div style={{
            border:"1px solid #1e3a5f", borderRadius:10, overflow:"hidden",
            boxShadow:"0 2px 8px rgba(10,26,47,0.18)",
            width: TOTAL_W + 40,   // content width + padding
            flexShrink: 0,
          }}>
            {/* Header */}
            <div style={{background:"linear-gradient(90deg,#0a1a2f 0%,#1e3a5f 100%)",color:"#fff",textAlign:"center",padding:"12px 16px",fontSize:17,fontWeight:700,letterSpacing:"0.02em"}}>
              College Football Playoff 2025 — 12-Team Bracket
            </div>

            {/* Column headers */}
            <div style={{display:"flex",backgroundColor:"#1e3a5f"}}>
              {colHeaders.map(({label,w},i)=>(
                <div key={label} style={{
                  width:w,flexShrink:0,textAlign:"center",padding:"7px 0",
                  fontSize:11,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",
                  color:"#a8c4e0",borderRight:i<colHeaders.length-1?"1px solid rgba(255,255,255,0.1)":undefined,
                }}>{label}</div>
              ))}
            </div>

            {/* Canvas */}
            <div style={{background:"#f8fafc",padding:"24px 20px 28px"}}>
              <div style={{position:"relative",height:TOTAL_H,width:TOTAL_W}}>

                {/* FIRST ROUND */}
                {FIRST_ROUND.map((g,i)=>(
                  <GamePair key={`fr-${i}`} g={g} topY={frTops[i]+LABEL_H} left={FR_X} />
                ))}
                {/* FR bowl labels (already inside GamePair via topY-LABEL_H offset) */}

                {/* FR → QF connectors */}
                {FIRST_ROUND.map((_,i)=>{
                  const {qfIdx,slot} = FR_TO_QF[i];
                  const frMidY  = frPairMidYs[i];
                  const qfSlotY = slot==="top" ? qfTopMidY(qfIdx) : qfBotMidY(qfIdx);
                  const connX   = FR_X+TEAM_W;
                  const topY2   = Math.min(frMidY,qfSlotY);
                  const botY2   = Math.max(frMidY,qfSlotY);
                  return (
                    <React.Fragment key={`fr-conn-${i}`}>
                      <div style={{position:"absolute",top:frMidY,left:connX,width:CONN_W/2,height:1,backgroundColor:"#c0bbb5"}}/>
                      {botY2>topY2+1 && <div style={{position:"absolute",top:topY2,left:connX+CONN_W/2,width:1,height:botY2-topY2+1,backgroundColor:"#c0bbb5"}}/>}
                      <div style={{position:"absolute",top:qfSlotY,left:connX+CONN_W/2,width:CONN_W/2,height:1,backgroundColor:"#c0bbb5"}}/>
                    </React.Fragment>
                  );
                })}

                {/* QUARTERFINALS */}
                {QUARTERFINALS.map((g,i)=>(
                  <GamePair key={`qf-${i}`} g={g} topY={qfTops[i]} left={QF_X} />
                ))}

                {/* QF → SF */}
                {[0,1].map(sfIdx=>(
                  <BracketConn key={`qf-sf-${sfIdx}`} x={QF_X+TEAM_W} topY={qfPairMidY(sfIdx*2)} botY={qfPairMidY(sfIdx*2+1)} />
                ))}

                {/* SEMIFINALS */}
                {SEMIFINALS.map((g,i)=>(
                  <GamePair key={`sf-${i}`} g={g} topY={sfTops[i]} left={SF_X} />
                ))}

                {/* SF → CHAMP */}
                <BracketConn x={SF_X+TEAM_W} topY={sfMidYs[0]} botY={sfMidYs[1]} />

                {/* CHAMPIONSHIP */}
                {CHAMPIONSHIP.map((g,i)=>(
                  <GamePair key={`champ-${i}`} g={g} topY={champTop} left={CHAMP_X} />
                ))}

              </div>
            </div>
          </div>
        </div>

        {/* LEGEND */}
        <div style={{maxWidth:560,margin:"0 auto 24px",backgroundColor:"#f8fafc",border:"1px solid #e7e5e4",borderRadius:8,padding:"10px 16px",display:"flex",gap:20,justifyContent:"center",flexWrap:"wrap",fontSize:12,color:"#374151"}}>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:"#15803d",fontWeight:700}}>✓ WIN</span> BBMI correct</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:"#dc2626",fontWeight:700}}>✗ LOSS</span> BBMI incorrect</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{fontFamily:"ui-monospace,monospace",color:"#64748b",fontSize:11}}>51.2%</span> BBMI sim probability</span>
          <span style={{display:"flex",alignItems:"center",gap:5}}><span style={{color:"#15803d"}}>◀</span> Game winner</span>
        </div>

        {/* FOOTER */}
        <div style={{textAlign:"center",marginBottom:40}}>
          <Link href="/ncaaf-model-accuracy" style={{fontSize:"0.875rem",color:"#2563eb",fontWeight:600,marginRight:"1.5rem"}}>← Model Accuracy</Link>
          <Link href="/ncaaf-picks" style={{fontSize:"0.875rem",color:"#2563eb",fontWeight:600}}>Weekly Picks →</Link>
        </div>

      </div>
    </div>
  );
}
