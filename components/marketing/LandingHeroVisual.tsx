export function LandingHeroVisual() {
  return (
    <div className="relative">
      <div className="rounded-3xl border border-line bg-surface p-3 shadow-[0_24px_60px_-32px_rgba(28,36,31,0.45)]">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="rounded-2xl border border-line bg-paper p-4 md:col-span-2">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Agent</p>
            <p className="mt-3 text-sm leading-relaxed">
              I&apos;ve created a 9-section onboarding covering goals, training history, schedule, nutrition, recovery
              and coaching preferences.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4 md:col-span-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted uppercase">Form preview</p>
            <p className="mt-3 font-display text-2xl tracking-tight">Goals</p>
            <p className="mt-2 text-sm text-muted">What should this training block prioritize?</p>
            <div className="mt-4 space-y-2">
              <span className="block rounded-xl border border-accent bg-accent-soft px-3 py-2 text-sm">Muscle gain</span>
              <span className="block rounded-xl border border-line px-3 py-2 text-sm">Fat loss</span>
              <span className="block rounded-xl border border-line px-3 py-2 text-sm">Strength</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
