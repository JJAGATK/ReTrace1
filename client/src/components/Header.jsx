import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import Logo from './Logo';

export default function Header({
  onOpenPostModal,
  onOpenLoginModal,
  searchQuery,
  setSearchQuery,
  currentTab,
  setCurrentTab,
  onNavigate
}) {
  const { user, switchPersona } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
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

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    setShowNotifications(false);
    if (onNavigate) {
      if (notification.targetTab === 'admin') {
        onNavigate('admin');
      } else if (notification.targetTab === 'detail' && notification.item_id) {
        onNavigate('detail', { itemId: notification.item_id });
      } else if (notification.item_id) {
        onNavigate('handover', { itemId: notification.item_id });
      } else {
        onNavigate('handover');
      }
    } else {
      setCurrentTab(notification.targetTab || 'handover');
    }
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return 'Just now';
    const diff = (Date.now() - new Date(timestamp).getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <header className="sticky top-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 md:gap-6">
        
        {/* Brand & Campus Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <button 
            onClick={() => setCurrentTab('feed')} 
            className="flex items-center gap-2 group text-left focus:outline-none cursor-pointer"
          >
            <Logo size="sm" className="group-hover:opacity-90 transition-opacity" />
          </button>

          {/* Campus geofence pill */}
          <div 
            onClick={() => setCurrentTab('map')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-xs font-medium cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-indigo-600 text-sm">location_on</span>
            <span className="truncate max-w-[160px] lg:max-w-none">Harvard Yard & North Quad</span>
            <span className="material-symbols-outlined text-slate-400 text-xs">expand_more</span>
          </div>
        </div>

        {/* Centered Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-2 lg:mx-4">
          <div className="relative w-full flex items-center">
            <span className="material-symbols-outlined absolute left-3.5 text-slate-400 pointer-events-none text-lg">search</span>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search lost items, keys, AirPods, buildings..."
              className="w-full pl-10 pr-12 py-1.5 rounded-full bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 text-slate-900 placeholder:text-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <div className="absolute right-2.5 flex items-center px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-400 text-[10px] font-medium pointer-events-none font-mono shadow-2xs">
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
            className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold tracking-tight active:scale-[0.98] transition-all cursor-pointer shadow-xs"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            <span>Report Item</span>
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
              className="relative p-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-xl">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white p-3 shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150 text-slate-900">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-900">Notifications</span>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-600 text-[10px] font-semibold">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[11px] font-medium text-indigo-600 hover:underline cursor-pointer"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto no-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400">
                      <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">notifications_off</span>
                      <p className="text-xs font-semibold">You're all caught up!</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">No new campus recovery alerts right now.</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`p-2.5 rounded-xl transition-colors cursor-pointer flex items-start gap-2.5 ${
                          !n.read ? 'bg-indigo-50/90 border border-indigo-100/80' : 'hover:bg-indigo-50/50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.color || 'bg-indigo-100 text-[#4648d4]'}`}>
                          <span className="material-symbols-outlined text-base">{n.icon || 'notifications'}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-xs truncate ${!n.read ? 'font-bold text-[#1a1b25]' : 'font-semibold text-slate-700'}`}>
                              {n.title}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {formatRelativeTime(n.time)}
                            </span>
                          </div>
                          {n.item_title && (
                            <div className="text-[10px] font-semibold text-[#4648d4] truncate">
                              Item: {n.item_title}
                            </div>
                          )}
                          <p className="text-[11px] text-[#464554] line-clamp-2 mt-0.5 leading-tight">
                            {n.desc}
                          </p>
                        </div>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-[#4648d4] mt-1.5 shrink-0"></span>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-2 border-t border-indigo-100/80 mt-2">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      setCurrentTab('handover');
                    }}
                    className="w-full py-1.5 text-center text-xs font-bold text-[#4648d4] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1"
                  >
                    <span>Open Safe Handover Chamber</span>
                    <span className="material-symbols-outlined text-xs">arrow_forward</span>
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
              className="flex items-center gap-2 p-1 rounded-full ring-2 ring-indigo-500/20 hover:ring-indigo-500/50 transition-all bg-white/60 cursor-pointer"
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
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white p-2 shadow-xl border border-slate-200 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-2.5 border-b border-slate-100 mb-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{user?.name}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      user?.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {user?.role === 'admin' ? 'Campus Admin' : 'Student'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">{user?.email}</p>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-600 font-medium">
                    <span>★ {user?.trust_score}% Trust</span>
                    <span>• {user?.returns_count} Returns</span>
                  </div>
                </div>

                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 px-2 py-1">
                  Switch Account
                </div>

                <button
                  onClick={() => { switchPersona('user-maya'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                    user?.id === 'user-maya' ? 'bg-indigo-50/70 font-semibold text-indigo-700' : 'text-slate-700'
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
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                    user?.id === 'user-julian' ? 'bg-indigo-50/70 font-semibold text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    <span>Julian Vance (Claimant)</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Student</span>
                </button>

                <button
                  onClick={() => { switchPersona('user-admin'); setShowPersonaMenu(false); }}
                  className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                    user?.id === 'user-admin' ? 'bg-indigo-50/70 font-semibold text-indigo-700' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    <span>Officer Marcus (Security Admin)</span>
                  </div>
                  <span className="text-[10px] text-purple-700 font-medium">Desk</span>
                </button>

                <div className="border-t border-slate-100 mt-1 pt-1">
                  <button
                    onClick={() => { onOpenLoginModal(); setShowPersonaMenu(false); }}
                    className="w-full text-left p-2 rounded-xl text-xs text-indigo-600 font-medium hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
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

