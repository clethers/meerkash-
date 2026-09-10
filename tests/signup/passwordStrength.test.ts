import { describe, expect, it } from 'vitest';
import { scorePassword } from '@/lib/signup/passwordStrength';

describe('scorePassword', () => {
  it('scores an empty password as weak with nothing checked', () => {
    const result = scorePassword('');
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
    expect(result.checks).toEqual({
      minLength: false,
      hasUpper: false,
      hasLower: false,
      hasNumber: false,
      hasSymbol: false,
      notCommon: true,
    });
  });

  it('scores a too-short password as weak even with mixed characters', () => {
    const result = scorePassword('Ab1!');
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
    expect(result.checks.minLength).toBe(false);
  });

  it('flags a well-known common password as weak regardless of length', () => {
    const result = scorePassword('password');
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.notCommon).toBe(false);
    expect(result.score).toBe(0);
    expect(result.label).toBe('weak');
  });

  it('scores a long password with only lowercase letters as weak', () => {
    const result = scorePassword('correcthorse');
    expect(result.checks.minLength).toBe(true);
    expect(result.checks.hasLower).toBe(true);
    expect(result.checks.hasUpper).toBe(false);
    expect(result.score).toBe(1);
    expect(result.label).toBe('weak');
  });

  it('scores length + two character classes as fair', () => {
    const result = scorePassword('correctHorse');
    expect(result.checks.hasUpper).toBe(true);
    expect(result.checks.hasLower).toBe(true);
    expect(result.checks.hasNumber).toBe(false);
    expect(result.score).toBe(2);
    expect(result.label).toBe('fair');
  });

  it('scores length + three character classes as good', () => {
    const result = scorePassword('correctHorse9');
    expect(result.score).toBe(3);
    expect(result.label).toBe('good');
  });

  it('scores length + all four character classes as strong', () => {
    const result = scorePassword('correctHorse9!');
    expect(result.checks).toEqual({
      minLength: true,
      hasUpper: true,
      hasLower: true,
      hasNumber: true,
      hasSymbol: true,
      notCommon: true,
    });
    expect(result.score).toBe(4);
    expect(result.label).toBe('strong');
  });

  it('is case-insensitive when matching the common-password list', () => {
    const result = scorePassword('PASSWORD1');
    expect(result.checks.notCommon).toBe(false);
  });
});
