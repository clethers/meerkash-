import { describe, expect, it } from 'vitest';
import { suggestEmailCorrection } from '@/lib/signup/emailSuggest';

describe('suggestEmailCorrection', () => {
  it('suggests gmail.com for a transposed typo', () => {
    expect(suggestEmailCorrection('user@gmial.com')).toBe('user@gmail.com');
  });

  it('suggests yahoo.com for an extra letter', () => {
    expect(suggestEmailCorrection('user@yahooo.com')).toBe('user@yahoo.com');
  });

  it('suggests gmail.com for a missing letter', () => {
    expect(suggestEmailCorrection('user@gmai.com')).toBe('user@gmail.com');
  });

  it('returns null for an exact common-domain match', () => {
    expect(suggestEmailCorrection('user@gmail.com')).toBeNull();
  });

  it('returns null for a domain too different from any common provider', () => {
    expect(suggestEmailCorrection('user@protonmail.com')).toBeNull();
  });

  it('returns null when there is no @ symbol', () => {
    expect(suggestEmailCorrection('notanemail')).toBeNull();
  });

  it('returns null when the domain is empty', () => {
    expect(suggestEmailCorrection('user@')).toBeNull();
  });

  it('preserves the local part in the suggestion', () => {
    expect(suggestEmailCorrection('first.last+tag@hotnail.com')).toBe('first.last+tag@hotmail.com');
  });
});
