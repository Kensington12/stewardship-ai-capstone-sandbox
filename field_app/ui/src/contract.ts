// TypeScript mirror of the data contract (see ../../../CONTRACT.md).
// Matches InterpretationReport.to_dict() from sandbox_engine exactly.

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
