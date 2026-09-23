"use client";

import { useId } from "react";
import {
  CheckRow,
  ChoiceList,
  Field,
  MultiChoice,
  Scale,
  TextArea,
  TextInput,
} from "./ui/fields";
import { UnitNumberField } from "./specialized/UnitNumberField";
import type { FormField, OnboardingAnswers } from "@/lib/onboarding/schema/types";

function asString(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function FieldRenderer({
  field,
  answers,
  error,
  onChange,
}: {
  field: FormField;
  answers: OnboardingAnswers;
  error?: string;
  onChange: (key: string, value: unknown) => void;
}) {
  const value = answers[field.key];
  const helpId = useId();
  const hintId = helpId + "-hint";
  const accessible = { "aria-label": field.label, "aria-invalid": Boolean(error), "aria-describedby": [field.description ? hintId : null, error ? helpId : null].filter(Boolean).join(" ") || undefined };

  if (field.type === "acknowledgement") {
    return (
      <Field label={field.label} hint={field.description} hintId={hintId} required={field.required}>
        <CheckRow checked={value === true} onChange={(next) => onChange(field.key, next)} error={error} errorId={helpId}>
          {field.statement}
        </CheckRow>
      </Field>
    );
  }

  if (field.type === "unit_number") {
    return (
      <Field label={field.label} hint={field.description} hintId={hintId} error={error} errorId={helpId} required={field.required}>
        <UnitNumberField
          label={field.label}
          error={error}
          describedBy={accessible["aria-describedby"]}
          units={field.units}
          unit={asString(answers[field.unitKey]) || field.defaultUnit}
          value={asString(value)}
          companionKey={field.companionKey}
          companionValue={field.companionKey ? asString(answers[field.companionKey]) : undefined}
          onUnitChange={(unit) => onChange(field.unitKey, unit)}
          onValueChange={(next) => onChange(field.key, next)}
          onCompanionChange={
            field.companionKey ? (next) => onChange(field.companionKey as string, next) : undefined
          }
        />
      </Field>
    );
  }

  const compactChoices =
    field.type === "single_select" &&
    field.options.length <= 4 &&
    field.options.every((option) => option.label.length <= 12);

  return (
    <Field label={field.label} hint={field.description} hintId={hintId} error={error} errorId={helpId} required={field.required}>
      {field.type === "long_text" ? (
        <TextArea {...accessible}
          rows={3}
          placeholder={field.placeholder}
          value={asString(value)}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : null}
      {field.type === "short_text" || field.type === "phone" || field.type === "number" ? (
        <TextInput {...accessible}
          inputMode={field.type === "number" ? (field.validation?.integer ? "numeric" : "decimal") : field.type === "phone" ? "tel" : undefined}
          type={field.type === "phone" ? "tel" : "text"}
          autoComplete={"autoComplete" in field ? field.autoComplete : field.type === "phone" ? "tel" : undefined}
          placeholder={field.placeholder}
          value={asString(value)}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : null}
      {field.type === "email" ? (
        <TextInput {...accessible}
          type="email"
          autoComplete="email"
          value={asString(value)}
          onChange={(event) => onChange(field.key, event.target.value)}
        />
      ) : null}
      {field.type === "date" ? (
        <TextInput {...accessible} type="date" value={asString(value)} onChange={(event) => onChange(field.key, event.target.value)} />
      ) : null}
      {field.type === "single_select" ? (
        <ChoiceList
          options={field.options}
          value={asString(value)}
          onChange={(next) => onChange(field.key, next)}
          columns={field.columns}
          compact={compactChoices}
        />
      ) : null}
      {field.type === "multi_select" ? (
        <MultiChoice
          options={field.options}
          value={asStringArray(value)}
          onChange={(next) => onChange(field.key, next)}
        />
      ) : null}
      {field.type === "scale" ? (
        <Scale
          value={typeof value === "number" ? value : null}
          onChange={(next) => onChange(field.key, next)}
          min={field.min}
          max={field.max}
          low={field.lowLabel}
          high={field.highLabel}
        />
      ) : null}
      {field.type === "boolean" ? (
        <ChoiceList
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          value={value === true ? "true" : value === false ? "false" : ""}
          onChange={(next) => onChange(field.key, next === "true")}
          columns={2}
          compact
        />
      ) : null}
    </Field>
  );
}
