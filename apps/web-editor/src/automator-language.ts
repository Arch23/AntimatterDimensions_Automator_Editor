import { StreamLanguage } from "@codemirror/language";
import { tokenizeAutomatorLine, type AutomatorTokenType } from "@adme/automator-language/highlighting";

interface AutomatorState {
  blockDepth: number;
}

const styleFor: Partial<Record<AutomatorTokenType, string>> = {
  comment: "comment",
  string: "string",
  control: "keyword",
  command: "definitionKeyword",
  subcommand: "keyword",
  modifier: "modifier",
  currency: "typeName",
  constant: "atom",
  number: "number",
  range: "number",
  operator: "operator",
  punctuation: "punctuation"
};

export const automatorLanguage = StreamLanguage.define<AutomatorState>({
  name: "automator",
  startState: () => ({ blockDepth: 0 }),
  languageData: {
    commentTokens: { line: "#" },
    closeBrackets: { brackets: ["{", '"'] },
    indentOnInput: /^\s*\}/
  },
  token(stream, state) {
    if (stream.eatSpace()) return null;
    const token = tokenizeAutomatorLine(stream.string).find(item => item.start === stream.pos);
    if (!token) {
      stream.next();
      return null;
    }
    stream.pos = token.end;
    if (token.type === "punctuation" && stream.string[token.start] === "{") state.blockDepth++;
    if (token.type === "punctuation" && stream.string[token.start] === "}") {
      state.blockDepth = Math.max(0, state.blockDepth - 1);
    }
    return styleFor[token.type] ?? null;
  },
  indent(state, textAfter, context) {
    const closingBrace = /^\s*\}/.test(textAfter);
    return Math.max(0, state.blockDepth - (closingBrace ? 1 : 0)) * context.unit;
  }
});
