import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function escapeCSV(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r'))
    return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

/** Formats a Unix-ms timestamp as "YYYY-MM" for chart X-axis ticks. */
export function fmtMonthYear(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
