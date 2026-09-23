export function LandingStudio() {
  return (
    <div className="landing-studio relative grid overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_24px_60px_-32px_rgba(28,36,31,0.45)] md:grid-cols-2">
      <div className="border-b border-line p-4 md:border-r md:border-b-0 md:p-5">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Agent</p>
        <div className="mt-4 space-y-3 text-sm">
          <p className="rounded-2xl bg-paper px-3 py-2.5">
            Build me an onboarding for beginner online bodybuilding clients.
          </p>
          <p className="rounded-2xl border border-line bg-white px-3 py-2.5 text-[0.95rem] leading-relaxed">
            I&apos;ve created a 9-section onboarding covering goals, training history, schedule, nutrition, recovery and
            coaching preferences. I also added coach-review rules for reported injuries and exercise restrictions.
          </p>
          <p className="rounded-2xl bg-paper px-3 py-2.5">Make it shorter and remove most nutrition questions.</p>
        </div>
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft p-3">
          <p className="font-display text-sm tracking-tight">Proposed changes</p>
          <p className="mt-1 text-xs text-muted">Remove 4 nutrition fields. Keep injury review rules.</p>
          <div className="mt-3 flex gap-2">
            <span className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-sm text-surface">Apply</span>
            <span className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm">Reject</span>
          </div>
        </div>
      </div>
      <div className="bg-paper/60 p-4 md:p-5">
        <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Client preview</p>
        <div className="mt-4 rounded-2xl border border-line bg-white p-4">
          <p className="text-xs text-muted">Section 2 of 7</p>
          <p className="mt-2 font-display text-xl tracking-tight">Training history</p>
          <p className="mt-3 text-sm">How many days can you train each week?</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {["2", "3", "4", "5+"].map((label) => (
              <span
                key={label}
                className={`inline-flex min-h-10 min-w-12 items-center justify-center rounded-full border px-3 text-sm ${
                  label === "3" ? "border-accent bg-accent-soft" : "border-line"
                }`}
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
