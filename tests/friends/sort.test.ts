import { describe, expect, it } from 'vitest';
import { sortFriendsByBalance } from '@/lib/friends';
import type { Profile } from '@/types/db';

function friend(id: string, netCentavos: number): { profile: Profile; netCentavos: number } {
  return {
    profile: {
      id,
      display_name: id,
      username: null,
      avatar_url: null,
      email: null,
      preferred_currency: null,
      payment_qr_url: null,
      created_at: '',
      updated_at: '',
      deleted_at: null,
    },
    netCentavos,
  };
}

describe('sortFriendsByBalance', () => {
  it('puts debts you owe first, biggest debt first', () => {
    const result = sortFriendsByBalance([friend('small-debt', -5_000), friend('big-debt', -45_000)]);
    expect(result.map((f) => f.profile.id)).toEqual(['big-debt', 'small-debt']);
  });

  it('puts credits owed to you after debts, biggest credit first', () => {
    const result = sortFriendsByBalance([friend('small-credit', 5_000), friend('big-credit', 45_000)]);
    expect(result.map((f) => f.profile.id)).toEqual(['big-credit', 'small-credit']);
  });

  it('puts settled friends last, after both debts and credits', () => {
    const result = sortFriendsByBalance([friend('settled', 0), friend('credit', 10_000), friend('debt', -10_000)]);
    expect(result.map((f) => f.profile.id)).toEqual(['debt', 'credit', 'settled']);
  });
});
