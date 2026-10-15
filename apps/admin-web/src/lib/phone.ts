/**
 * Phone and WhatsApp utility functions for admin-web.
 * Handles local Syrian phone numbers (09XXXXXXXX) and converts them to
 * the international format required by WhatsApp (9639XXXXXXXX).
 */

export function cleanWhatsappDigits(phone: string | null | undefined): string | null {
  if (!phone || typeof phone !== 'string') return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Remove whitespace, dashes, parentheses
  let cleaned = trimmed.replace(/[\s\-\(\)]/g, '');

  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Syrian local mobile: 09XXXXXXXX (10 digits) -> 9639XXXXXXXX (12 digits)
  if (cleaned.startsWith('09') && cleaned.length === 10) {
    cleaned = '963' + cleaned.substring(1);
  }

  // Basic sanity check: international phone should be 9 to 15 digits
  if (!/^\d{9,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

export function formatWhatsappUrl(
  phone: string | null | undefined,
  text?: string
): string | null {
  const digits = cleanWhatsappDigits(phone);
  if (!digits) return null;

  const baseUrl = `https://wa.me/${digits}`;
  return text ? `${baseUrl}?text=${encodeURIComponent(text)}` : baseUrl;
}
