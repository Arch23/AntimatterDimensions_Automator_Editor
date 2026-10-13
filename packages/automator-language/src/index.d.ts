export interface AutomatorCompletionItem {
  label: string;
  detail: string;
  insertText: string;
  replaceLine?: boolean;
  replaceFrom?: number;
  filterText?: string;
}

export interface AutomatorDiagnostic {
  line: number;
  start: number;
  end: number;
  message: string;
  severity: "error" | "warning" | "info" | "hint";
}

export function completionItems(linePrefix: string): AutomatorCompletionItem[];
export function validate(source: string): AutomatorDiagnostic[];
export function formatScript(source: string, indentSize?: number): string;

export class FormattingError extends Error {
  constructor(message: string);
}
