import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Navigation from './components/Navigation';
import LiveFeedScreen from './screens/LiveFeedScreen';
import PostItemScreen from './screens/PostItemScreen';
import ItemDetailScreen from './screens/ItemDetailScreen';
import CampusMapScreen from './screens/CampusMapScreen';
import AdminQueueScreen from './screens/AdminQueueScreen';
import HandoverChatScreen from './screens/HandoverChatScreen';
import LoginModal from './screens/LoginModal';

function MainApp() {
  const { user, token } = useAuth();
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

  const handleNavigate = (tab, params = {}) => {
    if (params.building) setFocusedBuilding(params.building);
    if (params.itemId) setActiveHandoverItemId(params.itemId);
    setCurrentTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#fbf8ff] text-[#1a1b25] relative selection:bg-indigo-500/20 selection:text-indigo-600 flex flex-col justify-between">
      
      {/* Ambient background gradients from Stitch design */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[320px] md:w-[600px] h-[320px] md:h-[600px] rounded-full bg-indigo-200/35 blur-3xl opacity-70"></div>
        <div className="absolute top-1/3 -right-24 w-[280px] md:w-[500px] h-[280px] md:h-[500px] rounded-full bg-violet-200/30 blur-3xl opacity-60"></div>
        <div className="absolute bottom-10 left-10 w-[300px] md:w-[550px] h-[300px] md:h-[550px] rounded-full bg-purple-100/40 blur-3xl opacity-50"></div>
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
              onClaimSuccess={() => {
                setCurrentTab('admin');
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

      {/* Campus Protocol Footer */}
      <footer className="mt-12 border-t border-indigo-100/80 bg-white/40 backdrop-blur-md relative z-10">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-500 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1a1b25]">ReTrace</span>
            <span>•</span>
            <span>Official University Campus Recovery Protocol</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[11px]">
            <button onClick={() => setCurrentTab('map')} className="hover:text-[#4648d4] transition-colors cursor-pointer">
              Safe Exchange Zones
            </button>
            <button onClick={() => setCurrentTab('admin')} className="hover:text-[#4648d4] transition-colors cursor-pointer">
              Cabot Desk Verification
            </button>
            <a href="#" className="hover:text-[#4648d4] transition-colors">
              Privacy & PII Encryption
            </a>
          </div>
          <span className="text-[11px] text-slate-400">
            © 2026 University Campus Commons. All rights reserved.
          </span>
        </div>
      </footer>

      {/* Login / Campus SSO Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
