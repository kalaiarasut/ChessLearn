"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  useEffect(() => {
    fetchNotifications();

    const channel = supabase.channel('realtime:notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, payload => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!actor_id(username, handle, avatar)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  };

  const markAsRead = async () => {
    if (unreadCount === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
      
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      markAsRead();
    }
  };

  const formatText = (n: any) => {
    const handle = n.actor?.handle || 'Someone';
    if (n.type === 'mention') return `${handle} mentioned you in a post`;
    if (n.type === 'reply') return `${handle} replied to your post`;
    if (n.type === 'like') return `${handle} liked your post`;
    if (n.type === 'repost') return `${handle} reposted your post`;
    return 'New notification';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm inline-flex items-center justify-center relative"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--surface-alt)]"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg shadow-xl bg-[var(--surface)] border border-[var(--border)] z-50">
          <div className="p-3 border-b border-[var(--border)] font-semibold text-[14px]">
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-[var(--text-muted)] text-[13px]">
              No notifications yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 border-b border-[var(--border)] hover:bg-[var(--surface-hover)] transition-colors cursor-pointer flex gap-3 ${!n.read ? 'bg-[var(--brand)]/10' : ''}`}
                  onClick={() => {
                    setIsOpen(false);
                    router.push('/discussion');
                  }}
                >
                  {n.actor?.avatar ? (
                    <img src={n.actor.avatar} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt="avatar" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-alt)] flex-shrink-0" />
                  )}
                  <div className="flex flex-col text-[13px]">
                    <span className="text-[var(--text-primary)]">{formatText(n)}</span>
                    <span className="text-[var(--text-muted)] text-[11px] mt-0.5">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
