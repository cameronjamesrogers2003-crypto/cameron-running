import Logo from "@/components/Logo";

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 space-y-2.5"
      style={{
        background: "#181818",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
        <span aria-hidden>{icon}</span>
        <span>{title}</span>
      </h3>
      <div className="text-sm leading-relaxed space-y-2" style={{ color: "var(--text-muted)" }}>
        {children}
      </div>
    </div>
  );
}

function QA({
  question,
  answer,
}: {
  question: string;
  answer: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl p-4 sm:p-5 space-y-2"
      style={{
        background: "#181818",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-white font-semibold text-sm sm:text-base">{question}</p>
      <div className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
        {answer}
      </div>
    </div>
  );
}

export default function HelpPage() {
  return (
    <div className="space-y-5 scroll-smooth">
      <div className="flex items-center gap-3">
        <Logo size="sm" showWordmark={false} />
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white">Help</h1>
      </div>

      <div
        className="rounded-xl p-3 sm:p-4 sticky top-14 md:top-16 z-30"
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(20,184,166,0.35)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "#5eead4" }}>
          Help Sections
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { href: "#run-rating", label: "1. Run Rating" },
            { href: "#player-card", label: "2. Player Card" },
            { href: "#plan-works", label: "3. How Your Plan Works" },
          ].map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium transition-colors"
              style={{
                color: "#5eead4",
                background: "rgba(20,184,166,0.10)",
                border: "1px solid rgba(20,184,166,0.25)",
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>

      <section id="run-rating" className="space-y-4 scroll-mt-36 md:scroll-mt-28">
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#5eead4" }}>
          How Your Run Gets Rated
        </h2>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Every run you sync from Strava gets a score out of 10. The score reflects how well the run went
          across four areas. It&apos;s calculated automatically — you don&apos;t need to do anything.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SectionCard title="Pace Quality (worth up to 4 points)" icon="🏃">
            <p>Did you run at the right pace for this type of run?</p>
            <p>Each run type has a target pace zone:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Easy runs: slow, conversational pace</li>
              <li>Tempo runs: comfortably hard — short sentences only</li>
              <li>Interval runs: very hard — barely able to speak</li>
              <li>Long runs: slightly slower than easy pace</li>
            </ul>
            <p>
              The closer your pace to the centre of your zone, the higher your score. You still get points if
              you&apos;re slightly outside the zone — it drops off gradually.
            </p>
            <p>
              Special rule for easy runs: if you ran faster than your easy zone but your heart rate stayed low,
              no penalty is applied. Running fast while staying relaxed is a sign of improving fitness.
            </p>
          </SectionCard>

          <SectionCard title="Effort (worth up to 3 points)" icon="❤️">
            <p>Was your heart rate right for this type of run?</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Easy runs: 60–75% of your max heart rate</li>
              <li>Tempo runs: 80–90% of your max heart rate</li>
              <li>Interval runs: 90–100% of your max heart rate</li>
            </ul>
            <p>
              Heart rate in the middle of the right zone = full points. The further outside the zone, the lower
              the score.
            </p>
            <p>
              No heart rate data? You get 1.5 points as a neutral score — you&apos;re not penalised for missing
              data.
            </p>
          </SectionCard>

          <SectionCard title="Distance (worth up to 2 points)" icon="📏">
            <p>Did you run a good distance compared to your recent average?</p>
            <p>
              This is scored against your own history — not a fixed target. The app looks at your last 5+ runs
              of the same type and uses the median distance as your benchmark.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Beat your median by 20% or more → 2.0 points</li>
              <li>Match your median exactly → 1.5 points</li>
              <li>Half your median → 0.75 points</li>
            </ul>
            <p>
              New to the app? Until you have 5 runs of the same type, you get 1.0–1.2 as a neutral score while
              your benchmark builds up.
            </p>
          </SectionCard>

          <SectionCard title="Conditions (worth up to 1 point)" icon="🌡️">
            <p>A small bonus for running in tough conditions.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Normal conditions → 0.8 points</li>
              <li>Hot (above 28°C) → up to +0.3 bonus</li>
              <li>Humid (above 80%) → up to +0.2 bonus</li>
              <li>Maximum possible → 1.0 points</li>
              <li>No weather data → 0.5 points (neutral)</li>
            </ul>
            <p>Running in Brisbane heat genuinely counts for something.</p>
          </SectionCard>
        </div>

        <div
          className="rounded-xl p-4 sm:p-5 space-y-3"
          style={{
            background: "#181818",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h3 className="text-base sm:text-lg font-semibold text-white">Score bands</h3>
          <div className="space-y-2">
            {[
              { range: "9.0 – 10.0", label: "🟣 Elite", color: "#AFA9EC" },
              { range: "7.0 – 8.9", label: "🟢 Strong", color: "#5DCAA5" },
              { range: "5.5 – 6.9", label: "🔵 Solid", color: "#85B7EB" },
              { range: "4.0 – 5.4", label: "🟡 Rough", color: "#EF9F27" },
              { range: "0 – 3.9", label: "🔴 Off Day", color: "#F09595" },
            ].map((band) => (
              <div key={band.range} className="grid grid-cols-[110px_1fr] sm:grid-cols-[140px_1fr] gap-2 items-center">
                <span className="text-xs sm:text-sm text-white tabular-nums">{band.range}</span>
                <span
                  className="text-xs sm:text-sm font-semibold rounded-md px-2.5 py-1"
                  style={{ background: `${band.color}22`, color: band.color }}
                >
                  {band.label}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Your score breakdown is visible on the Runs page — tap any rating number to see exactly how each
            component was scored and why.
          </p>
        </div>
      </section>

      <section id="player-card" className="space-y-4 scroll-mt-36 md:scroll-mt-28">
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#5eead4" }}>
          Your Player Card
        </h2>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Your player card works like a FIFA or 2K player rating — five attributes that reflect your fitness
          as a runner, all out of 99. It updates automatically after every run.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <SectionCard title="SPD — Speed (25% of OVR)" icon="⚡">
            <p>How fast you are on hard efforts.</p>
            <p>
              Based on your best tempo or interval pace in the last 6 weeks. Compared against a scale from very
              slow (10:00/km) to world record marathon pace (2:53/km by Kelvin Kiptum).
            </p>
            <p>
              Most recreational runners sit between 25–55 SPD. Improving your interval and tempo times directly
              pushes this up.
            </p>
          </SectionCard>

          <SectionCard title="END — Endurance (30% of OVR)" icon="🧱">
            <p>How much volume you&apos;re carrying.</p>
            <p>Equally split between:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your longest single run in the last 30 days</li>
              <li>Your average weekly km over the last 4 weeks</li>
            </ul>
            <p>
              Benchmarked against elite marathon training (42.2km long run, 160km/week). A beginner 3 months in
              might sit around 8–15 END. This grows steadily as your long runs get longer.
            </p>
          </SectionCard>

          <SectionCard title="CON — Consistency (25% of OVR)" icon="📅">
            <p>How reliably you show up to train.</p>
            <p>
              Looks at whether you hit your planned training sessions over the last 28 days. Missing sessions
              lowers this score; showing up every week builds it.
            </p>
            <p>This is entirely within your control — it&apos;s the easiest attribute to improve.</p>
          </SectionCard>

          <SectionCard title="EFF — HR Efficiency (10% of OVR)" icon="🫀">
            <p>How efficiently your heart works at a given pace.</p>
            <p>
              Calculated from your easy runs — specifically how much distance you cover per heartbeat. As your
              fitness improves over weeks and months, your heart gets stronger and pumps more blood per beat,
              meaning your HR drops at the same pace.
            </p>
            <p>
              This is one of the truest measures of fitness improvement. It&apos;s slow to move but very rewarding
              to watch over a full training cycle.
            </p>
          </SectionCard>

          <SectionCard title="TGH — Toughness (10% of OVR)" icon="☀️">
            <p>How often you run in tough conditions.</p>
            <p>
              Based on the conditions scores from your recent runs. Running consistently in heat and humidity
              (Brisbane summers count) gradually builds this up.
            </p>
            <p>It decays faster than other attributes — a few mild weeks will bring it down.</p>
          </SectionCard>
        </div>

        <div
          className="rounded-xl p-4 sm:p-5"
          style={{
            background: "#181818",
            border: "1px solid rgba(20,184,166,0.35)",
          }}
        >
          <p className="text-white font-semibold text-sm sm:text-base">OVR formula</p>
          <p className="mt-2 text-sm sm:text-base font-mono whitespace-pre-line" style={{ color: "#5eead4" }}>
            {`OVR = (SPD × 25%) + (END × 30%) +\n      (CON × 25%) + (EFF × 10%) + (TGH × 10%)`}
          </p>
          <p className="text-sm mt-3" style={{ color: "var(--text-muted)" }}>
            Your OVR goes up easily and drops slowly — like a career mode in a sports game. After 18 weeks of
            consistent training, a beginner runner can realistically expect to go from ~15 OVR to ~50+.
          </p>
        </div>
      </section>

      <section id="plan-works" className="space-y-4 scroll-mt-36 md:scroll-mt-28">
        <h2 className="text-xl sm:text-2xl font-bold" style={{ color: "#5eead4" }}>
          Your Training Plan
        </h2>
        <p className="text-sm sm:text-base leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Your plan is built around you — your schedule, your fitness level, and your goal race. It adapts as
          you train.
        </p>

        <div className="grid grid-cols-1 gap-3">
          <QA
            question="Q: How is my plan structured?"
            answer={
              <>
                <p>Every week has three session types:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Long run — your biggest run of the week, always on your chosen long run day</li>
                  <li>Hard session — tempo or interval training, on the day furthest from your long run</li>
                  <li>Easy runs — all other days, slow and conversational</li>
                </ul>
                <p className="mt-2">
                  As the plan progresses through phases (Base → Build → Taper), the sessions get harder and then
                  easier as race day approaches.
                </p>
              </>
            }
          />

          <QA
            question="Q: What are the training phases?"
            answer={
              <>
                <p>
                  <span className="text-white font-medium">Base phase:</span> Build your aerobic engine with easy
                  running. Every session should feel comfortable.
                </p>
                <p className="mt-2">
                  <span className="text-white font-medium">Build phase:</span> Introduce harder sessions. Tempo runs
                  build your threshold. Interval training develops speed. Easy days stay easy.
                </p>
                <p className="mt-2">
                  <span className="text-white font-medium">Taper phase:</span> Reduce volume to let your body recover
                  and absorb all the training. Trust the process — feeling fresh on race day is the goal.
                </p>
              </>
            }
          />

          <QA
            question="Q: How does the plan adapt?"
            answer={
              <>
                <p>The plan watches your run ratings and adjusts:</p>
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Running well (average above 8.5/10 for 3 weeks) → distances increase slightly</li>
                  <li>Struggling (average below 6.0/10 for 3 weeks) → distances reduce slightly</li>
                  <li>
                    Consistently missing sessions (2+ weeks) → a recovery week is automatically inserted
                  </li>
                </ul>
                <p className="mt-2">You&apos;ll see a notification on the dashboard whenever your plan changes.</p>
              </>
            }
          />

          <QA
            question="Q: What are cutback weeks?"
            answer={
              <>
                <p>
                  Every 3–4 weeks the plan includes a cutback week where distances are reduced by 20–30%. This is
                  intentional — recovery is part of training.
                </p>
                <p className="mt-2">Your body adapts during rest, not during the run.</p>
              </>
            }
          />

          <QA
            question="Q: How are paces set?"
            answer={
              <>
                <p>
                  All target paces come from your VDOT score — a measure of your current fitness calculated from your
                  recent race times.
                </p>
                <p className="mt-2">
                  You can adjust paces up or down using the sliders in Settings if the defaults feel too fast or too
                  slow.
                </p>
              </>
            }
          />
        </div>
      </section>
    </div>
  );
}

