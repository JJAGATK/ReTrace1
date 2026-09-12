import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ onOpenPostModal, onOpenLoginModal, searchQuery, setSearchQuery, currentTab, setCurrentTab }) {
  const { user, switchPersona } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const searchInputRef = useRef(null);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const notifications = [
    {
      id: 1,
      title: 'Handover Session Active',
      desc: 'AirPods Pro (#REC-8842) verified for pickup at Cabot Desk.',
      time: '10m ago',
      icon: 'verified_user',
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400'
    },
    {
      id: 2,
      title: 'New Community Sighting',
      desc: 'Maya Lin reported a sighting for MacBook Air near Union Cafe.',
      time: '45m ago',
      icon: 'visibility',
      color: 'text-[#4648d4] bg-indigo-50 dark:bg-indigo-950/50 dark:text-indigo-400'
    },
    {
      id: 3,
      title: 'Custody Chain Block Sealed',
      desc: 'SHA-256 tamper-proof log recorded for Malkin Center deposit.',
      time: '2h ago',
      icon: 'lock',
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/50 dark:text-purple-400'
    }
  ];

  return (
    <header className="sticky top-0 inset-x-0 z-40 glass-panel border-b border-indigo-100/70 dark:border-indigo-900/40 transition-colors">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 md:h-20 flex items-center justify-between gap-3 md:gap-6">
        
        {/* Brand & Campus Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setCurrentTab('feed')} 
            className="flex items-center gap-2.5 group text-left focus:outline-none cursor-pointer"
          >
            <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl bg-gradient-to-tr from-[#4648d4] to-[#8455ef] flex items-center justify-center text-white font-bold shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-lg md:text-xl">sync_saved_locally</span>
            </div>
            <div>
              <span className="text-base md:text-lg font-extrabold tracking-tight bg-gradient-to-r from-[#4648d4] to-[#8455ef] bg-clip-text text-transparent block leading-tight">
                ReTrace
              </span>
              <span className="text-[10px] md:text-[11px] font-medium text-slate-400 dark:text-slate-500 block -mt-0.5">
                Campus Recovery Hub
              </span>
            </div>
          </button>

          {/* Campus geofence pill */}
          <div 
            onClick={() => setCurrentTab('map')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50/90 hover:bg-indigo-100/70 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-950 dark:text-indigo-200 text-xs font-semibold cursor-pointer transition-all shadow-xs"
          >
            <span className="material-symbols-outlined text-[#4648d4] dark:text-indigo-400 text-sm">location_on</span>
            <span className="truncate max-w-[150px] lg:max-w-none">Harvard Yard & Central Quad</span>
            <span className="material-symbols-outlined text-indigo-400 text-xs">expand_more</span>
          </div>
        </div>

        {/* Centered Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-2 lg:mx-4">
          <div className="relative w-full flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-indigo-400 pointer-events-none text-lg">search</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lost keys, AirPods, notebooks, halls..."
              className="w-full pl-10 pr-12 py-2 rounded-full bg-white/90 dark:bg-[#1a1c2e]/90 border border-indigo-100 dark:border-indigo-900/50 text-[#1a1b25] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-[#4648d4] shadow-xs transition-all"
            />
            <div className="absolute right-2.5 flex items-center px-1.5 py-0.5 rounded-md bg-indigo-50/70 dark:bg-indigo-950/80 border border-indigo-200/60 dark:border-indigo-800/60 text-indigo-500 dark:text-indigo-400 text-[10px] font-medium pointer-events-none font-mono">
              ⌘K
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Quick Report Button */}
          <button
            type="button"
            onClick={onOpenPostModal}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-full btn-gradient-indigo text-white text-xs font-bold tracking-wide active:scale-[0.98] transition-all cursor-pointer shadow-md shadow-indigo-500/20"
          >
            <span className="material-symbols-outlined text-sm">add_circle</span>
            <span>Report Item</span>
          </button>

          {/* Theme Toggle Button (Light/Dark Mode) — Placed right near notification icon */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="relative p-2 rounded-full text-[#464554] dark:text-slate-300 hover:text-[#1a1b25] dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl transition-transform duration-300 hover:rotate-45">
              {isDark ? 'light_mode' : 'dark_mode'}
            </span>
          </button>

          {/* Notifications Button & Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowNotifications(!showNotifications);
                setShowPersonaMenu(false);
              }}
              aria-label="Notifications"
              className="relative p-2 rounded-full text-[#464554] dark:text-slate-300 hover:text-[#1a1b25] dark:hover:text-white hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#F43F5E] ring-2 ring-white dark:ring-[#1a1c2e]"></span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl glass-card p-3 shadow-2xl border border-indigo-200/80 dark:border-indigo-800/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-indigo-100/80 dark:border-indigo-900/60 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-[#4648d4] dark:text-indigo-400">notifications_active</span>
                    <span className="text-xs font-bold text-[#1a1b25] dark:text-white">Campus Recovery Alerts</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.2 rounded-full">Live</span>
                </div>

                <div className="flex flex-col gap-1.5">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        setShowNotifications(false);
                        setCurrentTab('handover');
                      }}
                      className="p-2 rounded-xl hover:bg-indigo-50/80 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer flex items-start gap-2.5"
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${n.color}`}>
                        <span className="material-symbols-outlined text-sm">{n.icon}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#1a1b25] dark:text-slate-100 truncate">{n.title}</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 shrink-0">{n.time}</span>
                        </div>
                        <p className="text-[11px] text-[#464554] dark:text-slate-400 line-clamp-1 mt-0.5">{n.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-indigo-100/80 dark:border-indigo-900/60 mt-1">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setCurrentTab('handover');
                    }}
                    className="w-full py-1.5 text-center text-xs font-semibold text-[#4648d4] dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                  >
                    View Safe Handover Chamber →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Persona Switcher & Profile */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPersonaMenu(!showPersonaMenu);
                setShowNotifications(false);
              }}
              className="flex items-center gap-2 p-1 rounded-full ring-2 ring-indigo-500/20 hover:ring-indigo-500/50 transition-all bg-white/60 dark:bg-[#1a1c2e]/60 cursor-pointer"
            >
              <img
                src={user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80'}
                alt={user?.name}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover"
              />
              <span className="hidden xl:inline text-xs font-bold text-[#1a1b25] dark:text-slate-200 pr-1">
                {user?.name?.split(' ')[0]}
              </span>
              <span className="material-symbols-outlined text-xs text-slate-400 pr-1">expand_more</span>
            </button>

            {showPersonaMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl glass-card p-2 shadow-2xl border border-indigo-200/80 dark:border-indigo-800/80 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2.5 border-b border-indigo-100/60 dark:border-indigo-900/60 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#1a1b25] dark:text-white">{user?.name}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                      user?.role === 'admin' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    }`}>
                      {user?.role === 'admin' ? 'Campus Admin' : 'Student'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-indigo-700 dark:text-indigo-400 font-semibold">
                    <span>★ {user?.trust_score}% Trust Score</span>
                    <span>• {user?.returns_count} Returns</span>
                  </div>
                </div>

                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Switch Demo Persona
                </div>

                <button
                  onClick={() => { switchPersona('user-maya'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer ${
                    user?.id === 'user-maya' ? 'bg-indigo-50 dark:bg-indigo-950/70 font-bold text-indigo-700 dark:text-indigo-300' : 'text-[#464554] dark:text-slate-300'
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
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer ${
                    user?.id === 'user-julian' ? 'bg-indigo-50 dark:bg-indigo-950/70 font-bold text-indigo-700 dark:text-indigo-300' : 'text-[#464554] dark:text-slate-300'
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
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors cursor-pointer ${
                    user?.id === 'user-admin' ? 'bg-indigo-50 dark:bg-indigo-950/70 font-bold text-indigo-700 dark:text-indigo-300' : 'text-[#464554] dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    <span>Officer Marcus (Security Admin)</span>
                  </div>
                  <span className="text-[10px] text-purple-700 dark:text-purple-300 font-bold">Desk</span>
                </button>

                <div className="border-t border-indigo-100/60 dark:border-indigo-900/60 mt-1 pt-1">
                  <button
                    onClick={() => { onOpenLoginModal(); setShowPersonaMenu(false); }}
                    className="w-full text-left p-2 rounded-xl text-xs text-[#4648d4] dark:text-indigo-400 font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition-colors flex items-center gap-1.5 cursor-pointer"
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

