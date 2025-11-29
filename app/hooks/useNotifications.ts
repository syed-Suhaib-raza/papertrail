// hooks/useNotifications.ts  (debug version)
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

export type NotificationRow = {
  id: string;
  recipient_id: string;
  actor_id?: string | null;
  type: string;
  payload: any;
  is_read: boolean;
  sent_at: string;
};

export default function useNotifications(profileId: string | null | undefined) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setErrorMsg(null);
    if (!profileId) {
      setLoading(false);
      setErrorMsg('no profileId provided to useNotifications');
      console.warn('[useNotifications] no profileId provided');
      return;
    }

    setLoading(true);
    try {
      const res = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', profileId)
        .order('sent_at', { ascending: false })
        .limit(200);

      // log the raw returned object for debugging
      console.debug('[useNotifications] raw response', res);

      // supabase client returns { data, error } normally
      // narrowed safely here:
      const data = (res as any).data as NotificationRow[] | null;
      const error = (res as any).error;

      if (error) {
        console.error('[useNotifications] supabase error', error);
        setErrorMsg(String(error.message ?? error));
        setNotifications([]);
        setUnreadCount(0);
      } else if (!data) {
        console.warn('[useNotifications] no data returned (null)');
        setNotifications([]);
        setUnreadCount(0);
      } else {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    } catch (err) {
      console.error('[useNotifications] unexpected error', err);
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!profileId) return;

    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profileId}`,
        },
        (payload) => {
          console.debug('[useNotifications] realtime INSERT', payload);
          const newRow = payload.new as NotificationRow;
          setNotifications((prev) => [newRow, ...prev].slice(0, 200));
          setUnreadCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${profileId}`,
        },
        (payload) => {
          console.debug('[useNotifications] realtime UPDATE', payload);
          const updatedRow = payload.new as NotificationRow;
          setNotifications((prev) => {
            const mapped = prev.map((r) => (r.id === updatedRow.id ? updatedRow : r));
            setUnreadCount(mapped.filter((n) => !n.is_read).length);
            return mapped;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId]);

  // expose the low-level error message so the UI can display it
  return { notifications, unreadCount, loading, errorMsg, markRead: async (id: string) => {
    // small markRead helper (keeps previous behaviour)
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) {
        console.error('[useNotifications] markRead error', error);
        // optional: revert changes if you want
      }
    } catch (e) {
      console.error('[useNotifications] markRead unexpected error', e);
    }
  }, markAllRead: async () => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('recipient_id', profileId).is('is_read', false);
      if (error) console.error('[useNotifications] markAllRead error', error);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      console.error('[useNotifications] markAllRead unexpected error', e);
    }
  }, refetch: fetchNotifications };
}