// File: components/NotificationsNav.tsx
'use client';

import React, { useState } from 'react';
import useNotifications from '@/app/hooks/useNotifications';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { renderTitle } from '@/lib/notificationHelpers';

type Props = { profileId: string | null };

export default function NotificationsNav({ profileId }: Props) {
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(profileId);
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative p-2 rounded hover:bg-slate-100"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-xs rounded-full bg-red-600 text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-h-[420px] overflow-auto bg-white border rounded shadow-lg z-50">
          <div className="flex items-center justify-between p-3 border-b">
            <span className="font-medium">Notifications</span>
            <div className="text-sm flex items-center gap-2">
              <button onClick={() => markAllRead()} className="text-xs underline">Mark all read</button>
              <Link href="/dashboard/notifications" className="text-xs underline">Open page</Link>
            </div>
          </div>

          {loading && <div className="p-4 text-sm">Loading…</div>}

          {!loading && notifications.length === 0 && (
            <div className="p-4 text-sm text-slate-500">No notifications yet.</div>
          )}

          <ul>
            {notifications.map((n) => (
              <li key={n.id} className={`p-3 border-b hover:bg-slate-50 ${n.is_read ? '' : 'bg-slate-50/50'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <Link href={'#'}
                      onClick={() => markRead(n.id)}
                      className="block text-sm"
                    >
                      <div className="font-medium">{renderTitle(n)}</div>
                      <div className="text-xs text-slate-500">{new Date(n.sent_at).toLocaleString()}</div>
                    </Link>
                  </div>
                  {!n.is_read && <span className="ml-2 inline-block rounded-full w-2 h-2 bg-blue-600" />}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}