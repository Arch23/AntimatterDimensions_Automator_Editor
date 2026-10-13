export type AutomatorTokenType =
  | "comment" | "string" | "snippet" | "control" | "command" | "subcommand"
  | "modifier" | "currency" | "constant" | "number" | "range" | "operator" | "punctuation";

export interface AutomatorToken {
  start: number;
  end: number;
  type: AutomatorTokenType;
}

export function tokenizeAutomatorLine(
  line: string,
  options?: { includeSnippets?: boolean }
): AutomatorToken[];
