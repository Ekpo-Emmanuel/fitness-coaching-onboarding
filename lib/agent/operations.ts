import type { ClientIdentityMapping } from "@/lib/forms/identity";
import type {
  Condition,
  ConditionalLogic,
  EstimatedMinutes,
  FieldOption,
  FieldType,
  FieldValidation,
} from "@/lib/onboarding/schema/types";

export type AgentOperation =
  | {
      type: "update_form_metadata";
      title?: string;
      description?: string;
      estimatedMinutes?: EstimatedMinutes;
      formName?: string;
    }
  | {
      type: "update_intro";
      title?: string;
      navLabel?: string;
      description?: string[];
      buttonLabel?: string;
      footnote?: string;
    }
  | {
      type: "update_success";
      title?: string;
      message?: string[];
      aside?: string;
      closing?: string;
    }
  | {
      type: "create_section";
      tempRef: string;
      title: string;
      key?: string;
      navLabel?: string;
      description?: string;
    }
  | {
      type: "update_section";
      sectionId?: string;
      sectionRef?: string;
      title?: string;
      navLabel?: string;
      description?: string;
      footer?: string;
    }
  | {
      type: "delete_section";
      sectionId?: string;
      sectionRef?: string;
      sectionIndex?: number;
    }
  | {
      type: "move_section";
      sectionId?: string;
      sectionRef?: string;
      toIndex: number;
    }
  | {
      type: "create_field";
      tempRef?: string;
      sectionId?: string;
      sectionRef?: string;
      fieldType: FieldType;
      label: string;
      key?: string;
      required?: boolean;
      description?: string;
      statement?: string;
      options?: FieldOption[];
      validation?: FieldValidation;
      logic?: ConditionalLogic;
      toIndex?: number;
      afterFieldRef?: string;
      beforeFieldRef?: string;
      replaceFieldRef?: string;
    }
  | {
      type: "update_field";
      fieldId?: string;
      fieldRef?: string;
      sectionRef?: string;
      label?: string;
      required?: boolean;
      description?: string;
      statement?: string;
      placeholder?: string;
      fieldType?: FieldType;
    }
  | {
      type: "delete_field";
      fieldId?: string;
      fieldRef?: string;
      sectionRef?: string;
    }
  | {
      type: "move_field";
      fieldId?: string;
      fieldRef?: string;
      sectionId?: string;
      sectionRef?: string;
      toIndex: number;
    }
  | {
      type: "set_field_options";
      fieldId?: string;
      fieldRef?: string;
      options: FieldOption[];
    }
  | {
      type: "set_field_validation";
      fieldId?: string;
      fieldRef?: string;
      validation: FieldValidation | null;
    }
  | {
      type: "set_field_logic";
      fieldId?: string;
      fieldRef?: string;
      logic: ConditionalLogic | null;
    }
  | {
      type: "set_client_identity_mapping";
      mapping: ClientIdentityMapping | null;
    }
  | {
      type: "create_review_rule";
      tempRef?: string;
      code?: string;
      label: string;
      conditions: {
        all?: Condition[];
        any?: Condition[];
      };
      sourceFieldKeys: string[];
    }
  | {
      type: "update_review_rule";
      ruleId?: string;
      ruleRef?: string;
      code?: string;
      label?: string;
      conditions?: {
        all?: Condition[];
        any?: Condition[];
      };
      sourceFieldKeys?: string[];
    }
  | {
      type: "delete_review_rule";
      ruleId?: string;
      ruleRef?: string;
    };

export const AGENT_OPERATION_TYPES: AgentOperation["type"][] = [
  "update_form_metadata",
  "update_intro",
  "update_success",
  "create_section",
  "update_section",
  "delete_section",
  "move_section",
  "create_field",
  "update_field",
  "delete_field",
  "move_field",
  "set_field_options",
  "set_field_validation",
  "set_field_logic",
  "set_client_identity_mapping",
  "create_review_rule",
  "update_review_rule",
  "delete_review_rule",
];
