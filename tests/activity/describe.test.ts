import { describe, expect, it } from 'vitest';
import { describeActivity } from '@/lib/activity';
import type { ActivityEntry } from '@/types/db';

const nameOf = (id: string) => ({ u1: 'Clethers', u2: 'John' })[id] ?? 'Someone';

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return {
    id: 'a1',
    group_id: 'g1',
    actor_id: 'u1',
    action: 'expense.created',
    subject_type: 'expense',
    subject_id: null,
    metadata: {},
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('describeActivity', () => {
  it('describes an expense being added, with amount', () => {
    const text = describeActivity(
      entry({ action: 'expense.created', metadata: { description: 'Dinner', amount_centavos: 100_000 } }),
      nameOf,
      'PHP',
    );
    expect(text).toBe('Clethers added "Dinner" for ₱1,000.00');
  });

  it('describes an edited expense, listing the changed fields', () => {
    const text = describeActivity(
      entry({
        action: 'expense.edited',
        metadata: { description: 'Dinner', changed_fields: ['amount', 'split'] },
      }),
      nameOf,
      'PHP',
    );
    expect(text).toBe('Clethers edited "Dinner" — changed amount, split');
  });

  it('describes a settlement being recorded, naming the recipient', () => {
    const text = describeActivity(
      entry({ action: 'settlement.created', metadata: { amount_centavos: 45_000, to: 'u2' } }),
      nameOf,
      'PHP',
    );
    expect(text).toBe('Clethers recorded a payment of ₱450.00 to John');
  });

  it('describes a member joining the group', () => {
    const text = describeActivity(entry({ action: 'member.joined' }), nameOf, 'PHP');
    expect(text).toBe('Clethers joined the group');
  });

  it('falls back to the raw action for an unrecognised entry', () => {
    const text = describeActivity(entry({ action: 'expense.something_new' }), nameOf, 'PHP');
    expect(text).toBe('Clethers — expense.something_new');
  });
});
