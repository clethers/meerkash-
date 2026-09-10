'use client';

import { useFormStatus } from 'react-dom';
import { Button } from './Button';
import type { ComponentProps } from 'react';

export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending ? (pendingLabel ?? 'Working…') : children}
    </Button>
  );
}
