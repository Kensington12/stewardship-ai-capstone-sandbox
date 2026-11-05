// Same shape as InterpretationReport.to_dict() in CONTRACT.md. Don't add fields here.

export type Severity = "info" | "watch" | "concern";

export interface Observation {
  severity: Severity;
  statement: string;
  evidence: string;
}

export interface InterpretationReport {
  source: string;
  dataset_filename: string;
  summary_text: string;
  observations: Observation[];
  sources_consulted: string[];
  integrity_notes: string[];
}
