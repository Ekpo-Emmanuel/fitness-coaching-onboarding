export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "is_empty"
  | "is_not_empty";

export type Condition = {
  fieldKey: string;
  operator: ConditionOperator;
  value?: unknown;
};

export type ConditionalLogic = {
  action: "show";
  all?: Condition[];
  any?: Condition[];
};

export type FieldOption = {
  label: string;
  value: string;
};

export type FieldValidation = {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  email?: boolean;
  date?: "past";
  integer?: boolean;
  minItems?: number;
  requiredMessage?: string;
};

export type UnitOption = {
  value: string;
  label: string;
  min: number;
  max: number;
  integer?: boolean;
  companion?: {
    min: number;
    max: number;
  };
};

type BaseField = {
  id: string;
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  logic?: ConditionalLogic;
  position: number;
  columns?: 1 | 2;
  group?: string;
  groupTitle?: string;
};

export type TextField = BaseField & {
  type: "short_text" | "long_text" | "email" | "phone";
  validation?: FieldValidation;
  autoComplete?: string;
};

export type DateField = BaseField & {
  type: "date";
  validation?: FieldValidation;
};

export type NumberField = BaseField & {
  type: "number";
  validation?: FieldValidation;
};

export type SelectField = BaseField & {
  type: "single_select";
  options: FieldOption[];
  validation?: FieldValidation;
};

export type MultiSelectField = BaseField & {
  type: "multi_select";
  options: FieldOption[];
  validation?: FieldValidation;
};

export type BooleanField = BaseField & {
  type: "boolean";
};

export type ScaleField = BaseField & {
  type: "scale";
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
};

export type AcknowledgementField = BaseField & {
  type: "acknowledgement";
  statement: string;
  validation?: FieldValidation;
};

export type UnitNumberField = BaseField & {
  type: "unit_number";
  unitKey: string;
  companionKey?: string;
  defaultUnit: string;
  units: UnitOption[];
};

export type FormField =
  | TextField
  | DateField
  | NumberField
  | SelectField
  | MultiSelectField
  | BooleanField
  | ScaleField
  | AcknowledgementField
  | UnitNumberField;

export type FieldType = FormField["type"];

export type FormSection = {
  id: string;
  key: string;
  title: string;
  navLabel?: string;
  description?: string;
  footer?: string;
  position: number;
  fields: FormField[];
};

export type EstimatedMinutes = {
  min: number;
  max?: number;
};

export type OnboardingSchema = {
  id: string;
  schemaVersion: string;
  title: string;
  brandName?: string;
  description?: string;
  estimatedMinutes?: EstimatedMinutes;
  storageKey: string;
  intro: {
    title: string;
    navLabel: string;
    description: string[];
    footnote?: string;
    buttonLabel: string;
  };
  sections: FormSection[];
  success: {
    title: string;
    message: string[];
    closing?: string;
    aside: string;
  };
};

export type OnboardingAnswers = Record<string, unknown>;
