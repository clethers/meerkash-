'use client';

import { Banknote, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

const OPTIONS = [
  { value: 'cash' as const, label: 'Cash', icon: Banknote },
  { value: 'qr_code' as const, label: 'QR code', icon: QrCode },
];

export function PaymentMethodToggle({
  value,
  onChange,
}: {
  value: 'cash' | 'qr_code';
  onChange: (value: 'cash' | 'qr_code') => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
      {OPTIONS.map(({ value: option, label, icon: Icon }) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === option ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
          )}
        >
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
}
