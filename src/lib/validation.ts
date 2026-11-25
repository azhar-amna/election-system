export const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const PHONE_PATTERN = /^[+\d][\d\s()-]{6,19}$/;
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const ALLOWED_SYMBOL_MIME_TYPES = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
} as const;

export type AllowedSymbolMimeType = keyof typeof ALLOWED_SYMBOL_MIME_TYPES;

export const ALLOWED_SYMBOL_ACCEPT = "image/png,image/jpeg,image/webp";

export function formatCnic(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export function isValidCnic(value: string): boolean {
  return CNIC_PATTERN.test(value.trim());
}

export function isValidEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= 254 && EMAIL_PATTERN.test(trimmed);
}

export function isValidPhone(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 7 && trimmed.length <= 20 && PHONE_PATTERN.test(trimmed);
}

export function parsePositiveInt(
  value: string | number | null | undefined
): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function isValidIsoDate(value: string): boolean {
  const trimmed = value.trim();
  if (!ISO_DATE_PATTERN.test(trimmed)) return false;
  const [year, month, day] = trimmed.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isValidPastDate(value: string): boolean {
  if (!isValidIsoDate(value)) return false;
  const [year, month, day] = value.trim().split("-").map(Number);
  if (year < 1900) return false;
  const date = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return date <= today;
}

export function getAllowedSymbolExtension(mimeType: string): string | null {
  const normalized = mimeType.toLowerCase();
  if (normalized in ALLOWED_SYMBOL_MIME_TYPES) {
    return ALLOWED_SYMBOL_MIME_TYPES[normalized as AllowedSymbolMimeType];
  }
  return null;
}

export function sanitizePublicError(
  error: { code?: string; message?: string } | null | undefined,
  fallback: string
): string {
  if (!error) return fallback;
  switch (error.code) {
    case "42501":
      return "You do not have permission to perform this action.";
    case "23505":
      return "This record already exists.";
    case "23503":
      return "This action references a related record that cannot be modified.";
    case "22P02":
      return "Invalid input format provided.";
    default:
      return fallback;
  }
}
