"use client";

import { Check } from "@phosphor-icons/react";
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { labelOf } from "@/lib/onboarding/constants";

export function Field({
  label,
  hint,
  error,
  errorId,
  required,
  hintId,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  errorId?: string;
  required?: boolean;
  hintId?: string;
  children: ReactNode;
}) {
  return (
    <fieldset aria-invalid={Boolean(error)} className="flex flex-col gap-2" aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}>
      <legend className="mb-2 font-medium tracking-tight text-ink">
        {label}
        {required ? <span className="text-muted"> *</span> : <span className="ml-2 text-sm font-normal text-muted">Optional</span>}
      </legend>
      {hint ? <p id={hintId} className="max-w-[65ch] text-[0.95rem] leading-relaxed text-muted">{hint}</p> : null}
      {children}
      {error ? (
        <p id={errorId} className="text-[0.95rem] text-warn" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

const control =
  "min-h-12 w-full rounded-lg border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition-[border-color,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] placeholder:text-muted/70 focus:border-accent";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${control} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={props.rows ?? 4} className={`${control} resize-y ${props.className ?? ""}`} />;
}

export function ChoiceList<T extends string>({
  values,
  options,
  value,
  onChange,
  columns = 1,
  compact = false,
}: {
  values?: readonly T[];
  options?: Array<{ label: string; value: string }>;
  value: T | "";
  onChange: (next: T) => void;
  columns?: 1 | 2;
  compact?: boolean;
}) {
  const items = options ?? (values ?? []).map((item) => ({ value: item, label: labelOf(item) }));
  return (
    <div className={`flow-options ${compact ? "compact" : ""} columns-${columns}`}>
      {items.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            aria-pressed={selected}
            type="button"
            onClick={() => onChange(option.value as T)}
            className="flow-choice"
          >
            <span>{option.label}</span>{selected ? <Check size={16} aria-hidden="true" weight="bold" /> : null}
          </button>
        );
      })}
    </div>
  );
}

export function MultiChoice<T extends string>({
  values,
  options,
  value,
  onChange,
}: {
  values?: readonly T[];
  options?: Array<{ label: string; value: string }>;
  value: T[];
  onChange: (next: T[]) => void;
}) {
  const items = options ?? (values ?? []).map((item) => ({ value: item, label: labelOf(item) }));
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((option) => {
        const selected = value.includes(option.value as T);
        return (
          <button
            key={option.value}
            aria-pressed={selected}
            type="button"
            onClick={() => {
              const item = option.value as T;
              onChange(selected ? value.filter((entry) => entry !== item) : [...value, item]);
            }}
            className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-[0.98rem] transition-[transform,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.98] ${
              selected ? "border-accent bg-accent text-surface" : "border-line bg-surface text-ink"
            }`}
          >
            {selected ? <Check size={16} weight="bold" /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Scale({
  value,
  onChange,
  low,
  high,
  min = 1,
  max = 5,
}: {
  value: number | null;
  onChange: (next: number) => void;
  low: string;
  high: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flow-scale">
        {Array.from({ length: max - min + 1 }, (_, index) => min + index).map((n) => (
          <button
            key={n}
            aria-pressed={value === n}
            type="button"
            onClick={() => onChange(n)}
            className={`min-h-14 rounded-2xl border font-display text-xl font-medium transition-[transform,background-color] duration-200 active:scale-[0.98] ${
              value === n ? "border-accent bg-accent text-surface" : "border-line bg-surface"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="flow-scale-labels">
        <span>{min} — {low}</span>
        <span>{max} — {high}</span>
      </div>
    </div>
  );
}

export function CheckRow({ checked, onChange, children, error, errorId }: { checked: boolean; onChange: (next: boolean) => void; children: ReactNode; error?: string; errorId?: string }) {
  return <div><label className="flow-check"><input type="checkbox" checked={checked} aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} onChange={(event) => onChange(event.target.checked)} /><span>{children}</span></label>{error ? <p id={errorId} className="mt-2 text-sm text-warn" role="alert">{error}</p> : null}</div>;
}
