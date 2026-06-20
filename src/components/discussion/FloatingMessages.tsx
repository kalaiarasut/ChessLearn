"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, ChevronLeft, MoreHorizontal, Maximize2, Minimize2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatar: string;
  lastMessage: string;
  unreadCount: number;
  isOnline: boolean;
  messages: Message[];
  isMuted?: boolean;
  isBlocked?: boolean;
}

export function FloatingMessages() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');

  const handleOpenConversation = (conv: Conversation) => {
    setActiveConversation(conv);
    if (conv.unreadCount > 0) {
      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c));
    }
  };

  const toggleMute = () => {
    if (!activeConversation) return;
    setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, isMuted: !c.isMuted } : c));
    setActiveConversation({ ...activeConversation, isMuted: !activeConversation.isMuted });
    setShowDropdown(false);
  };

  const toggleBlock = () => {
    if (!activeConversation) return;
    setConversations(prev => prev.map(c => c.id === activeConversation.id ? { ...c, isBlocked: !c.isBlocked } : c));
    setActiveConversation({ ...activeConversation, isBlocked: !activeConversation.isBlocked });
    setShowDropdown(false);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    // Mock sending message
    activeConversation.messages.push({
      id: Date.now().toString(),
      senderId: 'me',
      content: newMessage,
      timestamp: new Date()
    });
    activeConversation.lastMessage = newMessage;
    setNewMessage('');
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1, width: isExpanded ? 600 : 350, height: isExpanded ? '80vh' : 'auto' }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={`mb-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${!isExpanded && 'max-h-[500px] min-h-[400px]'}`}
          >
            {activeConversation ? (
              // Active Conversation View
              <>
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b border-[var(--border)] bg-[var(--surface-alt)]">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveConversation(null)}
                      className="p-1.5 hover:bg-[var(--border)] rounded-full transition-colors text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <div className="relative">
                      <img src={activeConversation.avatar} alt={activeConversation.name} className="w-8 h-8 rounded-full" />
                      {activeConversation.isOnline && (
                        <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--surface-alt)] rounded-full" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[14px] font-bold text-[var(--text-primary)] leading-tight">{activeConversation.name}</h3>
                      <p className="text-[11px] text-[var(--text-muted)]">@{activeConversation.handle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="relative">
                      <button 
                        onClick={() => setShowDropdown(!showDropdown)}
                        className="p-1.5 hover:bg-[var(--border)] rounded-full transition-colors text-[var(--text-secondary)]"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {showDropdown && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                          <div className="absolute top-full right-0 mt-1 w-32 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                            <button className="w-full text-left px-3 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors">View Profile</button>
                            <button onClick={toggleMute} className="w-full text-left px-3 py-2 text-[13px] text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors">
                              {activeConversation.isMuted ? 'Unmute' : 'Mute'}
                            </button>
                            <button onClick={toggleBlock} className={`w-full text-left px-3 py-2 text-[13px] transition-colors ${activeConversation.isBlocked ? 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]' : 'text-red-500 hover:bg-red-500/10'}`}>
                              {activeConversation.isBlocked ? 'Unblock' : 'Block User'}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 hover:bg-[var(--border)] rounded-full transition-colors text-[var(--text-secondary)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                  {activeConversation.messages.map((msg, i) => {
                    const isMe = msg.senderId === 'me';
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-[13px] ${isMe ? 'bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-br-sm' : 'bg-[var(--surface-hover)] text-[var(--text-primary)] rounded-bl-sm'}`}>
                          {msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--surface-alt)]">
                  {activeConversation.isBlocked ? (
                    <div className="flex-1 text-center text-[13px] text-red-500 py-1.5 font-semibold">
                      You have blocked this user.
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Start a new message"
                        className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-full px-4 py-2 text-[13px] text-[var(--text-primary)] outline-none focus:border-[var(--cta-bg)] transition-colors"
                      />
                      <button 
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="p-2 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-full disabled:opacity-50 transition-colors"
                      >
                        <Send size={16} className={newMessage.trim() ? '' : 'opacity-50'} />
                      </button>
                    </>
                  )}
                </form>
              </>
            ) : (
              // Conversations List
              <>
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                  <h2 className="text-[14px] font-bold text-[var(--text-primary)]">Messages</h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="p-1.5 hover:bg-[var(--surface-hover)] rounded-full transition-colors text-[var(--text-secondary)]"
                    >
                      {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button 
                      onClick={() => setIsOpen(false)}
                      className="p-1.5 hover:bg-[var(--surface-hover)] rounded-full transition-colors text-[var(--text-secondary)]"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                  {conversations.map(conv => (
                    <div 
                      key={conv.id}
                      onClick={() => handleOpenConversation(conv)}
                      className="flex items-center gap-3 p-4 hover:bg-[var(--surface-hover)] cursor-pointer transition-colors border-b border-[var(--border)]"
                    >
                      <div className="relative">
                        <img src={conv.avatar} alt={conv.name} className="w-10 h-10 rounded-full object-cover" />
                        {conv.isOnline && (
                          <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[var(--surface)] rounded-full" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-[13px] text-[var(--text-primary)] truncate">{conv.name}</h3>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {new Date(conv.messages[conv.messages.length - 1].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-[12px] text-[var(--text-secondary)] truncate">
                            {conv.lastMessage}
                          </p>
                          {conv.unreadCount > 0 && (
                            <span className="ml-2 w-5 h-5 flex items-center justify-center bg-[var(--cta-bg)] text-[var(--cta-text)] text-xs font-bold rounded-full">
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-[var(--cta-bg)] text-[var(--cta-text)] rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-transform relative z-50"
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && conversations.some(c => c.unreadCount > 0) && (
          <div className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-[var(--bg)] rounded-full" />
        )}
      </button>
    </div>
  );
}
