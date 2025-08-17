export function isValidDateStr(s?: string|null){
  if(!s) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function safeDateOrToday(date?: string|null, tz: string = "Europe/Warsaw"){
  // If invalid -> return today's date in Europe/Warsaw as YYYY-MM-DD
  if (isValidDateStr(date)) return date as string;
  const now = new Date();
  // convert to Warsaw by taking UTC and adjusting by tz offset (approx; serverless safe)
  // We use Intl to format without installing luxon.
  const fmt = new Intl.DateTimeFormat("pl-PL", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const parts = fmt.formatToParts(now);
  const y = parts.find(p=>p.type==="year")?.value || "1970";
  const m = parts.find(p=>p.type==="month")?.value || "01";
  const d = parts.find(p=>p.type==="day")?.value || "01";
  return `${y}-${m}-${d}`;
}
