"use client";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import ScorePill from "@/components/ScorePill";

export type WeatherByDate = Record<string, { tempC: number; dewPointC: number; humidity: number } | null>;
export type RecentRating = { score: number; avgHeartRate: number | null; distanceKm: number };
export interface ProgramSession { id: string; date: string; weekNumber: number; dayOfWeek: number; sessionType: string; status: "SCHEDULED"|"COMPLETED"|"MISSED"|"SKIPPED"; currentDistanceKm: number; originalDistanceKm: number; targetPaceMinKmLow: number|null; targetPaceMinKmHigh: number|null; targetHrZone: number|null; isAdjusted: boolean; triggerReason: string|null; activity: { avgPaceSecKm: number; avgHeartRate: number|null }|null; rating: { score: number; paceScore: number; hrScore: number; executionScore: number; distanceScore: number }|null; }

const hrZones = {1:[99,119],2:[119,149],3:[149,168],4:[168,182],5:[182,198]} as const;
const fmtPace=(s:number)=>`${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;
const dkey=(d:Date)=>d.toISOString().split("T")[0];

export default function ProgramTable({ sessions, recentRatings, profile, weatherByDate }: { sessions: ProgramSession[]; recentRatings: RecentRating[]; profile: { hrMax:number|null; hrRest:number|null; rftpSecPerKm:number|null; dateOfBirth:Date }|null; weatherByDate: WeatherByDate }) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const today = new Date(); today.setHours(0,0,0,0);
  const rftp = profile?.rftpSecPerKm ?? 395;
  const grouped = useMemo(()=>{ const m=new Map<number,ProgramSession[]>(); for(let w=1;w<=12;w++)m.set(w,[]); sessions.forEach(s=>{ if(s.weekNumber>=1&&s.weekNumber<=12) m.get(s.weekNumber)?.push(s);}); return m;},[sessions]);
  const baseTips = useMemo(()=>{ const t=["Run at a pace where you can hold a full conversation."]; if(recentRatings.length>=3 && recentRatings.every(r=>(r.avgHeartRate??0)>168)) t.push("Your HR has been running high lately — keep this genuinely easy."); if(recentRatings[0]?.score!==undefined && recentRatings[0].score<6) t.push("Last run was tough — today is about recovery, not performance."); if(recentRatings.some(r=>r.score<6)) t.push("You've been cutting runs short — try to hit the full distance today."); return t.slice(0,3);},[recentRatings]);

  return <div className="space-y-3">{Array.from({length:12},(_,idx)=>{ const week=idx+1; const items=grouped.get(week)??[]; const first=items[0]?new Date(items[0].date):null; const state=!first?"future":(first>today?"future":(first<today?"past":"current")); const expanded=state==="current"||open[`week-${week}`];
    return <section key={week} className="rounded-xl p-3" style={{background:"var(--surface)",border:state==="current"?"1px solid color-mix(in srgb, var(--accent) 40%, transparent)":"1px solid var(--border)",opacity:state==="past"?0.88:1}}>
      <button className="w-full flex items-center justify-between text-left" onClick={()=>setOpen(p=>({...p,[`week-${week}`]:!p[`week-${week}`]}))}><h3 className="font-semibold text-white">Week {week}</h3><span style={{color:"var(--text-muted)"}}>{expanded?"−":"+"}</span></button>
      {expanded && <div className="mt-2 space-y-2">{items.map((s)=>{ const d=new Date(s.date); const wx=weatherByDate[dkey(d)]; const heat=wx&&wx.tempC>35?"extreme":wx&&wx.tempC>30&&wx.dewPointC>20?"advisory":null; const hrZone=s.targetHrZone??2; const [hrLow,hrHigh]=hrZones[(hrZone as keyof typeof hrZones)]??hrZones[2]; const paceLow=s.targetPaceMinKmLow?Math.round(s.targetPaceMinKmLow*60):rftp+60; const paceHigh=s.targetPaceMinKmHigh?Math.round(s.targetPaceMinKmHigh*60):rftp+90; const delta=((paceLow+paceHigh)/2)-rftp; const paceZone=delta>120?"Recovery Jog":delta>=60?"Easy Zone":delta>=30?"Comfortable":delta>=0?"Moderate Push":"Threshold +"; const missed=s.status==="MISSED";
        return <article key={s.id} className="relative rounded-lg p-3" style={{background:"var(--surface)",border:"1px solid var(--border)"}}>
          <div className="flex items-center gap-2"><p className="text-sm font-semibold text-white">{`Session · ${s.sessionType.replaceAll("_"," ")}`}</p><span className="text-xs" style={{color:"var(--text-muted)"}}>{format(d,"EEE d MMM")}</span>{missed&&<span className="rounded px-2 py-0.5 text-xs" style={{background:"rgba(239,68,68,.15)",color:"#fca5a5"}}>Missed</span>}{heat&&<span className="rounded px-2 py-0.5 text-xs" style={{background:heat==="extreme"?"rgba(239,68,68,.2)":"rgba(245,158,11,.2)",color:heat==="extreme"?"#fca5a5":"#fcd34d"}}>{heat==="extreme"?"Extreme Heat":"Heat Advisory"}</span>}</div>
          {!missed && <>
            <p className="mt-1 text-xs" style={{color:"var(--text-muted)"}}>Builds aerobic durability with controlled effort.</p>
            <p className="text-xs" style={{color:"var(--text-muted)"}}>{`Zone ${hrZone} · ${hrLow}–${hrHigh} bpm`}</p>
            <p className="text-xs" style={{color:"var(--text-muted)"}}>{`${paceZone} · ${fmtPace(paceLow)}–${fmtPace(paceHigh)} /km`}</p>
            <ul className="mt-2 list-disc pl-5 text-xs" style={{color:"var(--text-muted)"}}>{baseTips.map(t=><li key={t}>{t}</li>)}{heat==="advisory"&&<li>Hot and humid today — widen your pace target by ~8% and prioritise HR over pace.</li>}{heat==="extreme"&&<li>Extreme heat — consider running before 7am or moving this session indoors.</li>}</ul>
          </>}
          {s.status==="COMPLETED"&&s.activity&&s.rating&&<div className="mt-2 space-y-1 text-xs" style={{color:"var(--text-muted)"}}><p>{`Actual pace: ${fmtPace(s.activity.avgPaceSecKm)} vs ${fmtPace(paceLow)}–${fmtPace(paceHigh)}`}</p><p>{`Actual HR: ${s.activity.avgHeartRate??"-"} vs ${hrLow}–${hrHigh}`}</p><ScorePill score={s.rating.score} size="xs" /><p>{s.rating.executionScore>0.85?"Great execution":s.rating.paceScore>0.8?"On target":s.rating.hrScore<0.6?"Too hard":"Slightly fast"}</p></div>}
          {s.isAdjusted&&<div className="group absolute right-2 top-2"><span className="rounded px-2 py-0.5 text-xs" style={{background:"rgba(245,158,11,.2)",color:"#fcd34d"}}>{`Adjusted ${s.currentDistanceKm<s.originalDistanceKm?"↓":"↑"}`}</span><div className="absolute right-0 mt-1 hidden w-56 rounded p-2 text-xs group-hover:block" style={{background:"var(--surface)",border:"1px solid var(--border)",color:"var(--text-muted)"}}>{`${(s.currentDistanceKm-s.originalDistanceKm).toFixed(1)}km · ${s.triggerReason??"auto_adjustment"}`}<p className="mt-1">Recent load/HR signals triggered this adjustment to protect recovery.</p></div></div>}
        </article>; })}</div>}
    </section>; })}</div>;
}
