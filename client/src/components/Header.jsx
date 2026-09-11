import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Header({ onOpenPostModal, onOpenLoginModal, searchQuery, setSearchQuery, currentTab, setCurrentTab }) {
  const { user, switchPersona } = useAuth();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);

  return (
    <header class="sticky top-0 inset-x-0 z-40 glass-panel border-b border-indigo-100/70 transition-all">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-3 md:gap-6">
        
        {/* Brand & Campus Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setCurrentTab('feed')} 
            className="flex items-center gap-2 group text-left focus:outline-none"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-[#4648d4] to-[#8455ef] flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-lg md:text-xl">sync_saved_locally</span>
            </div>
            <div>
              <span className="text-base md:text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#4648d4] to-[#6b38d4] bg-clip-text text-transparent block leading-tight">
                Back2You
              </span>
              <span className="text-[10px] md:text-[11px] font-medium text-slate-400 block -mt-0.5">
                Campus Recovery Hub
              </span>
            </div>
          </button>

          {/* Campus geofence pill */}
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50/90 hover:bg-indigo-100/70 border border-indigo-200/60 text-indigo-950 text-xs font-semibold cursor-pointer transition-all shadow-xs">
            <span className="material-symbols-outlined text-[#4648d4] text-sm">location_on</span>
            <span className="truncate max-w-[150px] lg:max-w-none">Harvard Yard & Central Quad</span>
            <span className="material-symbols-outlined text-indigo-400 text-xs">expand_more</span>
          </div>
        </div>

        {/* Centered Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-2 lg:mx-4">
          <div className="relative w-full flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-indigo-400 pointer-events-none text-lg">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lost keys, AirPods, notebooks, halls..."
              className="w-full pl-10 pr-12 py-2 rounded-full bg-white/90 border border-indigo-100 text-[#1a1b25] placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-[#4648d4] shadow-xs transition-all"
            />
            <div className="absolute right-2.5 flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50/70 border border-indigo-200/60 text-indigo-500 text-[10px] font-medium pointer-events-none font-mono">
              ⌘K
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          
          {/* Quick Report Button */}
          <button
            type="button"
            onClick={onOpenPostModal}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full btn-gradient-indigo text-white text-xs font-bold tracking-wide active:scale-[0.98] transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>Report Item</span>
          </button>

          {/* Notifications Button */}
          <button
            type="button"
            onClick={() => setCurrentTab('handover')}
            aria-label="Notifications"
            className="relative p-2 rounded-full text-[#464554] hover:text-[#1a1b25] hover:bg-indigo-50 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">notifications</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F43F5E] ring-2 ring-white"></span>
          </button>

          {/* User Persona Switcher & Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowPersonaMenu(!showPersonaMenu)}
              className="flex items-center gap-2 p-1 rounded-full ring-2 ring-indigo-500/20 hover:ring-indigo-500/50 transition-all bg-white/60"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={user?.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
              />
              <span className="hidden xl:inline text-xs font-bold text-[#1a1b25] pr-1">
                {user?.name?.split(' ')[0]}
              </span>
              <span className="material-symbols-outlined text-xs text-slate-400 pr-1">expand_more</span>
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card p-2 shadow-2xl border border-indigo-200/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2.5 border-b border-indigo-100/60 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1b25]">{user?.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {user?.role === 'admin' ? 'Campus Admin' : 'Student'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-indigo-700 font-semibold">
                    <span>★ {user?.trust_score}% Trust Score</span>
                    <span>• {user?.returns_count} Returns</span>
                  </div>
                </div>

                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Switch Demo Persona
                </div>

                <button
                  onClick={() => { switchPersona('user-maya'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                    user?.id === 'user-maya' ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-[#464554]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Maya Lin (Finder)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Student</span>
                </button>

                <button
                  onClick={() => { switchPersona('user-julian'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                    user?.id === 'user-julian' ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-[#464554]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#F43F5E]"></span>
                    <span>Julian Vance (Claimant)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Student</span>
                </button>

                <button
                  onClick={() => { switchPersona('user-admin'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 transition-colors ${
                    user?.id === 'user-admin' ? 'bg-indigo-50 font-bold text-indigo-700' : 'text-[#464554]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    <span>Officer Marcus (Security Admin)</span>
                  </div>
                  <span className="text-[10px] text-purple-700 font-bold">Desk</span>
                </button>

                <div className="border-t border-indigo-100/60 mt-1 pt-1">
                  <button
                    onClick={() => { onOpenLoginModal(); setShowPersonaMenu(false); }}
                    className="w-full text-left p-2 rounded-xl text-xs text-[#4648d4] font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">lock</span>
                    <span>Campus SSO / .edu Login</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
