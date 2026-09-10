/**
 * Money in Meerkash is ALWAYS an integer number of centavos.
 * Floating point pesos are never stored, summed, or split — that is the
 * single most common source of "the balances don't add up" bugs.
 */

export type Centavos = number;

export const PESO = 100;

export function isCentavos(v: unknown): v is Centavos {
  return typeof v === 'number' && Number.isInteger(v) && Number.isFinite(v);
}

/** "1,234.56" | 1234.56 -> 123456 centavos. Throws on garbage. */
export function toCentavos(input: string | number): Centavos {
  // Strip everything but digits/sign/decimal point so pasted input carrying
  // any currency symbol (₱, $, €, ...) or thousands separator still parses.
  const raw = typeof input === 'number' ? String(input) : input.trim().replace(/[^-\d.]/g, '');
  if (raw === '' || !/^-?\d*(\.\d*)?$/.test(raw)) {
    throw new Error(`Not a valid peso amount: ${String(input)}`);
  }
  const negative = raw.startsWith('-');
  const [whole, frac = ''] = raw.replace('-', '').split('.');
  const centavos = Number(whole || '0') * PESO + Number((frac + '00').slice(0, 2));
  if (!Number.isSafeInteger(centavos)) throw new Error('Amount out of range');
  return negative ? -centavos : centavos;
}

/** Currency-aware version of formatPHP. `currencyCode` is a 3-letter ISO 4217 code, e.g. 'USD'. */
export function formatMoney(
  centavos: Centavos,
  currencyCode: string,
  opts: { sign?: boolean } = {},
): string {
  const negative = centavos < 0;
  const abs = Math.abs(centavos);
  const body = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode }).format(
    abs / PESO,
  );
  if (negative) return `-${body}`;
  return opts.sign ? `+${body}` : body;
}

/** 123456 -> "₱1,234.56" */
export function formatPHP(centavos: Centavos, opts: { sign?: boolean } = {}): string {
  return formatMoney(centavos, 'PHP', opts);
}

/** 'USD' -> '$', 'PHP' -> '₱', 'EUR' -> '€', ... */
export function currencySymbol(currencyCode: string): string {
  const part = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode })
    .formatToParts(0)
    .find((p) => p.type === 'currency');
  return part?.value ?? currencyCode;
}

/** 123456 -> "1234.56" for <input type="number"> values. */
export function toPesoInput(centavos: Centavos): string {
  return (centavos / PESO).toFixed(2);
}
