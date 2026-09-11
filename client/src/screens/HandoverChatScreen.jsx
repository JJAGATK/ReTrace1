import React, { useState, useEffect } from 'react';
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

  // Load all available handover sessions
  useEffect(() => {
    async function loadSessions() {
      if (!token) return;
      try {
        const res = await fetch('/api/handovers', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setAllHandovers(data.handovers || []);
        }
      } catch (e) {
        console.error('Failed to load handover sessions', e);
      }
    }
    loadSessions();
  }, [token]);

  const fetchHandoverAndMessages = async () => {
    try {
      setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeItemId) {
      fetchHandoverAndMessages();
    }
  }, [activeItemId, token]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !token) return;

    const text = newMsg.trim();
    setNewMsg('');

    try {
      const res = await fetch(`/api/handovers/${activeItemId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: text })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data.message]);
      } else {
        showToast('Failed to send message');
      }
    } catch (err) {
      showToast('Network error sending message');
    }
  };

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const res = await fetch(`/api/handovers/${activeItemId}/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isFullyCompleted) {
          showToast('✓ Dual Confirmation Complete! Item safely returned and sealed in chain-of-custody.');
        } else {
          showToast('✓ Sign-off recorded! Awaiting confirmation from the second party.');
        }
        fetchHandoverAndMessages();
      }
    } catch (e) {
      console.error('Confirmation error', e);
    } finally {
      setConfirming(false);
    }
  };

  if (loading && !handoverData) {
    return (
      <div className="max-w-[1240px] mx-auto px-4 py-12 text-center">
        <span className="material-symbols-outlined text-3xl text-[#4648d4] animate-spin mb-2">sync</span>
        <p className="text-xs text-slate-500 font-semibold">Decrypting secure ReTrace handover chamber...</p>
      </div>
    );
  }

  const isFinder = user?.id === handoverData?.handover?.finder_id;
  const isClaimant = user?.id === handoverData?.handover?.claimant_id;
  const isAdmin = user?.role === 'admin';
  const isCompleted = handoverData?.handover?.status === 'completed';

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1b25] text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#10B981] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
              ReTrace Verified Safe Handover Chamber
            </h1>
          </div>
          <p className="text-xs text-[#464554] mt-0.5">
            Admin-approved meeting room with encrypted direct coordinates and dual-signature sign-off.
          </p>
        </div>

        {/* Handover Session Selector if multiple */}
        <div className="flex items-center gap-2">
          {allHandovers.length > 1 && (
            <select
              value={activeItemId}
              onChange={(e) => setActiveItemId(e.target.value)}
              className="px-3 py-1.5 rounded-full bg-white border border-indigo-200 text-xs font-semibold text-[#1a1b25] shadow-xs cursor-pointer"
            >
              {allHandovers.map(h => (
                <option key={h.id} value={h.item_id}>
                  Item #{h.item_id} — {h.item_title}
                </option>
              ))}
            </select>
          )}

          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-50 text-[#4648d4] border border-indigo-200'
          }`}>
            {isCompleted ? '✓ Handover Completed' : 'Session Active'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Meeting Details & Dynamic QR Code (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Handover Badge Card */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-lg flex flex-col gap-4">
            
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Item</span>
                <h3 className="text-sm font-bold text-[#1a1b25]">
                  {handoverData?.item?.title || 'Apple AirPods Pro'}
                </h3>
              </div>
              <span className="font-mono text-xs font-bold text-[#4648d4]">
                #{handoverData?.item?.id || activeItemId}
              </span>
            </div>

            {/* Scheduled Location */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-[#4648d4] shrink-0">
                <span className="material-symbols-outlined text-lg">local_police</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-[#1a1b25] block">Safe Meeting Checkpoint:</span>
                <p className="text-[#464554] font-medium mt-0.5">
                  {handoverData?.handover?.location_name || 'Cabot Science Library Circulation Desk'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Time: {handoverData?.handover?.scheduled_time || 'Today until 11:00 PM'}
                </p>
              </div>
            </div>

            {/* Dynamic Handover QR Code Token */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 flex flex-col items-center justify-center text-center">
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
              <span className="font-mono text-[11px] font-bold text-[#1a1b25]">
                {handoverData?.handover?.qr_code_token || 'RETRACE_QR_8842CABOT'}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Scan at desk intake terminal to verify claim authorization
              </span>
            </div>

            {/* Protected Contact Information (Revealed ONLY post-approval) */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 text-xs">
              <div className="font-bold text-emerald-800 flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                <span>Protected Contact Exchange (Participants Only)</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 mt-1">
                <div>
                  <span className="text-slate-400 block font-medium">Finder / Custodian:</span>
                  <span className="font-semibold text-[#1a1b25]">{handoverData?.finder?.name || 'Verified Student'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Verified Claimant:</span>
                  <span className="font-semibold text-[#1a1b25]">{handoverData?.claimant?.name || 'Julian Vance'}</span>
                </div>
              </div>
            </div>

            {/* Dual Confirmation Actions */}
            <div className="pt-2 border-t border-indigo-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-bold text-[#1a1b25]">Dual-Confirmation Status:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    handoverData?.handover?.finder_confirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    Finder: {handoverData?.handover?.finder_confirmed ? 'Signed' : 'Pending'}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    handoverData?.handover?.claimant_confirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    Claimant: {handoverData?.handover?.claimant_confirmed ? 'Signed' : 'Pending'}
                  </span>
                </div>
              </div>

              {!isCompleted ? (
                <button
                  type="button"
                  disabled={confirming}
                  onClick={handleConfirm}
                  className="w-full py-3 px-4 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md shadow-indigo-500/25 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  <span>
                    {isAdmin
                      ? 'Desk Officer Verify & Complete Handover'
                      : isFinder
                      ? 'Confirm Item Handed Over'
                      : 'Confirm Item Received'}
                  </span>
                </button>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800 text-center text-xs font-bold flex items-center justify-center gap-1.5">
                  <span className="material-symbols-outlined text-base">verified</span>
                  <span>Handover Complete. Chain of custody closed.</span>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* RIGHT COLUMN: Handover Chat (7 Cols) */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-lg flex flex-col h-[520px]">
          
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4648d4] text-xl">forum</span>
              <h3 className="text-sm font-bold text-[#1a1b25]">Coordination Dispatch Chat</h3>
            </div>
            <span className="text-[11px] text-slate-400">Encrypted End-to-End</span>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col gap-3 pr-1">
            {messages.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs">
                <span className="material-symbols-outlined text-3xl mb-1">chat_bubble_outline</span>
                <span>No messages yet. Send a note to coordinate meetup!</span>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_id === user?.id || (m.sender_name && m.sender_name.includes(user?.name || '---'));
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[80%] ${
                      isMe ? 'self-end items-end' : 'self-start items-start'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-0.5">
                      <span className="font-semibold text-slate-700">{m.sender_name || (isMe ? 'You' : 'Classmate')}</span>
                      <span>•</span>
                      <span>{new Date(m.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-gradient-to-r from-[#4648d4] to-[#6b38d4] text-white shadow-sm rounded-tr-xs'
                          : m.is_staff || m.sender_role === 'admin'
                          ? 'bg-purple-100/70 border border-purple-200 text-purple-950 font-medium rounded-tl-xs'
                          : 'bg-white border border-indigo-100 text-[#1a1b25] shadow-xs rounded-tl-xs'
                      }`}
                    >
                      {m.message || m.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="pt-3 border-t border-indigo-100 flex items-center gap-2">
            <input
              type="text"
              value={newMsg}
              onChange={(e) => setNewMsg(e.target.value)}
              placeholder="Send coordination note to desk & classmate..."
              className="flex-1 px-4 py-2.5 rounded-full bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
            />
            <button
              type="submit"
              className="p-2.5 rounded-full btn-gradient-indigo text-white shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
            >
              <span className="material-symbols-outlined text-base">send</span>
            </button>
          </form>

        </div>

      </div>

    </div>
  );
}
