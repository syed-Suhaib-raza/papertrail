"use client";

import React from "react";
import useNotifications from "@/app/hooks/useNotifications";
import { renderTitle } from "@/lib/notificationHelpers";

export default function NotificationsPage({
  profileId,
}: {
  profileId: string | null;
}) {
  const {
    notifications,
    unreadCount,
    loading,
    errorMsg,
    markRead,
    markAllRead,
    refetch,
  } = useNotifications(profileId);

  if (loading) return <div className="p-6">Loading…</div>;
  if (errorMsg)
    return <div className="p-6 text-red-600">Error: {errorMsg}</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>

        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-600">
            Unread: {unreadCount}
          </span>

          <button
            onClick={markAllRead}
            className="px-3 py-1 border rounded text-sm hover:bg-slate-100"
          >
            Mark all read
          </button>

          <button
            onClick={refetch}
            className="px-3 py-1 border rounded text-sm hover:bg-slate-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <div className="text-slate-500">You have no notifications.</div>
      ) : (
        <ul className="space-y-3">
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`p-4 border rounded ${
                n.is_read ? "" : "bg-slate-50"
              }`}
            >
              <a
                href={'#'}
                onClick={() => markRead(n.id)}
              >
                <div className="font-medium">{renderTitle(n)}</div>
                <div className="text-xs text-slate-500">
                  {new Date(n.sent_at).toLocaleString()}
                </div>
              </a>

              {/* Payload (JSON) */}
              <pre className="mt-2 text-xs bg-slate-100 p-2 rounded overflow-auto">
                {JSON.stringify(n.payload, null, 2)}
              </pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}