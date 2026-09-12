import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import LoadingScreen from './components/LoadingScreen';
import MessageToastContainer from './components/MessageToast';
import LiveFeedScreen from './screens/LiveFeedScreen';
import PostItemScreen from './screens/PostItemScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import CampusMapScreen from './screens/CampusMapScreen';
import AdminQueueScreen from './screens/AdminQueueScreen';
import HandoverChatScreen from './screens/HandoverChatScreen';
import LeaderboardScreen from './screens/LeaderboardScreen';
import LoginModal from './screens/LoginModal';
import AccountLoginScreen from './screens/AccountLoginScreen';

function MainApp() {
  const { user, token, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed', 'map', 'admin', 'handover', 'post', 'detail', 'leaderboard'
  const [tabHistory, setTabHistory] = useState(['feed']);
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [focusedBuilding, setFocusedBuilding] = useState(null);
  const [activeHandoverItemId, setActiveHandoverItemId] = useState('REC-8842');

  // Change tab with history tracking
  const navigateToTab = (nextTab, params = {}) => {
    if (params.building) setFocusedBuilding(params.building);
    if (params.itemId) {
      setActiveHandoverItemId(params.itemId);
      if (nextTab === 'detail' && (!selectedItem || selectedItem.id !== params.itemId)) {
        fetch(`/api/items/${params.itemId}`)
          .then(res => res.ok ? res.json() : null)
          .then(data => { if (data?.item) setSelectedItem(data.item); })
          .catch(() => {});
      }
    }
    if (nextTab !== currentTab) {
      setTabHistory(prev => [...prev.slice(-10), nextTab]);
    }
    setCurrentTab(nextTab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Safe Go Back Handler
  const handleGoBack = () => {
    if (tabHistory.length > 1) {
      const newHistory = [...tabHistory];
      newHistory.pop(); // remove current
      const prev = newHistory[newHistory.length - 1] || 'feed';
      setTabHistory(newHistory);
      setCurrentTab(prev);
    } else {
      setCurrentTab('feed');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Global Escape key navigation to return to feed if stuck
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && currentTab !== 'feed') {
        handleGoBack();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [currentTab, tabHistory]);

  // Poll for pending claims count for admin badge
  useEffect(() => {
    async function checkPending() {
      if (!token || user?.role !== 'admin') {
        setPendingClaimsCount(0);
        return;
      }
      try {
        const res = await fetch('/api/admin/analytics', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPendingClaimsCount(typeof data.pendingClaims === 'number' ? data.pendingClaims : 0);
        }
      } catch (e) {}
    }
    checkPending();
  }, [currentTab, token, user]);

  const handleSelectItem = (item) => {
    setSelectedItem(item);
    navigateToTab('detail');
  };

  const handleOpenClaimModal = (item) => {
    setSelectedItem(item);
    navigateToTab('detail');
  };

  const handleNavigate = (tab, params = {}) => {
    navigateToTab(tab, params);
  };

  if (!authLoading && !user) {
    return (
      <>
        {isLoading && <LoadingScreen onFinish={() => setIsLoading(false)} />}
        <AccountLoginScreen onLoggedIn={() => {}} />
      </>
    );
  }

  return (
    <>
      {isLoading && <LoadingScreen onFinish={() => setIsLoading(false)} />}
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 relative selection:bg-indigo-500/20 selection:text-indigo-600 flex flex-col justify-between">

      {/* Subtle ambient light */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-100/30 blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-[350px] h-[350px] rounded-full bg-slate-200/20 blur-3xl"></div>
      </div>

      <div>
        {/* Top Header */}
        <Header
          onOpenPostModal={() => navigateToTab('post')}
          onOpenLoginModal={() => setShowLoginModal(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentTab={currentTab}
          setCurrentTab={(tab) => navigateToTab(tab)}
          onNavigate={handleNavigate}
        />

        {/* Sub-Navigation Desktop & Mobile */}
        <Navigation
          currentTab={currentTab}
          setCurrentTab={(tab) => navigateToTab(tab)}
          pendingCount={pendingClaimsCount}
          onOpenPostModal={() => navigateToTab('post')}
        />

        {/* Universal Sticky "Go Back" Floating Navigation Pill if outside feed */}
        {currentTab !== 'feed' && (
          <aside aria-label="Quick Return" className="fixed bottom-20 left-4 z-40 hidden sm:block">
            <button
              type="button"
              onClick={handleGoBack}
              title="Go back to previous screen (Esc)"
              className="px-3.5 py-2 rounded-full bg-slate-900/90 hover:bg-slate-900 text-white shadow-lg text-xs font-semibold backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer border border-slate-700/60"
            >
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              <span>Go Back</span>
              <kbd className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded border border-slate-700 font-mono">Esc</kbd>
            </button>
          </aside>
        )}

        {/* Main Body Stage */}
        <main className="relative z-10">
          {currentTab === 'feed' && (
            <LiveFeedScreen
              onSelectItem={handleSelectItem}
              onOpenPostModal={() => navigateToTab('post')}
              onOpenClaimModal={handleOpenClaimModal}
              searchQuery={searchQuery}
              onNavigateTab={handleNavigate}
            />
          )}

          {currentTab === 'post' && (
            <PostItemScreen
              onPostCreated={() => navigateToTab('feed')}
              onCancel={handleGoBack}
            />
          )}

          {currentTab === 'detail' && selectedItem && (
            <ItemDetailScreen
              item={selectedItem}
              onBack={handleGoBack}
              onNavigate={handleNavigate}
              onClaimSuccess={(claimData) => {
                if (selectedItem?.id) setActiveHandoverItemId(selectedItem.id);
                navigateToTab('handover', { itemId: selectedItem?.id });
              }}
            />
          )}

          {currentTab === 'map' && (
            <CampusMapScreen 
              onSelectItem={handleSelectItem} 
              focusedBuilding={focusedBuilding}
              onNavigateTab={handleNavigate}
              onBack={handleGoBack}
            />
          )}

          {currentTab === 'admin' && (
            <AdminQueueScreen
              onSelectItem={handleSelectItem}
              onHandoverApproved={() => navigateToTab('handover')}
              onNavigateTab={handleNavigate}
              onBack={handleGoBack}
            />
          )}

          {currentTab === 'handover' && (
            <HandoverChatScreen 
              activeItemId={activeHandoverItemId}
              onNavigateTab={handleNavigate}
              onBack={handleGoBack}
            />
          )}

          {currentTab === 'leaderboard' && (
            <LeaderboardScreen 
              onNavigateTab={handleNavigate}
              onBack={handleGoBack}
            />
          )}
        </main>
      </div>

      {/* Floating Bottom-Right Message Toast Popup */}
      <MessageToastContainer onNavigate={handleNavigate} />

      {/* Minimal Footer */}
      <footer className="mt-16 border-t border-slate-200/80 bg-white relative z-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">ReTrace</span>
            <span>•</span>
            <span>University Campus Recovery Network</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <button onClick={() => setCurrentTab('leaderboard')} className="hover:text-indigo-600 transition-colors cursor-pointer font-medium text-amber-600">
              🏆 Leaderboard & Bounties
            </button>
            <button onClick={() => setCurrentTab('map')} className="hover:text-indigo-600 transition-colors cursor-pointer">
              Safe Zones
            </button>
            <button onClick={() => setCurrentTab('admin')} className="hover:text-indigo-600 transition-colors cursor-pointer">
              Desk Verification
            </button>
            <button onClick={() => setCurrentTab('post')} className="hover:text-indigo-600 transition-colors cursor-pointer">
              Post Report
            </button>
          </div>
          <span className="text-slate-400">
            © 2026 Campus Commons
          </span>
        </div>
      </footer>

      {/* Login / Campus SSO Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </AuthProvider>
  );
}
