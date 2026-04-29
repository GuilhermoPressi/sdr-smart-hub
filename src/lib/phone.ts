export function formatPhoneBR(raw: string): string {
  // Accepts "+55 11 98765-4321" or "5511987654321" etc and normalizes to +55 DDD NNNNN-NNNN
  const digits = raw.replace(/\D/g, "");
  let national = digits;
  if (digits.startsWith("55") && digits.length >= 12) national = digits.slice(2);
  if (national.length < 10) return raw;
  const ddd = national.slice(0, 2);
  const rest = national.slice(2);
  const first = rest.slice(0, rest.length - 4);
  const last = rest.slice(-4);
  return `+55 ${ddd} ${first}-${last}`;
}
