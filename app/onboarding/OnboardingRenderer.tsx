"use client";

import { ArrowRight, Check, CheckCircle, CircleNotch } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FieldRenderer } from "./FieldRenderer";
import { emptyAnswers, validateAnswers, validateSectionFields, ValidationError } from "@/lib/onboarding/schema/engine";
import { formatEstimatedMinutes } from "@/lib/onboarding/schema/format";
import type { OnboardingAnswers, OnboardingSchema } from "@/lib/onboarding/schema/types";
import { isFieldVisible } from "@/lib/onboarding/schema/visibility";
import { pageHasError, questionPages, visiblePages } from "@/lib/onboarding/schema/pacing";
import { OnboardingSubmitError } from "@/lib/onboarding/client-submit";
import "./public-onboarding.css";

type Saved = { step: number; pageKey?: string; data: OnboardingAnswers };
export type OnboardingSubmitHandler = (answers: OnboardingAnswers, meta?: { website: string }) => Promise<void>;
export type PublicBranding = { businessName?: string; coachName?: string; primaryColor?: string | null };

// Keep white button labels readable even when a coach chooses a pale brand color.
function readableAccent(value?: string | null) {
  if (!value || !/^#[0-9a-f]{6}$/i.test(value)) return "#285B45";
  const rgb = [1, 3, 5].map((offset) => parseInt(value.slice(offset, offset + 2), 16));
  const luminance = () => rgb.reduce((sum, channel, index) => {
    const c = channel / 255;
    return sum + (c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4) * [.2126, .7152, .0722][index];
  }, 0);
  while (1.05 / (luminance() + .05) < 4.5) rgb.forEach((channel, index) => { rgb[index] = Math.floor(channel * .92); });
  return "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

export function OnboardingRenderer({ schema, onSubmit, mode = "live", branding, persistAnswers = true, storageKey }: {
  schema: OnboardingSchema; onSubmit: OnboardingSubmitHandler; mode?: "live" | "preview" | "public";
  branding?: PublicBranding; persistAnswers?: boolean; storageKey?: string;
}) {
  const draftKey = storageKey ?? schema.storageKey;
  const plan = useMemo(() => questionPages(schema), [schema]);
  const [pageKey, setPageKey] = useState<string | null>(null);
  const [data, setData] = useState<OnboardingAnswers>(() => emptyAnswers(schema));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);
  const [restored, setRestored] = useState(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const [saveDraft, setSaveDraft] = useState(persistAnswers);
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [done, setDone] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const focusNext = useRef(false);
  const pages = visiblePages(plan, data);
  const pageIndex = pageKey ? Math.max(0, pages.findIndex((page) => page.key === pageKey)) : -1;
  const current = pageKey ? pages[pageIndex] ?? pages[0] : undefined;
  const section = current ? schema.sections[current.sectionIndex] : undefined;
  const sectionPages = current ? pages.filter((page) => page.sectionIndex === current.sectionIndex) : [];
  const part = current ? sectionPages.findIndex((page) => page.key === current.key) + 1 : 0;
  const finalPage = Boolean(current && current.key === pages.at(-1)?.key);
  const brand = branding?.businessName || schema.brandName || schema.title;
  const estimate = formatEstimatedMinutes(schema.estimatedMinutes);
  const progress = current ? Math.round(Math.max(0, pageIndex) / Math.max(1, pages.length) * 100) : 0;
  const accent = readableAccent(branding?.primaryColor);

  useEffect(() => {
    if (persistAnswers) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const saved = JSON.parse(raw) as Saved;
          if (saved.data && typeof saved.data === "object" && !Array.isArray(saved.data)) {
            const defaults = emptyAnswers(schema);
            const recovered = Object.fromEntries(Object.keys(defaults).map((key) => [key, saved.data[key] ?? defaults[key]]));
            setData(recovered);
            const available = visiblePages(plan, recovered);
            const legacySection = Number.isFinite(saved.step) ? Math.max(0, Math.min(Math.floor(saved.step), schema.sections.length)) : 0;
            setPageKey(available.find((page) => page.key === saved.pageKey)?.key ?? (legacySection ? available.find((page) => page.sectionIndex >= legacySection - 1)?.key ?? available.at(-1)?.key ?? null : null));
            setRestored(legacySection > 0);
          }
        }
      } catch { setStorageFailed(true); }
    }
    setHydrated(true);
  }, [schema, persistAnswers, draftKey, plan]);

  useEffect(() => {
    if (!hydrated || done || !persistAnswers) return;
    try {
      if (!saveDraft) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify({ step: current ? current.sectionIndex + 1 : 0, pageKey: current?.key, data } satisfies Saved));
      setStorageFailed(false);
    } catch { setStorageFailed(true); }
  }, [data, hydrated, done, draftKey, persistAnswers, saveDraft, current]);

  useEffect(() => {
    if (!focusNext.current) return;
    focusNext.current = false;
    const target = Object.keys(errors).length
      ? root.current?.querySelector<HTMLElement>('[data-invalid="true"] input, [data-invalid="true"] textarea, [data-invalid="true"] button')
      : root.current?.querySelector<HTMLElement>("h1");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [pageKey, errors, done]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setKeyboardOpen(window.innerHeight - viewport.height > 140 && Boolean(root.current?.contains(document.activeElement)));
    viewport.addEventListener("resize", update);
    document.addEventListener("focusout", update);
    return () => { viewport.removeEventListener("resize", update); document.removeEventListener("focusout", update); };
  }, []);

  function patch(key: string, value: unknown) {
    setData((answers) => ({ ...answers, [key]: value }));
    setErrors((previous) => { const next = { ...previous }; delete next[key]; return next; });
    setSubmitError("");
  }
  function move(next: string | null) {
    focusNext.current = true;
    setErrors({}); setSubmitError(""); setRestored(false); setPageKey(next);
  }
  function showErrors(fields: Record<string, string>) {
    focusNext.current = true;
    setErrors(fields);
    const first = pages.find((page) => pageHasError(page, fields));
    if (first) setPageKey(first.key);
  }
  function goNext() {
    if (!current) { move(pages[0]?.key ?? null); return; }
    const nextErrors = validateSectionFields({ ...schema.sections[current.sectionIndex], fields: current.fields }, data);
    if (Object.keys(nextErrors).length) { showErrors(nextErrors); return; }
    move(pages[pageIndex + 1]?.key ?? current.key);
  }
  async function submit() {
    if (busy.current) return;
    try { validateAnswers(schema, data); }
    catch (error) {
      if (error instanceof ValidationError) { showErrors(error.fields); return; }
      throw error;
    }
    busy.current = true; setSubmitting(true); setSubmitError("");
    try {
      await onSubmit(data, { website });
      if (persistAnswers) { try { localStorage.removeItem(draftKey); } catch { /* The canonical submission already succeeded. */ } }
      focusNext.current = true; setDone(true);
    } catch (error) {
      if (error instanceof OnboardingSubmitError && error.fields) showErrors(error.fields);
      setSubmitError("We couldn’t send your answers. They’re still here. Please try submitting again.");
    } finally { busy.current = false; setSubmitting(false); }
  }

  if (!hydrated) return <main className="public-flow public-loading" aria-busy="true"><p role="status">Getting your onboarding ready…</p><div /><div /></main>;

  return (
    <main ref={root} className="public-flow" data-keyboard={keyboardOpen} style={{ "--flow-accent": accent } as CSSProperties}>
      <header className="flow-brand"><span className="flow-brand-mark" aria-hidden="true">{brand.trim().charAt(0).toUpperCase() || "C"}</span><span><strong>{brand}</strong><small>{branding?.coachName ? "with " + branding.coachName : "Client onboarding"}</small></span>{mode === "preview" ? <span className="flow-preview">Preview</span> : null}</header>
      {done ? <section className="flow-success"><span className="flow-success-icon"><CheckCircle size={36} weight="regular" /></span><p className="flow-kicker">{mode === "preview" ? "Preview complete" : "Onboarding sent"}</p><h1 tabIndex={-1}>{mode === "preview" ? "Preview complete" : schema.success.title}</h1><p>{mode === "preview" ? "No answers were submitted." : "Your answers have been sent to your coach. You can close this page."}</p><div className="flow-receipt"><Check size={18} />{mode === "preview" ? "Ready to review your form" : "Submission received"}</div></section> : <div className="flow-layout">
        <aside className="flow-outline" aria-label="Onboarding sections"><p className="flow-kicker">Your starting point</p><h2>Space for your story.</h2><ol>{schema.sections.map((item, index) => <li key={item.id} aria-current={current?.sectionIndex === index ? "step" : undefined} data-complete={current && index < current.sectionIndex}><span aria-hidden="true">{current && index < current.sectionIndex ? <Check size={13} weight="bold" /> : String(index + 1).padStart(2, "0")}</span>{item.navLabel ?? item.title}</li>)}</ol><p>Go at your pace.<br />You can go back to change an answer.</p></aside>
        <section className="flow-content" aria-busy={submitting}>
          {current ? <header className="flow-progress"><div><span>{section?.navLabel ?? section?.title}</span><span>Section {current.sectionIndex + 1} of {schema.sections.length}</span></div><div role="progressbar" aria-label="Onboarding progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-valuetext={"Section " + (current.sectionIndex + 1) + " of " + schema.sections.length}><span style={{ width: progress + "%" }} /></div></header> : null}
          {restored ? <p className="flow-restored" role="status"><Check size={16} />Your saved answers are ready. Pick up where you left off.</p> : null}
          {!current ? <div className="flow-welcome"><p className="flow-kicker">Let’s get to know you</p><h1 tabIndex={-1}>{schema.intro.title}</h1>{schema.intro.description.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<div className="flow-welcome-details">{estimate ? <span><strong>{estimate} min</strong><small>Take it at your pace</small></span> : null}<span><strong>Made for you</strong><small>Help your coach understand your starting point</small></span></div>{schema.intro.footnote ? <p className="flow-note">{schema.intro.footnote}</p> : null}<p className="flow-note">When you finish, your answers are sent to your coach.</p></div> : <div className="flow-questions"><div className="flow-heading"><p className="flow-kicker">{sectionPages.length > 1 ? "Part " + part + " of " + sectionPages.length : "Your " + (section?.navLabel ?? "answers").toLowerCase()}</p><h1 tabIndex={-1}>{section?.title}</h1>{section?.description ? <p>{section.description}</p> : null}<small>Required questions are marked *. Everything else is optional.</small></div><fieldset className="flow-question-set" disabled={submitting}>{current.fields.filter((field) => isFieldVisible(field, data)).map((field) => {
            const error = errors[field.key] || (field.type === "unit_number" ? errors[field.unitKey] || (field.companionKey ? errors[field.companionKey] : undefined) : undefined);
            return <div className="flow-question" key={field.id} data-field-key={field.key} data-invalid={Boolean(error)} data-conditional={Boolean(field.logic)}><FieldRenderer field={field} answers={data} error={error} onChange={patch} /></div>;
          })}</fieldset>{part === sectionPages.length && section?.footer ? <p className="flow-note">{section.footer}</p> : null}</div>}
          {Object.keys(errors).length ? <p className="flow-error-summary" role="alert">Check the highlighted answers before continuing.</p> : null}
          {submitError ? <p className="flow-error-summary" role="alert">{submitError}</p> : null}
          <div hidden aria-hidden="true"><input tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} /></div>
          {persistAnswers ? <details className="flow-save"><summary>{storageFailed ? "Keep this page open — device saving is unavailable" : saveDraft ? "Progress saved on this device" : "Progress is not saved on this device"}</summary><label><input type="checkbox" checked={saveDraft} onChange={(event) => setSaveDraft(event.target.checked)} />Save my progress in this browser</label><p>Use only on your own device. Saved answers clear after a successful submission. Turning this off removes the saved copy; your current answers stay on this page.</p></details> : <p className="flow-note">{mode === "preview" ? "Preview only. Answers won’t be submitted." : "Keep this page open to keep your answers."}</p>}
          <nav className="flow-actions" aria-label="Question navigation">{current ? <button type="button" className="flow-back" disabled={submitting} onClick={() => move(pages[pageIndex - 1]?.key ?? null)}>Back</button> : null}<button type="button" className="flow-primary" disabled={submitting || (!current && !pages.length)} onClick={finalPage ? submit : goNext}>{submitting ? <><CircleNotch className="flow-spinner" size={18} />Sending answers…</> : finalPage ? mode === "preview" ? "Finish preview" : "Submit Onboarding" : <>{current ? "Continue" : schema.intro.buttonLabel}<ArrowRight size={18} /></>}</button></nav>
        </section>
      </div>}
    </main>
  );
}
