/**
 * Tiny sessionStorage-backed store compatible with useSyncExternalStore.
 * Values live only for the browser tab session; the in-memory copy is the fallback when storage is blocked.
 */
export function createSessionStore<T>(key: string, empty: T) {
  const listeners = new Set<() => void>();
  let cacheRaw: string | null | undefined;
  let cacheVal: T = empty;

  function getSnapshot(): T {
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return cacheVal;
    }
    if (raw === cacheRaw) return cacheVal;
    cacheRaw = raw;
    try {
      cacheVal = raw ? (JSON.parse(raw) as T) : empty;
    } catch {
      cacheVal = empty;
    }
    return cacheVal;
  }

  function set(value: T) {
    cacheVal = value;
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
      cacheRaw = undefined;
    } catch {
      /* in-memory only */
    }
    listeners.forEach((l) => l());
  }

  function subscribe(cb: () => void) {
    listeners.add(cb);
    window.addEventListener("storage", cb);
    return () => {
      listeners.delete(cb);
      window.removeEventListener("storage", cb);
    };
  }

  return { getSnapshot, getServerSnapshot: () => empty, set, subscribe };
}
