const ACTIVE_KEY = "abc-active-upload-ids";
const NOTIFIED_KEY = "abc-notified-upload-ids";

export function trackAbcBackgroundJob(uploadId: string): void {
  const ids = loadActiveAbcJobs();
  if (!ids.includes(uploadId)) {
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify([...ids, uploadId]));
  }
}

export function untrackAbcBackgroundJob(uploadId: string): void {
  const ids = loadActiveAbcJobs().filter((id) => id !== uploadId);
  if (ids.length > 0) {
    sessionStorage.setItem(ACTIVE_KEY, JSON.stringify(ids));
  } else {
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

export function loadActiveAbcJobs(): string[] {
  try {
    const raw = sessionStorage.getItem(ACTIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function markAbcJobNotified(uploadId: string): void {
  const ids = loadNotifiedAbcJobs();
  if (!ids.includes(uploadId)) {
    sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids, uploadId]));
  }
}

export function wasAbcJobNotified(uploadId: string): boolean {
  return loadNotifiedAbcJobs().includes(uploadId);
}

function loadNotifiedAbcJobs(): string[] {
  try {
    const raw = sessionStorage.getItem(NOTIFIED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}
