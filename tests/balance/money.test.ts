import { describe, expect, it } from 'vitest';
import { formatMoney, formatPHP, toCentavos, toPesoInput } from '@/lib/money';

describe('money', () => {
  it('parses peso strings into centavos', () => {
    expect(toCentavos('1000')).toBe(100_000);
    expect(toCentavos('1,234.56')).toBe(123_456);
    expect(toCentavos('₱ 999.99')).toBe(99_999);
    expect(toCentavos('0.05')).toBe(5);
    expect(toCentavos('0.5')).toBe(50);
    expect(toCentavos(12.3)).toBe(1230);
  });

  it('rejects garbage', () => {
    expect(() => toCentavos('abc')).toThrow();
    expect(() => toCentavos('')).toThrow();
    expect(() => toCentavos('1.2.3')).toThrow();
  });

  it('formats centavos as pesos', () => {
    expect(formatPHP(100_000)).toBe('₱1,000.00');
    expect(formatPHP(20_000)).toBe('₱200.00');
    expect(formatPHP(5)).toBe('₱0.05');
    expect(formatPHP(-25_050)).toBe('-₱250.50');
  });

  it('round-trips through the input format', () => {
    for (const cents of [1, 99, 100, 33_333, 123_456]) {
      expect(toCentavos(toPesoInput(cents))).toBe(cents);
    }
  });
});

describe('formatMoney', () => {
  it('formats PHP identically to formatPHP', () => {
    expect(formatMoney(123_456, 'PHP')).toBe(formatPHP(123_456));
    expect(formatMoney(-123_456, 'PHP')).toBe(formatPHP(-123_456));
    expect(formatMoney(123_456, 'PHP', { sign: true })).toBe(formatPHP(123_456, { sign: true }));
  });

  it('formats USD with a dollar sign', () => {
    expect(formatMoney(123_456, 'USD')).toBe('$1,234.56');
  });

  it('formats EUR with a euro sign', () => {
    expect(formatMoney(123_456, 'EUR')).toBe('€1,234.56');
  });

  it('handles negative amounts', () => {
    expect(formatMoney(-50_000, 'USD')).toBe('-$500.00');
  });

  it('adds a plus sign when requested', () => {
    expect(formatMoney(50_000, 'USD', { sign: true })).toBe('+$500.00');
  });
});
