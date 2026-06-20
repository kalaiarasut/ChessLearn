"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { NotificationsDrawer } from "./NotificationsDrawer";

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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload: any) => {
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
      setUnreadCount(data.filter((n: any) => !n.read).length);
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
    setNotifications(prev => prev.map((n: any) => ({ ...n, read: true })));
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // Allow the drawer's own backdrop/close mechanisms to handle closing
      // Only handle outside clicks for the button itself if needed, 
      // but since we use a full-screen backdrop, we can just let the backdrop handle it.
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
    <>
      <div className="relative">
        <button
          onClick={handleOpen}
          className="p-2.5 rounded-full bg-[var(--surface-alt)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-[var(--border-hover)] transition-all duration-300 shadow-sm inline-flex items-center justify-center relative"
        >
          <Bell className="w-[18px] h-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[var(--surface-alt)]"></span>
          )}
        </button>
      </div>

      <NotificationsDrawer 
        isOpen={isOpen} 
        onClose={() => setIsOpen(false)} 
        notifications={notifications}
        onMarkAllRead={markAsRead}
      />
    </>
  );
}
