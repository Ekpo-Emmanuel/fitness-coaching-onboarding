"use client";

import { TextInput } from "../ui/fields";
import type { UnitOption } from "@/lib/onboarding/schema/types";

export function UnitNumberField({
  label,
  error,
  describedBy,
  units,
  unit,
  value,
  companionValue,
  companionKey,
  onUnitChange,
  onValueChange,
  onCompanionChange,
}: {
  label: string;
  error?: string;
  describedBy?: string;
  units: UnitOption[];
  unit: string;
  value: string;
  companionValue?: string;
  companionKey?: string;
  onUnitChange: (unit: string) => void;
  onValueChange: (value: string) => void;
  onCompanionChange?: (value: string) => void;
}) {
  const selected = units.find((item) => item.value === unit) ?? units[0];
  const showCompanion = Boolean(companionKey && selected?.companion);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {units.map((item) => (
          <button
            aria-pressed={unit === item.value}
            key={item.value}
            type="button"
            className={`inline-flex min-h-11 min-w-[4.5rem] items-center justify-center rounded-lg px-4 ${unit === item.value ? "bg-accent text-surface" : "border border-line bg-surface"}`}
            onClick={() => onUnitChange(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {showCompanion ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TextInput aria-invalid={Boolean(error)} aria-describedby={describedBy} aria-label={label + " (feet)"} inputMode="numeric" placeholder="ft" value={value} onChange={(event) => onValueChange(event.target.value)} />
          <TextInput
            inputMode="decimal"
            aria-invalid={Boolean(error)} aria-describedby={describedBy}
            aria-label={label + " (inches)"}
            placeholder="in"
            value={companionValue ?? ""}
            onChange={(event) => onCompanionChange?.(event.target.value)}
          />
        </div>
      ) : (
        <TextInput
          aria-invalid={Boolean(error)} aria-describedby={describedBy}
          aria-label={label + " (" + selected?.label + ")"}
          className="mt-3"
          inputMode="decimal"
          placeholder={selected?.value === "cm" ? "e.g. 168" : undefined}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
        />
      )}
    </div>
  );
}
