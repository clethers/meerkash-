// A small, real subset of the most common leaked passwords (RockYou-derived).
// Checked case-insensitively — this is a "don't use an obviously weak
// password" guard, not an exhaustive breach-database lookup.
const COMMON_PASSWORDS = new Set([
  'password', '123456', '123456789', '12345678', '12345', '1234567',
  'qwerty', 'abc123', 'password1', '111111', '123123', '1234567890',
  'iloveyou', '1q2w3e4r', '000000', 'qwerty123', 'zaq1zaq1', 'dragon',
  'sunshine', 'princess', 'letmein', 'monkey', 'football', 'shadow',
  'master', '654321', 'superman', 'michael', 'ashley', 'bailey',
  'passw0rd', 'shadow1', '121212', '123321', 'welcome', 'admin', 'login',
  'starwars', 'trustno1', 'freedom', 'whatever', 'qazwsx', 'hello123',
  'hunter2', 'batman', 'jennifer', 'jordan23', 'michelle', 'charlie',
  'daniel', 'andrea', 'samsung', 'computer', 'internet', 'service',
  'secret', 'summer', 'ninja', 'azerty', 'harley', 'ranger', 'iloveyou1',
  'tigger', 'robert', 'matthew', 'hockey', 'thomas', 'minecraft',
  'amanda', 'love123', 'jasmine', 'taylor', 'jessica', 'joshua',
  'mustang', 'hannah', 'buster', 'soccer', 'hello', 'pepper', 'snoopy',
  'cookie', 'george', 'midnight', 'ginger', 'william', 'orange',
  'banana', 'purple', 'killer', 'phoenix', 'pokemon', 'dolphin',
  'biteme', 'gateway', 'fuckyou', 'access', 'chelsea', 'black',
  'diamond', 'football1', 'baseball', 'softball', 'corvette',
]);

export interface PasswordChecks {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSymbol: boolean;
  notCommon: boolean;
}

export type PasswordStrengthLabel = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;
  label: PasswordStrengthLabel;
  checks: PasswordChecks;
}

const LABELS: PasswordStrengthLabel[] = ['weak', 'weak', 'fair', 'good', 'strong'];

export function scorePassword(password: string): PasswordStrength {
  const checks: PasswordChecks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSymbol: /[^A-Za-z0-9]/.test(password),
    notCommon: !COMMON_PASSWORDS.has(password.toLowerCase()),
  };

  let score: 0 | 1 | 2 | 3 | 4 = 0;
  if (checks.minLength && checks.notCommon) {
    score = [checks.hasUpper, checks.hasLower, checks.hasNumber, checks.hasSymbol]
      .filter(Boolean).length as 0 | 1 | 2 | 3 | 4;
  }

  return { score, label: LABELS[score], checks };
}
