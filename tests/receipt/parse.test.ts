import { describe, expect, it } from 'vitest';
import { parseReceiptLineItems, parseReceiptText } from '@/lib/receipt';

describe('parseReceiptText', () => {
  it('picks the largest peso amount as the suggested total', () => {
    const text = 'SM Supermarket\nItem A     50.00\nItem B     25.50\nTOTAL     125.75';
    const result = parseReceiptText(text);
    expect(result.suggestedAmountCentavos).toBe(12575);
  });

  it('uses the first non-blank line as the suggested description', () => {
    const text = '\n  Jollibee Ortigas  \nBurger 89.00\nTOTAL 89.00';
    const result = parseReceiptText(text);
    expect(result.suggestedDescription).toBe('Jollibee Ortigas');
  });

  it('handles amounts with a peso sign and thousands separators', () => {
    const text = 'Grand Total: ₱1,234.56';
    const result = parseReceiptText(text);
    expect(result.suggestedAmountCentavos).toBe(123456);
  });

  it('returns null amount when no money-like pattern is found', () => {
    const result = parseReceiptText('just some receipt text with no numbers');
    expect(result.suggestedAmountCentavos).toBeNull();
  });

  it('returns null description for empty or whitespace-only text', () => {
    expect(parseReceiptText('').suggestedDescription).toBeNull();
    expect(parseReceiptText('   \n  \n ').suggestedDescription).toBeNull();
  });

  it('does not crash on garbage input and always returns the raw text back', () => {
    const result = parseReceiptText('###???$$$');
    expect(result.rawText).toBe('###???$$$');
    expect(result.suggestedAmountCentavos).toBeNull();
  });

  it('truncates an overlong first line to fit the 120-char description limit', () => {
    const longLine = 'A'.repeat(200);
    const result = parseReceiptText(longLine);
    expect(result.suggestedDescription?.length).toBe(120);
  });

  it('ignores whole numbers with more than 2 decimal-like digits as false positives', () => {
    // A reference/receipt number shouldn't be mistaken for money if it has no
    // decimal point and is implausibly large for a peso total.
    const text = 'Ref No: 000123456789\nTotal: 45.00';
    const result = parseReceiptText(text);
    expect(result.suggestedAmountCentavos).toBe(4500);
  });

  it('includes parsed line items on the result', () => {
    const text = 'SM Supermarket\nItem A     50.00\nItem B     25.50\nTOTAL     75.50';
    const result = parseReceiptText(text);
    expect(result.items).toEqual([
      { description: 'Item A', amountCentavos: 5000 },
      { description: 'Item B', amountCentavos: 2550 },
    ]);
  });
});

describe('parseReceiptLineItems', () => {
  it('extracts a description and price from each matching line', () => {
    const text = 'Coffee 120.00\nSandwich 250.50\nBottled Water 45.00';
    expect(parseReceiptLineItems(text)).toEqual([
      { description: 'Coffee', amountCentavos: 12000 },
      { description: 'Sandwich', amountCentavos: 25050 },
      { description: 'Bottled Water', amountCentavos: 4500 },
    ]);
  });

  it('excludes summary lines like total/subtotal/tax so items can be safely summed', () => {
    const text = 'Coffee 120.00\nSubtotal 120.00\nTax 14.40\nTotal 134.40';
    const items = parseReceiptLineItems(text);
    expect(items).toEqual([{ description: 'Coffee', amountCentavos: 12000 }]);
  });

  it('handles a peso sign and thousands separators per line', () => {
    const text = 'Grocery bundle ₱1,234.56';
    expect(parseReceiptLineItems(text)).toEqual([
      { description: 'Grocery bundle', amountCentavos: 123456 },
    ]);
  });

  it('returns an empty array when no line looks like an item', () => {
    expect(parseReceiptLineItems('just some receipt text with no numbers')).toEqual([]);
  });

  it('does not crash on garbage input', () => {
    expect(parseReceiptLineItems('###???$$$')).toEqual([]);
  });

  it('skips lines with a price but no description', () => {
    expect(parseReceiptLineItems('125.75')).toEqual([]);
  });
});
