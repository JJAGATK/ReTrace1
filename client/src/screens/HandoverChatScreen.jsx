import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function HandoverChatScreen({ activeItemId: initialItemId = 'REC-8842' }) {
  const { user, token } = useAuth();
  const [activeItemId, setActiveItemId] = useState(initialItemId);
  const [allHandovers, setAllHandovers] = useState([]);
  const [handoverData, setHandoverData] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const messagesEndRef = useRef(null);

  const quickChips = [
    "I'm at the Cabot circulation desk now",
    "On my way! Will be there in 5 minutes",
    "I have my verified Student ID card ready",
    "Item safely received. Thank you so much!"
  ];

  // Sync with prop changes
  useEffect(() => {
    if (initialItemId) {
      setActiveItemId(initialItemId);
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
        setMessages(mData.messages || []);
      }
    } catch (e) {
      console.error('Handover fetch error', e);
    } finally {
      if (!isPoll) setLoading(false);
    }
  };

  useEffect(() => {
    if (activeItemId && token) {
      fetchHandoverAndMessages(false);
      // Live polling every 3 seconds for instant chat sync
      const interval = setInterval(() => {
        fetchHandoverAndMessages(true);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [activeItemId, token]);

  // Auto scroll to latest message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

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

  if (loading && !handoverData) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-16 text-center">
        <span className="material-symbols-outlined text-3xl text-[#4648d4] animate-spin mb-2">sync</span>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Decrypting secure ReTrace handover chamber...</p>
      </div>
    );
  }

  const isFinder = user?.id === handoverData?.handover?.finder_id || (handoverData?.item && user?.id === handoverData?.item?.user_id);
  const isClaimant = user?.id === handoverData?.handover?.claimant_id || (!isFinder && user?.role !== 'admin');
  const isAdmin = user?.role === 'admin';

  const finderConfirmed = Boolean(handoverData?.handover?.finder_confirmed);
  const claimantConfirmed = Boolean(handoverData?.handover?.claimant_confirmed);
  const isCompleted = handoverData?.handover?.status === 'completed' || (finderConfirmed && claimantConfirmed);

  // Check if current user has already signed
  const userHasSigned = (isFinder && finderConfirmed) || (isClaimant && claimantConfirmed) || (isAdmin && finderConfirmed && claimantConfirmed);

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 text-[#1a1b25] dark:text-white">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1b25] dark:bg-[#1a1c2e] text-white shadow-2xl text-xs font-semibold border border-indigo-500/30 animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#10B981] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25] dark:text-white">
              ReTrace Verified Safe Handover Chamber
            </h1>
          </div>
          <p className="text-xs text-[#464554] dark:text-slate-400 mt-0.5">
            Admin-approved coordination channel with physical custody verification and dual-signature sign-off.
          </p>
        </div>

        {/* Handover Session Selector if multiple */}
        <div className="flex items-center gap-2">
          {allHandovers.length > 1 && (
            <select
              value={activeItemId}
              onChange={(e) => setActiveItemId(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-white dark:bg-[#1a1c2e] border border-indigo-200 dark:border-indigo-800 text-xs font-semibold text-[#1a1b25] dark:text-white shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
            >
              {allHandovers.map(h => (
                <option key={h.id} value={h.item_id}>
                  Item #{h.item_id} — {h.item_title}
                </option>
              ))}
            </select>
          )}

          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isCompleted
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40'
              : 'bg-indigo-50 text-[#4648d4] dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
          }`}>
            {isCompleted ? '✓ Handover Completed' : 'Session Active'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Meeting Details & Dynamic QR Code (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Handover Badge Card */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 dark:border-indigo-800/80 shadow-lg flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Item</span>
                <h3 className="text-sm font-bold text-[#1a1b25] dark:text-white">
                  {handoverData?.item?.title || 'Apple AirPods Pro'}
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-[#4648d4] dark:text-indigo-400">
                #{handoverData?.item?.id || activeItemId}
              </span>
            </div>

            {/* Scheduled Location */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-800/60 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-900/60 text-[#4648d4] dark:text-indigo-300 shrink-0">
                <span className="material-symbols-outlined text-lg">local_police</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-[#1a1b25] dark:text-white block">Safe Meeting Checkpoint:</span>
                <p className="text-[#464554] dark:text-slate-300 font-medium mt-0.5">
                  {handoverData?.handover?.location_name || 'Cabot Science Library Circulation Desk'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Time: {handoverData?.handover?.scheduled_time || 'Today until 11:00 PM'}
                </p>
              </div>
            </div>

            {/* Dynamic Handover QR Code Token */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-100 dark:border-indigo-800/60 flex flex-col items-center justify-center text-center">
              <div className="w-32 h-32 bg-white rounded-xl p-2 shadow-md border border-indigo-100 flex items-center justify-center mb-2">
                {/* Stylized QR representation */}
                <div className="w-full h-full border-4 border-[#1a1b25] p-1.5 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-5 h-5 bg-[#1a1b25]"></div>
                    <div className="w-5 h-5 bg-[#1a1b25]"></div>
                  </div>
                  <div className="text-[8px] font-mono font-bold tracking-tighter text-[#4648d4]">
                    RETRACE_ID
                  </div>
                  <div className="flex justify-between">
                    <div className="w-5 h-5 bg-[#1a1b25]"></div>
                    <div className="w-3 h-3 bg-[#4648d4]"></div>
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-bold text-[#1a1b25] dark:text-indigo-300">
                {handoverData?.handover?.qr_code_token || 'RETRACE_QR_8842CABOT'}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Scan at desk intake terminal to verify claim authorization
              </span>
            </div>

            {/* Protected Contact Information */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50 text-xs">
              <div className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                <span>Protected Contact Exchange (Participants Only)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 dark:text-slate-300 mt-1">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">Finder / Custodian:</span>
                  <span className="font-semibold text-[#1a1b25] dark:text-white">{handoverData?.finder?.name || 'Verified Student'}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block font-medium">Verified Claimant:</span>
                  <span className="font-semibold text-[#1a1b25] dark:text-white">{handoverData?.claimant?.name || 'Julian Vance'}</span>
                </div>
              </div>
            </div>

            {/* Dual Confirmation Actions */}
            <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#1a1b25] dark:text-white">Dual-Confirmation Status:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    finderConfirmed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-[#1e2034] text-slate-500 dark:text-slate-400'
                  }`}>
                    Finder: {finderConfirmed ? 'Signed ✓' : 'Pending'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    claimantConfirmed
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-[#1e2034] text-slate-500 dark:text-slate-400'
                  }`}>
                    Claimant: {claimantConfirmed ? 'Signed ✓' : 'Pending'}
                  </span>
                </div>
              </div>

              {!isCompleted ? (
                <div>
                  <button
                    type="button"
                    disabled={confirming}
                    onClick={handleConfirm}
                    className="w-full py-3 px-4 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">
                      {userHasSigned ? 'verified' : 'check_circle'}
                    </span>
                    <span>
                      {isAdmin
                        ? 'Desk Officer Verify & Complete Handover'
                        : isFinder
                        ? (finderConfirmed ? 'Item Handed Over (Signed ✓)' : 'Confirm Item Handed Over')
                        : (claimantConfirmed ? 'Item Received (Signed ✓)' : 'Confirm Item Received')}
                    </span>
                  </button>
                  {userHasSigned && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 text-center font-semibold mt-1.5">
                      ✓ Your sign-off is recorded. Waiting for the second party to confirm!
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-center text-xs font-bold flex items-center justify-center gap-1.5 border border-emerald-300/40">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Handover Complete. Chain of custody closed.</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Handover Chat (7 Cols) */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 dark:border-indigo-800/80 shadow-lg flex flex-col h-[540px]">
          
          <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/60 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4648d4] dark:text-indigo-400 text-xl">forum</span>
              <h3 className="text-sm font-bold text-[#1a1b25] dark:text-white">Coordination Dispatch Chat</h3>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">Encrypted End-to-End</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-1">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 text-xs">
                <span className="material-symbols-outlined text-3xl mb-1">chat_bubble_outline</span>
                <span>No messages yet. Send a note or click a quick response below to coordinate!</span>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === user?.id || (m.sender_name && user?.name && m.sender_name.toLowerCase().includes(user.name.toLowerCase()));
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {m.sender_name || (isMe ? 'You' : 'Classmate')}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-gradient-to-r from-[#4648d4] to-[#6b38d4] text-white shadow-sm rounded-tr-xs'
                          : m.is_staff || m.sender_role === 'admin'
                          ? 'bg-purple-100/80 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-200 font-medium rounded-tl-xs'
                          : 'bg-white dark:bg-[#1a1c2e] border border-indigo-100 dark:border-indigo-800/80 text-[#1a1b25] dark:text-white shadow-xs rounded-tl-xs'
                      }`}
                    >
                      {m.text || m.message}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Coordination Chips */}
          <div className="py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => handleSendMessage(e, chip)}
                className="shrink-0 px-2.5 py-1 rounded-full bg-indigo-50/80 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-[#4648d4] dark:text-indigo-300 text-[11px] font-medium border border-indigo-200/60 dark:border-indigo-800/60 transition-colors cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 flex items-center gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Send coordination note to desk & classmate..."
              className="flex-1 px-4 py-2.5 rounded-full bg-white dark:bg-[#1a1c2e] border border-indigo-100 dark:border-indigo-800/80 text-xs text-[#1a1b25] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
            />
            <button
              type="submit"
              disabled={!newMsg.trim()}
              className="p-2.5 rounded-full btn-gradient-indigo text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}

