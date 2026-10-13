const draftKey = "adme.automator-web-editor.draft.v1";

export interface Draft {
  text: string;
  savedAt: number;
}

export type DraftReadResult =
  | { draft: Draft | null; error?: never }
  | { draft: null; error: string };

export function readDraft(): DraftReadResult {
  try {
    const stored = window.localStorage.getItem(draftKey);
    if (stored === null) return { draft: null };
    const parsed: unknown = JSON.parse(stored);
    if (!parsed || typeof parsed !== "object" ||
      typeof (parsed as Draft).text !== "string" ||
      typeof (parsed as Draft).savedAt !== "number") {
      return { draft: null, error: "The saved browser draft could not be read." };
    }
    return { draft: { text: (parsed as Draft).text, savedAt: (parsed as Draft).savedAt } };
  } catch {
    return { draft: null, error: "Browser storage is unavailable; this session will not be saved locally." };
  }
}

export function writeDraft(text: string): { saved: true } | { saved: false; error: string } {
  try {
    window.localStorage.setItem(draftKey, JSON.stringify({ text, savedAt: Date.now() } satisfies Draft));
    return { saved: true };
  } catch {
    return { saved: false, error: "Could not save the local draft. Your current editor content is still available." };
  }
}
