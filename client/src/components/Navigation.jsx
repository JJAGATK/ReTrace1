import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function Navigation({ currentTab, setCurrentTab, pendingCount = 0, onOpenPostModal }) {
  const { user } = useAuth();
  const { unreadCount = 0 } = useNotifications() || {};

  return (
    <>
      {/* Desktop Sub-Nav Header */}
      <div className="hidden md:block border-b border-indigo-100/60 bg-white/45 backdrop-blur-md sticky top-16 md:top-20 z-30">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-1.5 py-2 text-xs font-semibold text-[#464554]">
            
            <button
              onClick={() => setCurrentTab('feed')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'feed'
                  ? 'bg-indigo-50 text-[#4648d4] font-bold border border-indigo-200/80 shadow-xs'
                  : 'hover:bg-indigo-50/70 hover:text-indigo-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Live Feed</span>
            </button>

            <button
              onClick={() => setCurrentTab('map')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'map'
                  ? 'bg-indigo-50 text-[#4648d4] font-bold border border-indigo-200/80 shadow-xs'
                  : 'hover:bg-indigo-50/70 hover:text-indigo-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              <span>Campus Map</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-indigo-50 text-[#4648d4] font-bold border border-indigo-200/80 shadow-xs'
                  : 'hover:bg-indigo-50/70 hover:text-indigo-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Claim Center {user?.role === 'admin' && '(Admin)'}</span>
              {user?.role === 'admin' && pendingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('handover')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer relative ${
                currentTab === 'handover'
                  ? 'bg-indigo-50 text-[#4648d4] font-bold border border-indigo-200/80 shadow-xs'
                  : 'hover:bg-indigo-50/70 hover:text-indigo-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">chat_bubble</span>
              <span>Handover & Chats</span>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#4648d4] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('post')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'post'
                  ? 'bg-indigo-50 text-[#4648d4] font-bold border border-indigo-200/80 shadow-xs'
                  : 'hover:bg-indigo-50/70 hover:text-indigo-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Post Lost / Found</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile Floating Bottom Dock (Glass Pill) */}
      <div className="fixed bottom-3 inset-x-0 z-50 px-4 md:hidden pointer-events-none">
        <nav className="pointer-events-auto max-w-sm mx-auto h-14 rounded-full glass-panel border border-indigo-200/90 shadow-xl shadow-indigo-950/15 flex items-center justify-around px-2">
          
          <button
            aria-label="Feed"
            onClick={() => setCurrentTab('feed')}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'feed' ? 'text-[#4648d4]' : 'text-slate-400 hover:text-[#1a1b25]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">home</span>
          </button>

          <button
            aria-label="Campus Map"
            onClick={() => setCurrentTab('map')}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'map' ? 'text-[#4648d4]' : 'text-slate-400 hover:text-[#1a1b25]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">map</span>
          </button>

          {/* Center Prominent (+) Action */}
          <button
            aria-label="Report New Item"
            onClick={onOpenPostModal}
            className="flex items-center justify-center w-11 h-11 rounded-full btn-gradient-indigo text-white shadow-lg shadow-indigo-500/35 active:scale-95 transition-transform tap-highlight-transparent -mt-3"
          >
            <span className="material-symbols-outlined text-2xl font-bold">add</span>
          </button>

          <button
            aria-label="Handover Chat"
            onClick={() => setCurrentTab('handover')}
            className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'handover' ? 'text-[#4648d4]' : 'text-slate-400 hover:text-[#1a1b25]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">chat_bubble</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-[#4648d4] ring-2 ring-white"></span>
            )}
          </button>

          <button
            aria-label="Admin Claim Center"
            onClick={() => setCurrentTab('admin')}
            className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'admin' ? 'text-[#4648d4]' : 'text-slate-400 hover:text-[#1a1b25]'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">shield_person</span>
            {user?.role === 'admin' && pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#F43F5E] ring-2 ring-white"></span>
            )}
          </button>
        </nav>
      </div>
    </>
  );
}
