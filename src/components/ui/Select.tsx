'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * A CSS-only dropdown standing in for a native <select> wherever the options
 * list needs to stay visually contained (rounded corners, card width) —
 * a native select's open list is rendered by the OS/browser in its own
 * layer, sized to its longest option, ignoring the parent's width entirely.
 */
export function Select({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn('input flex items-center justify-between gap-2 text-left', className)}
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon}
          <span className={cn('truncate', !selected && 'text-slate-400')}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <ul role="listbox" className="card absolute z-10 mt-1.5 max-h-60 w-full overflow-y-auto p-1">
          {options.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors',
                  option.value === value ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100',
                )}
              >
                {option.icon}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.value === value ? <Check size={16} className="ml-auto shrink-0 text-brand-600" /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
