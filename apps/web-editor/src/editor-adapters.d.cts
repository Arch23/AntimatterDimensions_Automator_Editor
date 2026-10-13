import type { AutomatorCompletionItem, AutomatorDiagnostic } from "@adme/automator-language";

export function completionStart(linePrefix: string, lineFrom: number, item: AutomatorCompletionItem): number;
export function completionFilterText(item: AutomatorCompletionItem, query: string): string | undefined;
export function diagnosticRange(line: { from: number; length: number }, diagnostic: AutomatorDiagnostic): {
  from: number;
  to: number;
};
