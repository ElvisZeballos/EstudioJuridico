export function isValidUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}