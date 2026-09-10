'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { CheckCheck } from 'lucide-react';
import { markAllRead, markRead } from '@/lib/actions/notifications';
import { Button } from '@/components/ui/Button';
import { relativeTime } from '@/lib/utils';
import type { AppNotification } from '@/types/db';

export function NotificationList({ notifications }: { notifications: AppNotification[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-4">
      {unread > 0 ? (
        <Button
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => { await markAllRead(); router.refresh(); })}
        >
          <CheckCheck size={15} /> Mark all as read
        </Button>
      ) : null}

      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {notifications.map((notification) => {
          const body = (
            <div className={`px-4 py-3 ${notification.read_at ? '' : 'bg-brand-50/60'}`}>
              <div className="flex items-start gap-2">
                {!notification.read_at ? (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-600" aria-hidden />
                ) : (
                  <span className="mt-1.5 h-2 w-2 shrink-0" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{notification.title}</p>
                  {notification.body ? (
                    <p className="text-sm text-slate-600">{notification.body}</p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-slate-400">
                    {relativeTime(notification.created_at)}
                  </p>
                </div>
              </div>
            </div>
          );

          return (
            <li key={notification.id}>
              {notification.link ? (
                <Link
                  href={notification.link}
                  onClick={() => { void markRead(notification.id); }}
                  className="block hover:bg-slate-50"
                >
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
