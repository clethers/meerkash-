// src/components/auth/PasswordField.tsx
'use client';

import { useState } from 'react';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { scorePassword, type PasswordChecks } from '@/lib/signup/passwordStrength';

const REQUIREMENTS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'minLength', label: 'At least 8 characters' },
  { key: 'hasUpper', label: 'One uppercase letter' },
  { key: 'hasLower', label: 'One lowercase letter' },
  { key: 'hasNumber', label: 'One number' },
  { key: 'hasSymbol', label: 'One symbol' },
];

const STRENGTH_COLOR: Record<string, string> = {
  weak: 'bg-rose-500',
  fair: 'bg-amber-500',
  good: 'bg-amber-500',
  strong: 'bg-brand-500',
};

export function PasswordField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const strength = scorePassword(value);

  return (
    <div>
      <label className="label" htmlFor="password">Password</label>
      <div className="relative mt-1.5">
        <input
          id="password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={8}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input pr-10"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {value.length > 0 ? (
        <>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${STRENGTH_COLOR[strength.label]}`}
              style={{ width: `${(strength.score / 4) * 100}%` }}
            />
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {REQUIREMENTS.map((requirement) => {
              const met = strength.checks[requirement.key];
              return (
                <li
                  key={requirement.key}
                  className={`flex items-center gap-1.5 ${met ? 'text-brand-700 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  {met ? <Check size={14} /> : <X size={14} />}
                  {requirement.label}
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">At least 8 characters.</p>
      )}
    </div>
  );
}
