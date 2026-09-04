export type TimeZone = "morning" | "afternoon" | "evening" | "night";

export function getTimeZoneFromDate(date: Date): TimeZone {
  const hour = date.getHours();
  if (hour >= 6 && hour < 12) return "morning";
  if (hour >= 12 && hour < 18) return "afternoon";
  if (hour >= 18 && hour < 24) return "evening";
  return "night";
}

export function getCurrentTimeZone(): TimeZone {
  return getTimeZoneFromDate(new Date());
}
