import {
  CLIENT_COLUMNS,
  FIELD_MAP,
  FIELD_MAP_COLUMNS,
  RESPONSE_COLUMNS,
} from "../onboarding/field-map";
import type { StoredOnboarding } from "../onboarding/types";
import { getSheetsClient, getSheetsConfig } from "./client";

export const SHEET_CLIENTS = "CLIENTS";
export const SHEET_RESPONSES = "ONBOARDING_RESPONSES";
export const SHEET_FIELD_MAP = "FIELD_MAP";

function stringifyCell(value: unknown) {
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value == null) return "";
  return String(value);
}

function parseJsonArray(value: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function rowToObject(headers: string[], row: string[]) {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = row[index] ?? "";
  });
  return record;
}

async function getOrCreateSpreadsheet() {
  const sheets = getSheetsClient();
  const { spreadsheetId } = getSheetsConfig();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const titles = new Set((meta.data.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean));

  const missing = [SHEET_CLIENTS, SHEET_RESPONSES, SHEET_FIELD_MAP].filter((title) => !titles.has(title));
  if (missing.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
  }

  await Promise.all([
    ensureHeader(sheets, spreadsheetId, SHEET_CLIENTS, [...CLIENT_COLUMNS]),
    ensureHeader(sheets, spreadsheetId, SHEET_RESPONSES, [...RESPONSE_COLUMNS]),
    ensureFieldMap(sheets, spreadsheetId),
  ]);

  return { sheets, spreadsheetId };
}

async function ensureHeader(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
  tab: string,
  headers: string[],
) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tab}!1:1`,
  });
  const current = existing.data.values?.[0] ?? [];
  if (current.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${tab}!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [headers] },
    });
  }
}

async function ensureFieldMap(
  sheets: ReturnType<typeof getSheetsClient>,
  spreadsheetId: string,
) {
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_FIELD_MAP}!A1:Z`,
  });
  if ((existing.data.values?.length ?? 0) > 1) return;

  const rows = [
    [...FIELD_MAP_COLUMNS],
    ...FIELD_MAP.map((row) => FIELD_MAP_COLUMNS.map((column) => row[column as keyof typeof row])),
  ];
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_FIELD_MAP}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}

function toResponseRow(record: StoredOnboarding) {
  const data = record as unknown as Record<string, unknown>;
  return RESPONSE_COLUMNS.map((column) => stringifyCell(data[column]));
}

function toClientRow(record: StoredOnboarding) {
  const currentWeight = `${record.weight_value} ${record.weight_unit}`;
  const map: Record<string, unknown> = {
    submission_id: record.submission_id,
    submitted_at: record.submitted_at,
    full_name: record.full_name,
    email: record.email,
    phone: record.phone,
    date_of_birth: record.date_of_birth,
    current_weight: currentWeight,
    primary_goal: record.primary_goal,
    training_experience: record.training_experience,
    training_days_available: record.training_days_available,
    training_location: record.training_location,
    health_flag: record.health_flag,
    sleep_duration: record.sleep_duration,
    stress_level: record.stress_level,
    feedback_preference: record.feedback_preference,
    onboarding_status: record.onboarding_status,
    coach_notes: record.coach_notes,
    coach_review_needed: record.coach_review_needed,
  };
  return CLIENT_COLUMNS.map((column) => stringifyCell(map[column]));
}

function parseStored(row: Record<string, string>, notes = ""): StoredOnboarding {
  return {
    submission_id: row.submission_id,
    submitted_at: row.submitted_at,
    schema_version: row.schema_version,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    date_of_birth: row.date_of_birth,
    sex: row.sex as StoredOnboarding["sex"],
    height_value: row.height_value,
    height_unit: row.height_unit as StoredOnboarding["height_unit"],
    height_inches: row.height_inches,
    weight_value: row.weight_value,
    weight_unit: row.weight_unit as StoredOnboarding["weight_unit"],
    occupation: row.occupation,
    activity_level: row.activity_level as StoredOnboarding["activity_level"],
    average_steps: row.average_steps as StoredOnboarding["average_steps"],
    current_injuries: row.current_injuries as StoredOnboarding["current_injuries"],
    current_injury_details: row.current_injury_details,
    previous_injuries: row.previous_injuries as StoredOnboarding["previous_injuries"],
    previous_injury_details: row.previous_injury_details,
    surgeries: row.surgeries as StoredOnboarding["surgeries"],
    surgery_details: row.surgery_details,
    exercise_restrictions: row.exercise_restrictions as StoredOnboarding["exercise_restrictions"],
    exercise_restriction_details: row.exercise_restriction_details,
    medical_conditions: row.medical_conditions as StoredOnboarding["medical_conditions"],
    medical_condition_details: row.medical_condition_details,
    medications: row.medications as StoredOnboarding["medications"],
    medication_details: row.medication_details,
    pregnancy_considerations: row.pregnancy_considerations as StoredOnboarding["pregnancy_considerations"],
    health_additional_notes: row.health_additional_notes,
    health_acknowledgement: row.health_acknowledgement === "TRUE",
    training_experience: row.training_experience as StoredOnboarding["training_experience"],
    current_training_days: row.current_training_days,
    current_training_description: row.current_training_description,
    structured_program_experience: row.structured_program_experience as StoredOnboarding["structured_program_experience"],
    confident_exercises: row.confident_exercises,
    uncertain_exercises: row.uncertain_exercises,
    disliked_exercises: row.disliked_exercises,
    preferred_exercises: row.preferred_exercises,
    training_days_available: row.training_days_available as StoredOnboarding["training_days_available"],
    available_days: parseJsonArray(row.available_days) as StoredOnboarding["available_days"],
    session_duration: row.session_duration as StoredOnboarding["session_duration"],
    training_location: row.training_location as StoredOnboarding["training_location"],
    gym_name: row.gym_name,
    equipment_access: parseJsonArray(row.equipment_access) as StoredOnboarding["equipment_access"],
    in_person_location_preference: row.in_person_location_preference,
    primary_goal: row.primary_goal,
    secondary_goals: parseJsonArray(row.secondary_goals) as StoredOnboarding["secondary_goals"],
    goal_changes: row.goal_changes as StoredOnboarding["goal_changes"],
    goal_change_details: row.goal_change_details,
    current_eating: row.current_eating as StoredOnboarding["current_eating"],
    meals_per_day: row.meals_per_day,
    typical_breakfast: row.typical_breakfast,
    typical_lunch: row.typical_lunch,
    typical_dinner: row.typical_dinner,
    typical_snacks: row.typical_snacks,
    typical_drinks: row.typical_drinks,
    calorie_tracking: row.calorie_tracking as StoredOnboarding["calorie_tracking"],
    current_calories: row.current_calories,
    current_protein: row.current_protein,
    current_carbs: row.current_carbs,
    current_fat: row.current_fat,
    food_allergies: row.food_allergies as StoredOnboarding["food_allergies"],
    food_allergy_details: row.food_allergy_details,
    dietary_restrictions: parseJsonArray(row.dietary_restrictions) as StoredOnboarding["dietary_restrictions"],
    dietary_restriction_details: row.dietary_restriction_details,
    preferred_foods: row.preferred_foods,
    disliked_foods: row.disliked_foods,
    takeout_frequency: row.takeout_frequency as StoredOnboarding["takeout_frequency"],
    water_intake: row.water_intake,
    alcohol_frequency: row.alcohol_frequency as StoredOnboarding["alcohol_frequency"],
    weight_change_history: row.weight_change_history as StoredOnboarding["weight_change_history"],
    weight_change_details: row.weight_change_details,
    sleep_duration: row.sleep_duration as StoredOnboarding["sleep_duration"],
    sleep_quality: Number(row.sleep_quality),
    stress_level: Number(row.stress_level),
    stress_sources: row.stress_sources,
    work_schedule: row.work_schedule as StoredOnboarding["work_schedule"],
    work_schedule_details: row.work_schedule_details,
    schedule_challenges: row.schedule_challenges,
    progress_methods: parseJsonArray(row.progress_methods) as StoredOnboarding["progress_methods"],
    progress_photos: row.progress_photos as StoredOnboarding["progress_photos"],
    feedback_preference: parseJsonArray(row.feedback_preference) as StoredOnboarding["feedback_preference"],
    consistency_challenges: row.consistency_challenges,
    fall_off_causes: row.fall_off_causes,
    coaching_dislikes: row.coaching_dislikes,
    coaching_concerns: row.coaching_concerns,
    additional_notes: row.additional_notes,
    accuracy_acknowledgement: row.accuracy_acknowledgement === "TRUE",
    coach_review_needed: row.coach_review_needed === "TRUE",
    health_flag: row.health_flag,
    health_flag_reasons: parseJsonArray(row.health_flag_reasons) as string[],
    onboarding_status: row.onboarding_status,
    coach_notes: notes,
  };
}

export async function saveOnboarding(record: StoredOnboarding) {
  const { sheets, spreadsheetId } = await getOrCreateSpreadsheet();
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_RESPONSES}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [toResponseRow(record)] },
  });
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${SHEET_CLIENTS}!A1`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [toClientRow(record)] },
  });
}

export async function listOnboardingResponses() {
  const { sheets, spreadsheetId } = await getOrCreateSpreadsheet();
  const [responses, clients] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RESPONSES}!A1:ZZ`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_CLIENTS}!A1:Z`,
    }),
  ]);
  const [responseHeaders, ...responseRows] = responses.data.values ?? [];
  if (!responseHeaders) return [];
  const [clientHeaders, ...clientRows] = clients.data.values ?? [];
  const notesById = new Map<string, string>();
  if (clientHeaders) {
    for (const row of clientRows) {
      const record = rowToObject(clientHeaders, row.map(String));
      if (record.submission_id) notesById.set(record.submission_id, record.coach_notes ?? "");
    }
  }
  return responseRows
    .map((row) => rowToObject(responseHeaders, row.map(String)))
    .filter((row) => row.submission_id)
    .map((row) => parseStored(row, notesById.get(row.submission_id) ?? ""));
}

export async function listClients() {
  const { sheets, spreadsheetId } = await getOrCreateSpreadsheet();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_CLIENTS}!A1:Z`,
  });
  const [headers, ...rows] = result.data.values ?? [];
  if (!headers) return [];
  return rows
    .map((row) => rowToObject(headers, row.map(String)))
    .filter((row) => row.submission_id)
    .reverse();
}

export async function getOnboarding(submissionId: string) {
  const { sheets, spreadsheetId } = await getOrCreateSpreadsheet();
  const [responses, clients] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_RESPONSES}!A1:ZZ`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET_CLIENTS}!A1:Z`,
    }),
  ]);

  const [responseHeaders, ...responseRows] = responses.data.values ?? [];
  if (!responseHeaders) return null;
  const match = responseRows
    .map((row) => rowToObject(responseHeaders, row.map(String)))
    .find((row) => row.submission_id === submissionId);
  if (!match) return null;

  const [clientHeaders, ...clientRows] = clients.data.values ?? [];
  const client = clientHeaders
    ? clientRows.map((row) => rowToObject(clientHeaders, row.map(String))).find((row) => row.submission_id === submissionId)
    : undefined;

  return parseStored(match, client?.coach_notes ?? "");
}

export async function updateCoachNotes(submissionId: string, notes: string) {
  const { sheets, spreadsheetId } = await getOrCreateSpreadsheet();
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${SHEET_CLIENTS}!A1:Z`,
  });
  const [headers, ...rows] = result.data.values ?? [];
  if (!headers) throw new Error("CLIENTS sheet is empty.");
  const idIndex = headers.indexOf("submission_id");
  const notesIndex = headers.indexOf("coach_notes");
  const rowIndex = rows.findIndex((row) => row[idIndex] === submissionId);
  if (rowIndex < 0) throw new Error("Submission not found.");
  const column = String.fromCharCode("A".charCodeAt(0) + notesIndex);
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${SHEET_CLIENTS}!${column}${rowIndex + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [[notes]] },
  });
}
