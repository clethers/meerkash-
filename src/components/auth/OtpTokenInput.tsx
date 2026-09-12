'use client';

import { useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';

const LENGTH = 6;

/** Six single-digit boxes that assemble into one hidden "token" field, so the
 * surrounding form still submits a plain 6-character string like before. */
export function OtpTokenInput() {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, raw: string) {
    const digit = raw.replace(/[^0-9]/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, LENGTH);
    if (!pasted) return;
    event.preventDefault();
    setDigits(Array.from({ length: LENGTH }, (_, i) => pasted[i] ?? ''));
    inputRefs.current[Math.min(pasted.length, LENGTH) - 1]?.focus();
  }

  return (
    <div>
      <input type="hidden" name="token" value={digits.join('')} />
      <div className="mt-1.5 flex justify-center gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            onChange={(event) => setDigit(index, event.target.value)}
            onKeyDown={(event) => handleKeyDown(index, event)}
            onPaste={handlePaste}
            autoFocus={index === 0}
            aria-label={`Digit ${index + 1} of ${LENGTH}`}
            className="input h-14 w-11 text-center text-2xl font-semibold tabular-nums"
          />
        ))}
      </div>
    </div>
  );
}
