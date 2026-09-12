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
        <p className="text-xs text-slate-500 font-semibold">Decrypting secure ReTrace handover chamber...</p>
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
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 text-slate-900">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white shadow-lg text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h1 className="text-xl font-bold text-slate-900">
              Verified Handover Chamber
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin-approved coordination with physical custody verification and dual-signature sign-off.
          </p>
        </div>

        {/* Handover Session Selector if multiple */}
        <div className="flex items-center gap-2">
          {allHandovers.length > 1 && (
            <select
              value={activeItemId}
              onChange={(e) => setActiveItemId(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-slate-800 shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {allHandovers.map(h => (
                <option key={h.id} value={h.item_id}>
                  Item #{h.item_id} — {h.item_title}
                </option>
              ))}
            </select>
          )}

          <span className={`px-2.5 py-1 rounded-md text-xs font-medium ${
            isCompleted
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}>
            {isCompleted ? '✓ Completed' : 'Session Active'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT COLUMN: Meeting Details & Dynamic QR Code (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          
          {/* Handover Badge Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">Target Item</span>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-900">
                  {handoverData?.item?.title || 'Apple AirPods Pro'}
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-indigo-600">
                #{handoverData?.item?.id || activeItemId}
              </span>
            </div>

            {/* Scheduled Location */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 flex items-start gap-3">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 shrink-0">
                <span className="material-symbols-outlined text-base">local_police</span>
              </div>
              <div className="text-xs">
                <span className="font-semibold text-slate-800 block">Safe Meeting Checkpoint:</span>
                <p className="text-slate-600 mt-0.5">
                  {handoverData?.handover?.location_name || 'Cabot Science Library Circulation Desk'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Time: {handoverData?.handover?.scheduled_time || 'Today until 11:00 PM'}
                </p>
              </div>
            </div>

            {/* Dynamic Handover QR Code Token */}
            <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 flex flex-col items-center justify-center text-center">
              <div className="w-28 h-28 bg-white rounded-lg p-2 shadow-xs border border-slate-200 flex items-center justify-center mb-2">
                {/* Stylized QR representation */}
                <div className="w-full h-full border-2 border-slate-900 p-1 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 bg-slate-900"></div>
                    <div className="w-4 h-4 bg-slate-900"></div>
                  </div>
                  <div className="text-[8px] font-mono font-bold tracking-tighter text-indigo-600">
                    RETRACE_ID
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 bg-slate-900"></div>
                    <div className="w-3 h-3 bg-indigo-600"></div>
                  </div>
                </div>
              </div>
              <span className="font-mono text-[11px] font-semibold text-slate-900">
                {handoverData?.handover?.qr_code_token || 'RETRACE_QR_8842CABOT'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Scan at desk intake terminal to verify claim authorization
              </span>
            </div>

            {/* Protected Contact Information */}
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 text-xs">
              <div className="font-semibold text-emerald-800 flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                <span>Protected Contact Exchange (Participants Only)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 mt-1">
                <div>
                  <span className="text-slate-400 block">Finder / Custodian:</span>
                  <span className="font-medium text-slate-800">{handoverData?.finder?.name || 'Verified Student'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Verified Claimant:</span>
                  <span className="font-medium text-slate-800">{handoverData?.claimant?.name || 'Julian Vance'}</span>
                </div>
              </div>
            </div>

            {/* Dual Confirmation Actions */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-700">Dual-Confirmation:</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    finderConfirmed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    Finder: {finderConfirmed ? 'Signed ✓' : 'Pending'}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    claimantConfirmed
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500'
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
                    className="w-full py-2.5 px-4 rounded-lg btn-gradient-indigo text-white text-xs font-semibold shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    <p className="text-[11px] text-emerald-600 text-center font-medium mt-1.5">
                      ✓ Your sign-off is recorded. Waiting for second party to confirm.
                    </p>
                  )}
                </div>
              ) : (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-center text-xs font-semibold flex items-center justify-center gap-1.5 border border-emerald-200">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Handover Complete. Chain of custody sealed.</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Handover Chat (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col h-[520px]">
          
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-lg">forum</span>
              <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Coordination Chat</h3>
            </div>
            <span className="text-[11px] text-slate-400">Encrypted</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-2.5 pr-0.5">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-2xl mb-1 text-slate-300">chat_bubble_outline</span>
                <span>No messages yet. Send a note below to coordinate!</span>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === user?.id || (m.sender_name && user?.name && m.sender_name.toLowerCase().includes(user.name.toLowerCase()));
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[82%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <span className="font-medium text-slate-600">
                        {m.sender_name || (isMe ? 'You' : 'Classmate')}
                      </span>
                      <span>•</span>
                      <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : m.is_staff || m.sender_role === 'admin'
                          ? 'bg-purple-50 border border-purple-200 text-purple-950 font-medium'
                          : 'bg-slate-100 text-slate-800'
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
                className="shrink-0 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-medium border border-slate-200/60 transition-colors cursor-pointer"
              >
                + {chip}
              </button>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Send coordination message..."
              className="flex-1 px-3.5 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={!newMsg.trim()}
              className="p-2 rounded-lg btn-gradient-indigo text-white shadow-xs active:scale-95 transition-all cursor-pointer flex items-center justify-center disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}

