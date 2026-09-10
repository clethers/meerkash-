// src/components/auth/UsernameField.tsx

'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { checkUsernameAvailable } from '@/lib/signup/usernameCheck';
import { debounce } from '@/lib/signup/debounce';

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const MESSAGES: Record<UsernameStatus, string | null> = {
  idle: null,
  checking: 'Checking availability…',
  available: 'Username is available',
  taken: 'That username is taken',
  invalid: '3-20 characters: lowercase letters, numbers, underscore',
};

const MESSAGE_COLOR: Record<UsernameStatus, string> = {
  idle: 'text-slate-500',
  checking: 'text-slate-500',
  available: 'text-brand-700',
  taken: 'text-rose-600',
  invalid: 'text-rose-600',
};

export function UsernameField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const supabaseRef = useRef(createClient());
  const valueRef = useRef(value);
  const debouncedCheckRef = useRef(
    debounce((username: string) => {
      checkUsernameAvailable(supabaseRef.current, username)
        .then((available) => {
          // Only update status if this check is still for the current value
          if (valueRef.current === username) {
            setStatus(available ? 'available' : 'taken');
          }
        })
        .catch(() => {
          // Only reset to idle if this failed check is still for the current value
          if (valueRef.current === username) {
            setStatus('idle');
          }
        });
    }, 400),
  );

  // Keep valueRef in sync with the current value prop
  valueRef.current = value;

  useEffect(() => {
    if (value.length === 0) {
      setStatus('idle');
      return;
    }
    if (!USERNAME_PATTERN.test(value)) {
      setStatus('invalid');
      return;
    }
    setStatus('checking');
    debouncedCheckRef.current(value);
  }, [value]);

  const message = MESSAGES[status];
  const icon = {
    idle: null,
    checking: <Loader2 size={14} className="animate-spin" />,
    available: <Check size={14} />,
    taken: <X size={14} />,
    invalid: <X size={14} />,
  }[status];

  return (
    <div>
      <label className="label" htmlFor="username">Username</label>
      <input
        id="username"
        name="username"
        required
        minLength={3}
        maxLength={20}
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.toLowerCase())}
        className="input mt-1.5"
        placeholder="juan_delacruz"
      />
      {message ? (
        <p className={`mt-1 flex items-center gap-1.5 text-xs ${MESSAGE_COLOR[status]}`}>
          {icon}
          {message}
        </p>
      ) : (
        <p className="mt-1 text-xs text-slate-500">This is how friends will find you.</p>
      )}
    </div>
  );
}
