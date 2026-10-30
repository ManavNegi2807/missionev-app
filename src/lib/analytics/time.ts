/** Local-calendar day helpers. A "day" is the epoch-ms of local midnight, so it can be used as a map key. */
export const DAY_MS = 86_400_000;

export const dayStart = (ms: number): number => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const addDays = (day: number, n: number): number => {
  const d = new Date(day);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
};

export const diffDays = (a: number, b: number): number => Math.round((b - a) / DAY_MS);

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** Monday = 0 … Sunday = 6. */
export const weekdayIndex = (day: number): number => (new Date(day).getDay() + 6) % 7;

export const startOfWeek = (day: number): number => addDays(day, -weekdayIndex(day));

export const isoDay = (day: number): string => {
  const d = new Date(day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** Strict yyyy-mm-dd → local-midnight epoch ms, or null when it is not a real calendar date. */
export function parseIsoDay(s: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

export const labelDay = (day: number): string => {
  const d = new Date(day);
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]}`;
};

export const labelDayLong = (day: number): string => {
  const d = new Date(day);
  return `${WEEKDAYS[weekdayIndex(day)]}, ${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

export const labelClock = (ms: number): string => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
};

export const labelDateTime = (ms: number): string => `${labelDay(dayStart(ms))} ${labelClock(ms).slice(0, 5)}`;
