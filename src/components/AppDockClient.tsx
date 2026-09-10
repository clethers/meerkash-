'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Bell, UserRound, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

const GLASS =
  'border border-white/60 bg-white/40 backdrop-blur-lg backdrop-saturate-150 ' +
  'shadow-[0_8px_30px_rgba(31,41,55,0.12),inset_0_1px_0_rgba(255,255,255,0.6)]';

export function AppDockClient({
  avatarName,
  avatarUrl,
  pendingRequests,
  unread,
}: {
  avatarName: string;
  avatarUrl: string | null;
  pendingRequests: number;
  unread: number;
}) {
  const pathname = usePathname();
  const [shrunk, setShrunk] = useState(false);
  const lastY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastY.current = window.scrollY;

    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const scrolledDown = y > lastY.current + 4;
        const scrolledUp = y < lastY.current - 4;
        if (y < 24) {
          setShrunk(false);
        } else if (scrolledDown) {
          setShrunk(true);
        } else if (scrolledUp) {
          setShrunk(false);
        }
        lastY.current = y;
        ticking.current = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const items = [
    { href: '/groups', label: 'Groups', icon: Users, badge: 0 },
    { href: '/friends', label: 'Friends', icon: UserRound, badge: pendingRequests },
    { href: '/notifications', label: 'Alerts', icon: Bell, badge: unread },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4">
      <nav
        aria-label="Primary"
        className={cn(
          'pointer-events-auto flex items-center gap-1 rounded-full px-2.5 py-2',
          'transition-[transform,opacity] duration-300 ease-out motion-reduce:transition-none',
          shrunk ? 'scale-[0.82] opacity-80' : 'scale-100 opacity-100',
          GLASS,
        )}
      >
        {items.map(({ href, label, icon: Icon, badge }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={badge > 0 ? `${label}, ${badge} new` : label}
              className={cn(
                'relative flex h-11 w-11 items-center justify-center rounded-full transition-colors',
                active ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-white/50',
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {badge > 0 ? (
                <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white" />
              ) : null}
            </Link>
          );
        })}

        <Link
          href="/settings"
          aria-label="Your account"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-full transition-shadow',
            pathname.startsWith('/settings') && 'ring-2 ring-brand-500',
          )}
        >
          <Avatar name={avatarName} src={avatarUrl} size={30} />
        </Link>
      </nav>
    </div>
  );
}
