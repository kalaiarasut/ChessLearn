"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Heart, AtSign, AlertTriangle, MessageSquare, ShieldAlert, CheckCircle2 } from "lucide-react";

interface NotificationsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications?: any[];
  onMarkAllRead?: () => void;
}

type TabType = "Mentions" | "Likes" | "Alerts";

export function NotificationsDrawer({ isOpen, onClose, notifications = [], onMarkAllRead }: NotificationsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>("Mentions");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tabs: TabType[] = ["Mentions", "Likes", "Alerts"];
  
  // Filter real notifications
  const mentions = notifications.filter((n: any) => n.type === 'mention' || n.type === 'reply');
  const likes = notifications.filter((n: any) => n.type === 'like' || n.type === 'repost');
  const alerts = notifications.filter((n: any) => n.type === 'alert' || n.type === 'system' || n.type === 'follow');

  const activeNotifications = activeTab === "Mentions" ? mentions : activeTab === "Likes" ? likes : alerts;

  const timeAgo = (dateStr: string) => {
    const diff = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getIconData = (type: string) => {
    switch (type) {
      case 'mention': return { icon: AtSign, color: "text-blue-400", bg: "bg-blue-400/10" };
      case 'reply': return { icon: MessageSquare, color: "text-green-400", bg: "bg-green-400/10" };
      case 'like': return { icon: Heart, color: "text-rose-400", bg: "bg-rose-400/10" };
      case 'follow': return { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10" };
      case 'alert': return { icon: ShieldAlert, color: "text-amber-400", bg: "bg-amber-400/10" };
      default: return { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-400/10" };
    }
  };

  const getNotificationText = (n: any) => {
    if (n.type === 'mention') return "mentioned you in a post.";
    if (n.type === 'reply') return "replied to your post.";
    if (n.type === 'like') return "liked your post.";
    if (n.type === 'repost') return "reposted your post.";
    if (n.type === 'follow') return "started following you.";
    return n.content || "New notification";
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 z-[100] w-full max-w-sm h-full bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
              <div>
                <h2 className="text-xl font-bold text-[var(--text-primary)]">Notifications</h2>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">Stay updated with your activities</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-[var(--surface-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex px-4 pt-3 border-b border-[var(--border)] gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative pb-3 text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab}
                  {activeTab === tab && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--cta-bg)] rounded-t-full"
                    />
                  )}
                  {/* Unread indicators */}
                  {tab === "Mentions" && mentions.some((n: any) => !n.read) && (
                    <span className="absolute -top-1 -right-3 w-2 h-2 bg-blue-500 rounded-full"></span>
                  )}
                  {tab === "Likes" && likes.some((n: any) => !n.read) && (
                    <span className="absolute -top-1 -right-3 w-2 h-2 bg-rose-500 rounded-full"></span>
                  )}
                  {tab === "Alerts" && alerts.some((n: any) => !n.read) && (
                    <span className="absolute -top-1 -right-3 w-2 h-2 bg-amber-500 rounded-full"></span>
                  )}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              <AnimatePresence mode="popLayout">
                {activeNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                    <p className="text-[var(--text-muted)] text-sm">No notifications here yet.</p>
                  </div>
                ) : (
                  activeNotifications.map((notification, index) => {
                    const iconData = getIconData(notification.type);
                    const Icon = iconData.icon;
                    const actorName = notification.actor?.username || notification.actor?.handle || 'Someone';
                    const actorAvatar = notification.actor?.avatar;

                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ delay: index * 0.05 }}
                        key={notification.id}
                        className={`group relative p-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-hover)] hover:border-[var(--border-hover)] transition-all cursor-pointer overflow-hidden ${
                          !notification.read ? "shadow-sm" : "opacity-80"
                        }`}
                      >
                        {!notification.read && (
                          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--cta-bg)]" />
                        )}
                        
                        <div className="flex gap-4">
                          <div className="relative flex-shrink-0">
                            {actorAvatar ? (
                              <img
                                src={actorAvatar}
                                alt={actorName}
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--surface)]"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[var(--surface-alt)] flex items-center justify-center ring-2 ring-[var(--surface)]">
                                <span className="font-bold text-[var(--text-muted)]">
                                  {actorName[0]?.toUpperCase() || '?'}
                                </span>
                              </div>
                            )}
                            <div
                              className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--surface)] ${iconData.bg}`}
                            >
                              <Icon className={`w-3 h-3 ${iconData.color}`} />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] leading-snug text-[var(--text-primary)]">
                              <span className="font-semibold">{actorName}</span>{" "}
                              <span className="text-[var(--text-muted)]">{getNotificationText(notification)}</span>
                            </p>
                            <p className="text-[12px] font-medium text-[var(--text-muted)] mt-1.5 flex items-center gap-1.5">
                              {timeAgo(notification.created_at)}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t border-[var(--border)] bg-[var(--surface-alt)]">
              <button 
                onClick={onMarkAllRead}
                className="w-full py-2.5 rounded-lg bg-[var(--cta-bg)] hover:bg-[var(--cta-bg-hover)] text-white font-medium text-sm transition-colors shadow-sm"
              >
                Mark all as read
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
