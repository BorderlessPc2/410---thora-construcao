const SESSION_KEY = "abc-analysis-upload-ids";

export function loadAbcAnalysisUploadIds(): string[] {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveAbcAnalysisUploadIds(ids: string[]): void {
  const unique = [...new Set(ids.filter((id) => id && !id.startsWith("pending-")))];
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(unique));
}

export function appendAbcAnalysisUploadId(uploadId: string): void {
  if (!uploadId || uploadId.startsWith("pending-")) return;
  const ids = loadAbcAnalysisUploadIds();
  if (!ids.includes(uploadId)) {
    saveAbcAnalysisUploadIds([...ids, uploadId]);
  }
}
