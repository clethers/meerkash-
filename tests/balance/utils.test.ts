import { describe, expect, it } from 'vitest';
import { avatarColor, initials, suggestGroupName } from '@/lib/utils';

describe('suggestGroupName (requirement 3)', () => {
  it('names a pair the way the spec shows', () => {
    expect(suggestGroupName(['Clethers', 'John'])).toBe('Clethers & John');
  });
  it('handles one, three and many members', () => {
    expect(suggestGroupName(['Clethers'])).toBe("Clethers's group");
    expect(suggestGroupName(['Clethers', 'John', 'Mark'])).toBe('Clethers, John & Mark');
    expect(suggestGroupName(['Clethers', 'John', 'Mark', 'Sarah', 'Ana'])).toBe(
      'Clethers, John & 3 others',
    );
  });
  it('uses first names only', () => {
    expect(suggestGroupName(['Clethers Buenaflor', 'John Cruz'])).toBe('Clethers & John');
  });
  it('falls back for an empty group', () => {
    expect(suggestGroupName([])).toBe('New group');
  });
});

describe('initials', () => {
  it('builds avatar initials', () => {
    expect(initials('Clethers Buenaflor')).toBe('CB');
    expect(initials('John')).toBe('JO');
    expect(initials('   ')).toBe('?');
  });
});

describe('avatarColor', () => {
  it('is stable for the same seed', () => {
    expect(avatarColor('clethers')).toBe(avatarColor('clethers'));
  });
});

describe('recurring schedule (requirement 30)', () => {
  it('advances each frequency correctly', async () => {
    const { advance, isDue } = await import('@/lib/recurring');
    expect(isDue('2020-01-01')).toBe(true);
    expect(isDue('2999-01-01')).toBe(false);
    expect(advance('2026-01-31', 'daily')).toBe('2026-02-01');
    expect(advance('2026-01-01', 'weekly')).toBe('2026-01-08');
    expect(advance('2026-01-15', 'monthly')).toBe('2026-02-15');
    expect(advance('2026-02-29', 'yearly')).toBe('2027-03-01');
  });
});
