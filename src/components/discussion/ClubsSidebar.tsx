"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Users, Compass, Shield, Zap, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_CLUBS = [
  { id: 'c/opening-theory', name: 'Opening Theory', icon: Compass, members: '12.4K', color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { id: 'c/endgame-grind', name: 'Endgame Grind', icon: Shield, members: '8.2K', color: 'text-green-500', bg: 'bg-green-500/10' },
  { id: 'c/bullet-junkies', name: 'Bullet Junkies', icon: Zap, members: '45.1K', color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { id: 'c/improvement', name: 'Improvement', icon: TrendingUp, members: '102K', color: 'text-[var(--brand)]', bg: 'bg-[var(--brand-muted)]' },
  { id: 'c/tournaments', name: 'Tournaments', icon: Trophy, members: '24K', color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

export function ClubsSidebar() {
  const searchParams = useSearchParams();
  const currentClub = searchParams.get('club');

  return (
    <div className="flex flex-col sticky top-[100px] gap-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-serif font-bold text-lg text-[var(--text-primary)] flex items-center gap-2">
            <Users size={20} className="text-[var(--brand)]" />
            Clubs
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-1">Join communities you love</p>
        </div>
        
        <div className="flex flex-col py-2">
          <Link 
            href="/discussion"
            className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors ${!currentClub ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${!currentClub ? 'bg-[var(--cta-bg)] text-[var(--cta-text)]' : 'bg-[var(--surface-alt)] text-[var(--text-secondary)]'}`}>
              <Compass size={18} />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${!currentClub ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>All Posts</span>
            </div>
          </Link>

          {MOCK_CLUBS.map(club => {
            const isActive = currentClub === club.id;
            const Icon = club.icon;
            
            return (
              <Link 
                key={club.id}
                href={`/discussion?club=${club.id}`}
                className={`flex items-center gap-3 px-4 py-3 mx-2 rounded-xl transition-colors ${isActive ? 'bg-[var(--surface-hover)]' : 'hover:bg-[var(--surface-hover)]'}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${club.bg} ${club.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex flex-col">
                  <span className={`text-sm font-bold ${isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors'}`}>
                    {club.name}
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">{club.members} members</span>
                </div>
                {isActive && (
                  <motion.div 
                    layoutId="active-club-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-[var(--cta-bg)] ml-auto"
                  />
                )}
              </Link>
            )
          })}
        </div>
        
        <div className="p-4 border-t border-[var(--border)]">
          <button className="w-full py-2 bg-[var(--surface-alt)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] text-sm font-bold rounded-xl transition-colors border border-[var(--border)]">
            + Create Club
          </button>
        </div>
      </div>
    </div>
  );
}
