import 'server-only';
import type { Centavos } from '@/lib/money';

const FRANKFURTER_BASE = 'https://api.frankfurter.app';
const CACHE_TTL_MS = 60 * 60 * 1000;

type RateTable = Record<string, number>;

const rateCache = new Map<string, { rates: RateTable; fetchedAt: number }>();

async function getRatesFrom(base: string): Promise<RateTable | null> {
  const cached = rateCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.rates;

  try {
    const res = await fetch(`${FRANKFURTER_BASE}/latest?from=${encodeURIComponent(base)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: RateTable };
    if (!data.rates) return null;

    const rates: RateTable = { ...data.rates, [base]: 1 };
    rateCache.set(base, { rates, fetchedAt: Date.now() });
    return rates;
  } catch {
    return null;
  }
}

/**
 * Converts a centavos amount between two ISO currency codes using ECB
 * reference rates (via frankfurter.app, ~30 major currencies). Returns null
 * — never throws — when either currency isn't covered by that rate source,
 * so callers can drop unsupported currencies from a display-only total
 * instead of failing the whole page.
 */
export async function convertCentavos(
  amount: Centavos,
  from: string,
  to: string,
): Promise<Centavos | null> {
  if (from === to) return amount;
  const rates = await getRatesFrom(from);
  const rate = rates?.[to];
  if (rate == null) return null;
  return Math.round(amount * rate);
}
