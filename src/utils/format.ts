/// English relative time ("5 minutes ago", "about an hour ago", ...).
export function timeAgo(date: Date, now: Date = new Date()): string {
  const seconds = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  const minutes = seconds / 60;
  const hours = minutes / 60;
  const days = hours / 24;
  const months = days / 30;
  const years = days / 365;

  let result: string;
  if (seconds < 45) result = 'a moment';
  else if (seconds < 90) result = 'a minute';
  else if (minutes < 45) result = `${Math.round(minutes)} minutes`;
  else if (minutes < 90) result = 'about an hour';
  else if (hours < 24) result = `${Math.round(hours)} hours`;
  else if (hours < 48) result = 'a day';
  else if (days < 30) result = `${Math.round(days)} days`;
  else if (days < 60) result = 'about a month';
  else if (days < 365) result = `${Math.round(months)} months`;
  else if (years < 2) result = 'about a year';
  else result = `${Math.round(years)} years`;
  return `${result} ago`;
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatCount(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${thousands.toFixed(thousands >= 10 ? 0 : 1)}k`;
  }
  return String(value);
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => p.length > 0);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].substring(0, 1).toUpperCase();
  return (parts[0].substring(0, 1) + parts[parts.length - 1].substring(0, 1)).toUpperCase();
}
