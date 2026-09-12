import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function HandoverChatScreen({ activeItemId: initialItemId = 'REC-8842', onNavigateTab, onBack }) {
  const { user, token } = useAuth();
  const [activeItemId, setActiveItemId] = useState(initialItemId);
  const [allHandovers, setAllHandovers] = useState([]);
  const [handoverData, setHandoverData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showHandoverDetails, setShowHandoverDetails] = useState(true);
  const [showMobileChatView, setShowMobileChatView] = useState(true);
  const [showUnreadPill, setShowUnreadPill] = useState(false);

  const chatContainerRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const prevMessagesLengthRef = useRef(0);
  const initialScrollDoneRef = useRef(false);

  const quickChips = [
    "I'm at the circulation desk now",
    "On my way! Will be there in 5 mins",
    "I have my verified Student ID ready",
    "Item safely received. Thank you!"
  ];

  // Sync prop changes
  useEffect(() => {
    if (initialItemId) {
      setActiveItemId(initialItemId);
      setShowMobileChatView(true);
    }
  }, [initialItemId]);

  // Load all available handover sessions
  const loadSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/handovers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const list = data.handovers || [];
        setAllHandovers(list);
        if (list.length > 0 && (!activeItemId || !list.some(h => h.item_id === activeItemId))) {
          setActiveItemId(list[0].item_id);
        }
      }
    } catch (e) {
      console.error('Failed to load handover sessions', e);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [token]);

  const fetchHandoverAndMessages = async (isPoll = false) => {
    if (!activeItemId || !token) return;
    try {
      if (!isPoll) setLoading(true);
      // Fetch handover details
      const hRes = await fetch(`/api/handovers/${activeItemId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (hRes.ok) {
        const hData = await hRes.json();
        setHandoverData(hData);
      }

      // Fetch persisted chat messages
      const mRes = await fetch(`/api/handovers/${activeItemId}/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (mRes.ok) {
        const mData = await mRes.json();
        const incomingMessages = mData.messages || [];
        setMessages(incomingMessages);
      }
    } catch (e) {
      console.error('Handover fetch error', e);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    if (activeItemId && token) {
      initialScrollDoneRef.current = false;
      fetchHandoverAndMessages(false);

      const interval = setInterval(() => {
        fetchHandoverAndMessages(true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeItemId, token]);

  // Smart Auto-Scroll Behavior
  const scrollToBottom = (smooth = true) => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
      setShowUnreadPill(false);
      isNearBottomRef.current = true;
    }
  };

  const handleScroll = () => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isAtBottom = distanceToBottom < 90;
    isNearBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setShowUnreadPill(false);
    }
  };

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    if (!initialScrollDoneRef.current) {
      // First load of active chat: scroll to bottom instantly
      setTimeout(() => {
        scrollToBottom(false);
        initialScrollDoneRef.current = true;
      }, 50);
    } else if (messages.length > prevMessagesLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      const isMyMsg = lastMsg?.sender_id === user?.id;

      if (isMyMsg || isNearBottomRef.current) {
        // Scroll down automatically if user sent it or user is already at bottom
        scrollToBottom(true);
      } else {
        // User is scrolled up reading history: do NOT jump down, show pill
        setShowUnreadPill(true);
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, user?.id]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendMessage = async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = (directText || newMsg || '').trim();
    if (!textToSend || !token) return;

    if (!directText) setNewMsg('');

    // Optimistic message display
    const tempMsgId = 'TEMP-' + Date.now();
    const tempMsg = {
      id: tempMsgId,
      sender_id: user?.id,
      sender_name: user?.name || 'You',
      sender_role: user?.role || 'student',
      text: textToSend,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);
    setTimeout(() => scrollToBottom(true), 40);

    try {
      const res = await fetch(`/api/handovers/${activeItemId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          text: textToSend,
          handover_id: handoverData?.handover?.id
        })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => m.id === tempMsgId ? (data.message || m) : m));
        loadSessions();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || 'Failed to send message');
      }
    } catch (err) {
      showToast('Network error sending message');
    }
  };

  const handleConfirm = async () => {
    if (!token) {
      showToast('Please sign in to confirm handover');
      return;
    }
    setConfirming(true);
    try {
      const res = await fetch(`/api/handovers/${activeItemId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.isFullyCompleted) {
          showToast('✓ Dual Confirmation Complete! Item safely returned and sealed in chain-of-custody.');
        } else {
          showToast(data.message || '✓ Sign-off recorded! Awaiting confirmation from the other party.');
        }
        await fetchHandoverAndMessages();
        loadSessions();
      } else {
        showToast(data.error || 'Failed to record confirmation');
      }
    } catch (e) {
      console.error('Confirmation error', e);
      showToast('Network error processing confirmation');
    } finally {
      setConfirming(false);
    }
  };

  const isFinder = user?.id === handoverData?.handover?.finder_id || (handoverData?.item && user?.id === handoverData?.item?.user_id);
  const isClaimant = user?.id === handoverData?.handover?.claimant_id || (!isFinder && user?.role !== 'admin');
  const isAdmin = user?.role === 'admin';

  const finderConfirmed = Boolean(handoverData?.handover?.finder_confirmed);
  const claimantConfirmed = Boolean(handoverData?.handover?.claimant_confirmed);
  const isCompleted = handoverData?.handover?.status === 'completed' || (finderConfirmed && claimantConfirmed);

  const userHasSigned = (isFinder && finderConfirmed) || (isClaimant && claimantConfirmed) || (isAdmin && finderConfirmed && claimantConfirmed);

  // Filter handover chats for WhatsApp sidebar
  const filteredHandovers = allHandovers.filter(h => {
    if (!searchFilter.trim()) return true;
    const term = searchFilter.toLowerCase();
    const titleMatch = (h.item_title || '').toLowerCase().includes(term);
    const idMatch = (h.item_id || '').toLowerCase().includes(term);
    const finderMatch = (h.finder_name || '').toLowerCase().includes(term);
    const claimantMatch = (h.claimant_name || '').toLowerCase().includes(term);
    return titleMatch || idMatch || finderMatch || claimantMatch;
  });

  // Get current active partner information
  const partnerName = isFinder
    ? (handoverData?.claimant?.name || handoverData?.handover?.claimant_name || 'Verified Claimant')
    : (handoverData?.finder?.name || handoverData?.handover?.finder_name || 'Item Finder / Custodian');
  
  const partnerAvatar = isFinder
    ? (handoverData?.claimant?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80')
    : (handoverData?.finder?.avatar_url || 'https://lh3.googleusercontent.com/aida/AEtjO1VKdmUxVG-N5A5XZLSCGGS6rtwjUGLfaVH3Dp0s6J0SaP324w1jGNJ0D2s8k6BIldEAtdKQdNSIEwtW7-xZAXZhyLIpW2kjsdNTzscC5WRFrvvmYNILvyIwyaaNHG2Y6RBXECtF1wbgoy9N4Uhwf7RhsHJPYtE0z2DZ_0fI5XouhJcRzEUf011ylXziLJHY9Xs2KI_ttBi07vd51-KNZzTBuFs2Rl9CUzH4xXAg4aCSStxwHZ3hvRXVSzo');

  const partnerRoleLabel = isFinder ? 'Claimant' : (user?.role === 'admin' ? 'Participant' : 'Finder');

  return (
    <div className="max-w-[1280px] mx-auto px-2 sm:px-6 lg:px-8 py-4 pb-20 text-slate-900">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (onBack) onBack();
              else if (onNavigateTab) onNavigateTab('feed');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>← Back to Live Feed</span>
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-xl">forum</span>
              <span>ReTrace Messages & Coordination</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('map')}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-indigo-600">map</span>
              <span>Safe Zones Map</span>
            </button>
          )}
        </div>
      </div>

      {/* WHATSAPP 2-COLUMN LAYOUT CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[640px] h-[calc(100vh-180px)] max-h-[820px]">
        
        {/* ========================================================= */}
        {/* LEFT SIDEBAR: WHATSAPP CHATS LIST (4 cols desktop)       */}
        {/* ========================================================= */}
        <div className={`md:col-span-4 lg:col-span-4 border-r border-slate-200/80 bg-slate-50/50 flex flex-col h-full ${
          showMobileChatView ? 'hidden md:flex' : 'flex'
        }`}>
          
          {/* Sidebar Top Search & Header */}
          <div className="p-3.5 border-b border-slate-200/80 bg-white space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Conversations</span>
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px]">
                  {allHandovers.length}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Verified Encrypted</span>
            </div>

            {/* Search filter input */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-base">search</span>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search chats or items..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200/80 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredHandovers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">chat_bubble_outline</span>
                <p className="font-medium text-slate-600">No conversations found</p>
                <p className="text-[11px] text-slate-400 mt-1">Submit an ownership claim on the Live Feed to start a handover chat.</p>
              </div>
            ) : (
              filteredHandovers.map((h) => {
                const isActive = h.item_id === activeItemId;
                const otherPartyName = user?.id === h.finder_id ? (h.claimant_name || 'Claimant') : (h.finder_name || 'Finder / Custodian');
                const otherPartyAvatar = user?.id === h.finder_id ? h.claimant_avatar : h.finder_avatar;
                const isItemCompleted = h.status === 'completed' || (h.finder_confirmed && h.claimant_confirmed);

                const timeStr = h.last_message_time
                  ? new Date(h.last_message_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '';

                return (
                  <button
                    key={h.id}
                    onClick={() => {
                      setActiveItemId(h.item_id);
                      setShowMobileChatView(true);
                    }}
                    className={`w-full p-3.5 text-left transition-all flex items-start gap-3 cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/90 border-l-4 border-indigo-600 shadow-xs'
                        : 'hover:bg-slate-100/70 bg-white'
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {otherPartyAvatar ? (
                        <img
                          src={otherPartyAvatar}
                          alt={otherPartyName}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-slate-200/80"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-2xs">
                          {otherPartyName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ring-2 ring-white ${
                        isItemCompleted ? 'bg-emerald-500' : 'bg-indigo-500 animate-pulse'
                      }`}></span>
                    </div>

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className={`text-xs font-semibold truncate ${isActive ? 'text-indigo-950 font-bold' : 'text-slate-900'}`}>
                          {otherPartyName}
                        </h4>
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">{timeStr}</span>
                      </div>

                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100 truncate">
                          #{h.item_id}
                        </span>
                        <span className="text-[11px] text-slate-600 font-medium truncate">
                          {h.item_title}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 truncate line-clamp-1">
                        {h.last_sender ? `${h.last_sender.split(' ')[0]}: ` : ''}{h.last_message || 'Handover session initiated'}
                      </p>
                    </div>

                    {/* Status Pill */}
                    <div className="shrink-0 pt-0.5">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        isItemCompleted
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-indigo-100 text-indigo-800'
                      }`}>
                        {isItemCompleted ? '✓ Done' : 'Active'}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT PANEL: MAIN ACTIVE CHAT WINDOW (8 cols desktop)     */}
        {/* ========================================================= */}
        <div className={`md:col-span-8 lg:col-span-8 flex flex-col h-full bg-white ${
          !showMobileChatView ? 'hidden md:flex' : 'flex'
        }`}>
          
          {loading && !handoverData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <span className="material-symbols-outlined text-3xl text-indigo-600 animate-spin mb-2">sync</span>
              <p className="text-xs font-semibold text-slate-600">Loading conversation history...</p>
            </div>
          ) : !handoverData ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">chat</span>
              <p className="text-sm font-semibold text-slate-700">Select a chat to begin messaging</p>
            </div>
          ) : (
            <>
              {/* CHAT HEADER BAR */}
              <div className="px-4 py-3 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shadow-2xs">
                
                <div className="flex items-center gap-3 min-w-0">
                  {/* Mobile Back to List Button */}
                  <button
                    type="button"
                    onClick={() => setShowMobileChatView(false)}
                    className="md:hidden p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs cursor-pointer shrink-0"
                    title="Back to conversation list"
                  >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                  </button>

                  {/* Partner Avatar */}
                  <img
                    src={partnerAvatar}
                    alt={partnerName}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-indigo-500/20 shrink-0"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                        {partnerName}
                      </h3>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60 shrink-0">
                        {partnerRoleLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Item:</span> {handoverData?.item?.title} 
                      <span className="font-mono text-indigo-600 font-bold">(#{handoverData?.item?.id || activeItemId})</span>
                    </p>
                  </div>
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowHandoverDetails(!showHandoverDetails)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      showHandoverDetails
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                    title="Toggle Handover Checkpoint & QR Code Details"
                  >
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span className="hidden sm:inline">{showHandoverDetails ? 'Hide Checkpoint' : 'View Checkpoint & QR'}</span>
                  </button>

                  <span className={`px-2 py-1 rounded-md text-[11px] font-semibold ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {isCompleted ? '✓ Completed' : 'Active'}
                  </span>
                </div>

              </div>

              {/* COLLAPSIBLE HANDOVER DETAILS & DUAL SIGN-OFF DRAWER */}
              {showHandoverDetails && (
                <div className="p-3.5 bg-slate-50/90 border-b border-slate-200/80 animate-in fade-in duration-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    
                    {/* Location Info */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs flex items-start gap-2 shadow-2xs">
                      <span className="material-symbols-outlined text-indigo-600 text-base mt-0.5">location_on</span>
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block text-[11px]">Safe Meeting Point</span>
                        <p className="text-slate-600 text-[11px] truncate">
                          {handoverData?.handover?.location_name || 'Cabot Science Library Circulation Desk'}
                        </p>
                      </div>
                    </div>

                    {/* QR Token */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs flex items-center justify-between shadow-2xs">
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 block text-[11px]">Verification QR Token</span>
                        <span className="font-mono text-[11px] font-bold text-indigo-600 truncate block">
                          {handoverData?.handover?.qr_code_token || 'RETRACE_QR_8842CABOT'}
                        </span>
                      </div>
                      <span className="material-symbols-outlined text-slate-400 text-xl">qr_code_2</span>
                    </div>

                    {/* Dual Confirmation Status */}
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 text-xs flex flex-col justify-between shadow-2xs">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-slate-800">Dual Sign-off:</span>
                        <div className="flex items-center gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${finderConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            Finder {finderConfirmed ? '✓' : ''}
                          </span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${claimantConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            Claimant {claimantConfirmed ? '✓' : ''}
                          </span>
                        </div>
                      </div>

                      {!isCompleted ? (
                        <button
                          type="button"
                          disabled={confirming}
                          onClick={handleConfirm}
                          className="mt-1.5 w-full py-1 px-2 rounded-md btn-gradient-indigo text-white text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50"
                        >
                          <span className="material-symbols-outlined text-xs">
                            {userHasSigned ? 'verified' : 'check_circle'}
                          </span>
                          <span>
                            {isAdmin
                              ? 'Desk Officer Complete'
                              : isFinder
                              ? (finderConfirmed ? 'Signed ✓' : 'Confirm Handed Over')
                              : (claimantConfirmed ? 'Signed ✓' : 'Confirm Received')}
                          </span>
                        </button>
                      ) : (
                        <span className="mt-1 text-[10px] text-emerald-700 font-bold text-center block bg-emerald-50 py-0.5 rounded border border-emerald-200">
                          ✓ Chain of Custody Sealed
                        </span>
                      )}
                    </div>

                  </div>
                </div>
              )}

              {/* MESSAGES FEED AREA WITH SMART SCROLL */}
              <div
                ref={chatContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 relative bg-[#fdfdfd]"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">chat_bubble_outline</span>
                    <p className="font-medium text-slate-600">No messages exchanged yet.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Send a note below to coordinate physical pickup at the safe zone.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMe = m.sender_id === user?.id || (m.sender_name && user?.name && m.sender_name.toLowerCase().includes(user.name.toLowerCase()));
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${
                          isMe ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                          <span className="font-semibold text-slate-700">
                            {m.sender_name || (isMe ? 'You' : 'Classmate')}
                          </span>
                          <span>•</span>
                          <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div
                          className={`p-3 rounded-2xl text-xs leading-relaxed shadow-2xs ${
                            isMe
                              ? 'bg-indigo-600 text-white rounded-tr-none'
                              : m.is_staff || m.sender_role === 'admin'
                              ? 'bg-purple-50 border border-purple-200 text-purple-950 font-medium rounded-tl-none'
                              : 'bg-slate-100 border border-slate-200/60 text-slate-900 rounded-tl-none'
                          }`}
                        >
                          {m.text || m.message}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Floating "New Messages" scroll pill */}
                {showUnreadPill && (
                  <div className="sticky bottom-2 inset-x-0 flex justify-center pointer-events-none z-20">
                    <button
                      type="button"
                      onClick={() => scrollToBottom(true)}
                      className="pointer-events-auto px-3 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg text-xs font-semibold flex items-center gap-1.5 transition-all animate-bounce cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-sm">arrow_downward</span>
                      <span>New messages below</span>
                    </button>
                  </div>
                )}
              </div>

              {/* QUICK COORDINATION CHIPS */}
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => handleSendMessage(e, chip)}
                    className="shrink-0 px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 text-slate-700 text-[11px] font-medium border border-slate-200 shadow-2xs transition-colors cursor-pointer"
                  >
                    + {chip}
                  </button>
                ))}
              </div>

              {/* CHAT INPUT FORM */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-slate-200/80 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Type coordination message..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={!newMsg.trim()}
                  className="p-2.5 rounded-xl btn-gradient-indigo text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
                  title="Send Message"
                >
                  <span className="material-symbols-outlined text-base">send</span>
                </button>
              </form>
            </>
          )}

        </div>

      </div>

    </div>
  );
}


