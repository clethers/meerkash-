import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  '#22a170', '#2563eb', '#db2777', '#ea580c', '#7c3aed',
  '#0891b2', '#ca8a04', '#dc2626', '#059669', '#4f46e5',
];

/** Stable colour for a name or seed — same input, same colour, everywhere. */
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

/**
 * Requirement 3: a group name is generated automatically from its members
 * ("Clethers & John", "Clethers, John & 3 others") until the owner renames it.
 */
export function suggestGroupName(names: string[]): string {
  const clean = names.map((n) => n.trim().split(/\s+/)[0]).filter(Boolean);
  if (clean.length === 0) return 'New group';
  if (clean.length === 1) return `${clean[0]}'s group`;
  if (clean.length === 2) return `${clean[0]} & ${clean[1]}`;
  if (clean.length === 3) return `${clean[0]}, ${clean[1]} & ${clean[2]}`;
  return `${clean[0]}, ${clean[1]} & ${clean.length - 2} others`;
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000')
  );
}
