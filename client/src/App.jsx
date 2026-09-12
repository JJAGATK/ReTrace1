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
import LoginModal from './screens/LoginModal';
import AccountLoginScreen from './screens/AccountLoginScreen';

function MainApp() {
  const { user, token, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState('feed'); // 'feed', 'map', 'admin', 'handover', 'post', 'detail'
  const [selectedItem, setSelectedItem] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [pendingClaimsCount, setPendingClaimsCount] = useState(0);
  const [focusedBuilding, setFocusedBuilding] = useState(null);
  const [activeHandoverItemId, setActiveHandoverItemId] = useState('REC-8842');

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
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenClaimModal = (item) => {
    setSelectedItem(item);
    setCurrentTab('detail');
  };

  const handleNavigate = async (tab, params = {}) => {
    if (params.building) setFocusedBuilding(params.building);
    if (params.itemId) {
      setActiveHandoverItemId(params.itemId);
      if (tab === 'detail' && (!selectedItem || selectedItem.id !== params.itemId)) {
        try {
          const res = await fetch(`/api/items/${params.itemId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.item) setSelectedItem(data.item);
          }
        } catch (e) {}
      }
    }
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          onOpenPostModal={() => setCurrentTab('post')}
          onOpenLoginModal={() => setShowLoginModal(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentTab={currentTab}
          setCurrentTab={setCurrentTab}
          onNavigate={handleNavigate}
        />

        {/* Sub-Navigation Desktop & Mobile */}
        <Navigation
          currentTab={currentTab}
          setCurrentTab={(tab) => {
            setCurrentTab(tab);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          pendingCount={pendingClaimsCount}
          onOpenPostModal={() => {
            setCurrentTab('post');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
        />

        {/* Main Body Stage */}
        <main className="relative z-10">
          {currentTab === 'feed' && (
            <LiveFeedScreen
              onSelectItem={handleSelectItem}
              onOpenPostModal={() => setCurrentTab('post')}
              onOpenClaimModal={handleOpenClaimModal}
              searchQuery={searchQuery}
              onNavigateTab={handleNavigate}
            />
          )}

          {currentTab === 'post' && (
            <PostItemScreen
              onPostCreated={() => {
                setCurrentTab('feed');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onCancel={() => setCurrentTab('feed')}
            />
          )}

          {currentTab === 'detail' && selectedItem && (
            <ItemDetailScreen
              item={selectedItem}
              onBack={() => setCurrentTab('feed')}
              onNavigate={handleNavigate}
              onClaimSuccess={(claimData) => {
                if (selectedItem?.id) setActiveHandoverItemId(selectedItem.id);
                setCurrentTab('handover');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {currentTab === 'map' && (
            <CampusMapScreen 
              onSelectItem={handleSelectItem} 
              focusedBuilding={focusedBuilding}
            />
          )}

          {currentTab === 'admin' && (
            <AdminQueueScreen
              onSelectItem={handleSelectItem}
              onHandoverApproved={() => {
                setCurrentTab('handover');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          )}

          {currentTab === 'handover' && (
            <HandoverChatScreen activeItemId={activeHandoverItemId} />
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
