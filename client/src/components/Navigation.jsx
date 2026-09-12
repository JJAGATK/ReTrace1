import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';

export default function Navigation({ currentTab, setCurrentTab, pendingCount = 0, onOpenPostModal }) {
  const { user } = useAuth();
  const { unreadCount = 0 } = useNotifications() || {};

  return (
    <>
      {/* Desktop Sub-Nav Header */}
      <div className="hidden md:block border-b border-slate-200/80 bg-white sticky top-16 z-30">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex items-center gap-2 py-2 text-xs font-medium text-slate-600">
            
            <button
              onClick={() => setCurrentTab('feed')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'feed'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Live Feed</span>
            </button>

            <button
              onClick={() => setCurrentTab('map')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'map'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">map</span>
              <span>Campus Map</span>
            </button>

            <button
              onClick={() => setCurrentTab('leaderboard')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'leaderboard'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm text-amber-500">emoji_events</span>
              <span>Leaderboard</span>
            </button>

            <button
              onClick={() => setCurrentTab('admin')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'admin'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Claim Center {user?.role === 'admin' && '(Admin)'}</span>
              {user?.role === 'admin' && pendingCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('handover')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer relative ${
                currentTab === 'handover'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">chat_bubble</span>
              <span>Handover & Chats</span>
              {unreadCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setCurrentTab('post')}
              className={`px-3.5 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer ${
                currentTab === 'post'
                  ? 'bg-slate-900 text-white font-semibold shadow-2xs'
                  : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-sm">add_circle</span>
              <span>Post Lost / Found</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Mobile Floating Bottom Dock */}
      <div className="fixed bottom-3 inset-x-0 z-50 px-4 md:hidden pointer-events-none">
        <nav className="pointer-events-auto max-w-sm mx-auto h-14 rounded-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-lg flex items-center justify-around px-2">
          
          <button
            aria-label="Feed"
            onClick={() => setCurrentTab('feed')}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'feed' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">home</span>
          </button>

          <button
            aria-label="Campus Map"
            onClick={() => setCurrentTab('map')}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'map' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">map</span>
          </button>

          {/* Center (+) Action */}
          <button
            aria-label="Report New Item"
            onClick={onOpenPostModal}
            className="flex items-center justify-center w-11 h-11 rounded-full bg-indigo-600 text-white shadow-md active:scale-95 transition-transform tap-highlight-transparent -mt-3"
          >
            <span className="material-symbols-outlined text-2xl font-bold">add</span>
          </button>

          <button
            aria-label="Leaderboard"
            onClick={() => setCurrentTab('leaderboard')}
            className={`flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'leaderboard' ? 'text-amber-500' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">emoji_events</span>
          </button>

          <button
            aria-label="Handover Chat"
            onClick={() => setCurrentTab('handover')}
            className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'handover' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">chat_bubble</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-white"></span>
            )}
          </button>

          <button
            aria-label="Admin Claim Center"
            onClick={() => setCurrentTab('admin')}
            className={`relative flex flex-col items-center justify-center w-11 h-11 rounded-full tap-highlight-transparent transition-colors ${
              currentTab === 'admin' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">shield_person</span>
            {user?.role === 'admin' && pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            )}
          </button>
        </nav>
      </div>
    </>
  );
}
