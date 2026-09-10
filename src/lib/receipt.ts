import { toCentavos, type Centavos } from '@/lib/money';

/**
 * Heuristic extraction from raw OCR text, not a real receipt parser — good
 * enough to prefill an expense form, always meant to be reviewed/edited by
 * a person before saving.
 */
export interface ReceiptLineItem {
  description: string;
  amountCentavos: Centavos;
}

export interface ReceiptScanResult {
  rawText: string;
  suggestedAmountCentavos: Centavos | null;
  suggestedDescription: string | null;
  items: ReceiptLineItem[];
}

// Requires either a peso prefix or a 2-decimal-place fraction, on purpose:
// a bare long integer (a reference/receipt number) must never be mistaken
// for a peso amount.
const MONEY_PATTERN = /₱\s?[\d,]+(?:\.\d{2})?|\b\d{1,3}(?:,\d{3})*\.\d{2}\b/g;

// A line item line ends in a price; the description is whatever precedes it.
const LINE_ITEM_PATTERN = /^(.+?)\s+(₱\s?[\d,]+(?:\.\d{2})?|\d{1,3}(?:,\d{3})*\.\d{2})\s*$/;

// Summary lines (total/tax/change/...) repeat a price already counted by the
// items above them — including them would double-count when items are summed.
const SUMMARY_LINE = /\b(total|subtotal|sub-total|tax|vat|change|cash|amount due|balance)\b/i;

/** Per-line "<description> <price>" heuristic — one entry per matching line, in receipt order. */
export function parseReceiptLineItems(rawText: string): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  for (const rawLine of rawText.split('\n')) {
    const match = rawLine.trim().match(LINE_ITEM_PATTERN);
    if (!match) continue;
    const [, descriptionPart, pricePart] = match;
    const description = descriptionPart.trim();
    if (!description || SUMMARY_LINE.test(description)) continue;
    try {
      const amountCentavos = toCentavos(pricePart);
      if (amountCentavos > 0) items.push({ description: description.slice(0, 120), amountCentavos });
    } catch {
      // Matched the pattern but isn't actually a valid amount — skip it.
    }
  }
  return items;
}

/** The largest valid amount on a receipt is usually its total. */
export function parseReceiptText(rawText: string): ReceiptScanResult {
  const matches = rawText.match(MONEY_PATTERN) ?? [];
  let suggestedAmountCentavos: Centavos | null = null;
  for (const match of matches) {
    try {
      const centavos = toCentavos(match);
      if (centavos > 0 && (suggestedAmountCentavos === null || centavos > suggestedAmountCentavos)) {
        suggestedAmountCentavos = centavos;
      }
    } catch {
      // Matched the pattern but isn't actually a valid amount — skip it.
    }
  }

  const firstLine = rawText.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? null;
  const suggestedDescription = firstLine ? firstLine.slice(0, 120) : null;

  return { rawText, suggestedAmountCentavos, suggestedDescription, items: parseReceiptLineItems(rawText) };
}
