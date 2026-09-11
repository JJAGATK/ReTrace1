import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AdminQueueScreen({ onSelectItem, onHandoverApproved }) {
  const { user, token } = useAuth();
  const [claims, setClaims] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [flags, setFlags] = useState([]);
  const [isChainValid, setIsChainValid] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('queue'); // 'queue', 'flags', 'audit', 'analytics'
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Claims
      const claimsRes = await fetch('/api/admin/claims', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (claimsRes.ok) {
        const cData = await claimsRes.json();
        setClaims(cData.claims || []);
      }

      // Analytics
      const analyticsRes = await fetch('/api/admin/analytics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (analyticsRes.ok) {
        const aData = await analyticsRes.json();
        setAnalytics(aData);
      }

      // Flags
      const flagsRes = await fetch('/api/admin/flags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (flagsRes.ok) {
        const fData = await flagsRes.json();
        setFlags(fData.flags || []);
      }

      // Audit Chain for Cabot AirPods / ReTrace
      const auditRes = await fetch('/api/items/REC-8842/custody-chain');
      if (auditRes.ok) {
        const logData = await auditRes.json();
        setAuditLogs(logData.logs || logData.custodyLogs || []);
        setIsChainValid(logData.isChainValid !== false);
      }
    } catch (e) {
      console.error('Failed to load admin data', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  const handleDecision = async (claimId, action) => {
    setActionLoading(claimId);
    try {
      const res = await fetch(`/api/admin/claims/${claimId}/decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          action,
          handover_location: 'Cabot Science Library Circulation Desk',
          handover_time: 'Today until 11:00 PM (Duty Librarian #L-89)',
          notes: action === 'approve' ? 'Verification questions and proof approved by desk officer.' : 'Insufficient proof.'
        })
      });

      if (res.ok) {
        setFeedback(`✓ Claim successfully ${action}d!`);
        setTimeout(() => setFeedback(null), 3000);
        fetchData();
        if (action === 'approve' && onHandoverApproved) {
          onHandoverApproved();
        }
      }
    } catch (e) {
      console.error('Decision error', e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResolveFlag = async (flagId, resolution) => {
    try {
      const res = await fetch(`/api/admin/flags/${flagId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: resolution,
          notes: `Resolved by ${user?.name || 'Moderator'}`
        })
      });
      if (res.ok) {
        setFeedback(`✓ Report marked as ${resolution}`);
        setTimeout(() => setFeedback(null), 3000);
        fetchData();
      }
    } catch (e) {
      console.error('Flag resolution error', e);
    }
  };

  const handleExportAudit = async () => {
    try {
      const res = await fetch('/api/admin/audit-export', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `retrace-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
      }
    } catch (e) {
      console.error('Audit export error', e);
    }
  };

  const pendingFlags = flags.filter(f => f.status === 'pending');

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      
      {/* Admin Title & Role Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs">
              Desk Monitor Console
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
              ReTrace Campus Security & Verification Center
            </h1>
          </div>
          <p className="text-xs text-[#464554] mt-0.5">
            Review ownership verification challenges, resolve community reports, and audit immutable chain-of-custody logs.
          </p>
        </div>

        {/* Action / Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAudit}
            className="px-3.5 py-1.5 rounded-full bg-white hover:bg-indigo-50 border border-indigo-200/80 text-xs font-semibold text-[#4648d4] shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Export Audit Log</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>{feedback}</span>
        </div>
      )}

      {/* Metrics Row */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="glass-card rounded-2xl p-4 border border-indigo-100">
            <span className="text-[11px] font-semibold text-slate-400">Active Campus Items</span>
            <div className="text-2xl font-black text-[#1a1b25] mt-1">{analytics.activeItems ?? (analytics.totalItems - (analytics.returnedItems || 0))}</div>
            <div className="text-[10px] text-emerald-600 font-semibold mt-0.5">{analytics.totalItems} total registered</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-indigo-100">
            <span className="text-[11px] font-semibold text-slate-400">Recovery Rate</span>
            <div className="text-2xl font-black text-[#4648d4] mt-1">{analytics.recoveryRate}%</div>
            <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{analytics.returnedItems} items returned safely</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-indigo-100">
            <span className="text-[11px] font-semibold text-slate-400">Pending Review</span>
            <div className="text-2xl font-black text-[#6b38d4] mt-1">{claims.filter(c => c.status === 'admin_review' || c.status === 'submitted').length}</div>
            <div className="text-[10px] text-purple-600 font-semibold mt-0.5">Ownership challenges</div>
          </div>

          <div className="glass-card rounded-2xl p-4 border border-indigo-100">
            <span className="text-[11px] font-semibold text-slate-400">Flagged Reports</span>
            <div className="text-2xl font-black text-[#F43F5E] mt-1">{pendingFlags.length}</div>
            <div className="text-[10px] text-rose-500 font-semibold mt-0.5">Awaiting moderation</div>
          </div>
        </div>
      )}

      {/* Sub-Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-indigo-100 mb-6 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('queue')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'queue' ? 'btn-gradient-indigo text-white shadow-xs' : 'text-[#464554] hover:bg-indigo-50'
          }`}
        >
          <span>Claims Review Queue</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
            activeSubTab === 'queue' ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {claims.filter(c => c.status === 'admin_review' || c.status === 'submitted').length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('flags')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'flags' ? 'btn-gradient-indigo text-white shadow-xs' : 'text-[#464554] hover:bg-indigo-50'
          }`}
        >
          <span>Flagged Listings</span>
          {pendingFlags.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {pendingFlags.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('audit')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeSubTab === 'audit' ? 'btn-gradient-indigo text-white shadow-xs' : 'text-[#464554] hover:bg-indigo-50'
          }`}
        >
          <span>Chain-of-Custody Audit Log</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeSubTab === 'analytics' ? 'btn-gradient-indigo text-white shadow-xs' : 'text-[#464554] hover:bg-indigo-50'
          }`}
        >
          Campus Loss Hotspots
        </button>
      </div>

      {/* TAB 1: CLAIMS REVIEW QUEUE */}
      {activeSubTab === 'queue' && (
        <div className="flex flex-col gap-4">
          {claims.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">task_alt</span>
              <h3 className="text-sm font-bold text-[#1a1b25]">Review Queue Cleared</h3>
              <p className="text-xs text-slate-500 mt-1">No pending claimant verifications awaiting moderator sign-off.</p>
            </div>
          ) : (
            claims.map((claim) => {
              const isPending = claim.status === 'admin_review' || claim.status === 'submitted';
              const isApproved = claim.status === 'approved';

              return (
                <div
                  key={claim.id}
                  className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-lg flex flex-col gap-4"
                >
                  {/* Claim Card Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-bold text-[#4648d4]">
                        {claim.claimant_name ? claim.claimant_name.charAt(0) : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-[#1a1b25]">{claim.claimant_name}</h4>
                          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.2 rounded-full border border-emerald-200">
                            Verified .edu (Trust {claim.claimant_trust || 98}%)
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          {claim.claimant_email} • Claim ID #{claim.id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <span className="text-xs font-bold text-[#4648d4] block">
                          Match Score: {claim.match_score}%
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {claim.match_score >= 80 ? 'High Confidence' : 'Manual Review'}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        isApproved
                          ? 'bg-emerald-100 text-emerald-800'
                          : claim.status === 'rejected'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-purple-100 text-purple-800 animate-pulse'
                      }`}>
                        {claim.status?.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Target Item Brief */}
                  <div className="p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Item</span>
                      <span className="text-xs font-bold text-[#1a1b25]">{claim.item_title} (#{claim.item_id})</span>
                    </div>
                    <span className="text-xs text-[#4648d4] font-semibold">{claim.coarse_location}</span>
                  </div>

                  {/* Side-by-Side Comparison (Feature 2 Verification) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Intake Secrets (Finder) */}
                    <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-200/70 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[#6b38d4] font-bold text-xs uppercase tracking-wide">
                        <span className="material-symbols-outlined text-sm">lock</span>
                        <span>Finder's Intake Secrets (Protected)</span>
                      </div>

                      {claim.intake_questions && claim.intake_questions.map((q, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="text-slate-500 font-medium block">Q{idx + 1}: {q}</span>
                          <span className="font-bold text-purple-900 bg-purple-100/70 px-1.5 py-0.5 rounded">
                            Expected: {claim.expected_answers?.[idx] || 'Confidential Answer'}
                          </span>
                        </div>
                      ))}

                      {claim.expected_serial && (
                        <div className="text-xs pt-1 border-t border-purple-200/60">
                          <span className="text-slate-500 font-medium block">Intake Serial Number:</span>
                          <span className="font-mono font-bold text-purple-900">{claim.expected_serial}</span>
                        </div>
                      )}
                    </div>

                    {/* Claimant Answers */}
                    <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-200/70 flex flex-col gap-2">
                      <div className="flex items-center gap-1.5 text-[#4648d4] font-bold text-xs uppercase tracking-wide">
                        <span className="material-symbols-outlined text-sm">fingerprint</span>
                        <span>Claimant Submitted Answers</span>
                      </div>

                      {claim.submitted_answers && claim.submitted_answers.map((ans, idx) => (
                        <div key={idx} className="text-xs">
                          <span className="text-slate-500 font-medium block">Answer {idx + 1}:</span>
                          <span className="font-bold text-[#1a1b25] bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                            "{ans || 'No answer provided'}"
                          </span>
                        </div>
                      ))}

                      {claim.serial_provided && (
                        <div className="text-xs pt-1 border-t border-indigo-200/60">
                          <span className="text-slate-500 font-medium block">Claimant Serial Provided:</span>
                          <span className="font-mono font-bold text-[#1a1b25] bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                            {claim.serial_provided}
                          </span>
                        </div>
                      )}

                      {claim.proof_notes && (
                        <div className="text-xs pt-1">
                          <span className="text-slate-500 font-medium block">Proof Notes:</span>
                          <span className="text-slate-700 italic">"{claim.proof_notes}"</span>
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Decision Action Bar */}
                  {isPending && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                      <button
                        onClick={() => handleDecision(claim.id, 'reject')}
                        disabled={actionLoading === claim.id}
                        className="px-4 py-2 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all cursor-pointer"
                      >
                        Reject Claim
                      </button>

                      <button
                        onClick={() => handleDecision(claim.id, 'approve')}
                        disabled={actionLoading === claim.id}
                        className="px-5 py-2 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-sm">verified_user</span>
                        <span>Approve & Schedule Handover</span>
                      </button>
                    </div>
                  )}

                  {isApproved && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Approved for safe pickup at Cabot Circulation Desk. QR token issued.</span>
                      </div>
                      <span className="font-mono text-[11px] text-emerald-700">Reviewed by {claim.reviewed_by}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2: FLAGGED LISTINGS MODERATION QUEUE */}
      {activeSubTab === 'flags' && (
        <div className="flex flex-col gap-4">
          {flags.length === 0 ? (
            <div className="glass-card rounded-3xl p-12 text-center">
              <span className="material-symbols-outlined text-4xl text-emerald-500 mb-2">shield</span>
              <h3 className="text-sm font-bold text-[#1a1b25]">No Flagged Content</h3>
              <p className="text-xs text-slate-500 mt-1">Campus community listings are clean and in compliance.</p>
            </div>
          ) : (
            flags.map((flag) => (
              <div key={flag.id} className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-lg flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-full bg-rose-100 text-rose-600">
                      <span className="material-symbols-outlined text-base">flag</span>
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-[#1a1b25]">
                        Item #{flag.item_id}: {flag.item_title}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        Reported by {flag.reporter_name || 'Anonymous Student'} • Reason: <strong className="text-rose-600 capitalize">{flag.reason}</strong>
                      </p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    flag.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {flag.status?.toUpperCase()}
                  </span>
                </div>

                {flag.details && (
                  <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-700 italic border border-slate-200">
                    "{flag.details}"
                  </div>
                )}

                {flag.status === 'pending' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100">
                    <button
                      onClick={() => handleResolveFlag(flag.id, 'dismissed')}
                      className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#1a1b25] text-xs font-semibold cursor-pointer"
                    >
                      Dismiss Report
                    </button>
                    <button
                      onClick={() => handleResolveFlag(flag.id, 'resolved')}
                      className="px-4 py-1.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                    >
                      Take Action & Mark Resolved
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 3: IMMUTABLE CHAIN-OF-CUSTODY AUDIT LOG */}
      {activeSubTab === 'audit' && (
        <div className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-lg flex flex-col gap-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-[#1a1b25]">
                Cryptographic Chain-of-Custody (SHA-256)
              </h3>
              <p className="text-xs text-[#464554]">
                Append-only immutable event logs for audited items. Every block seals the hash of the preceding event.
              </p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
              isChainValid ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800'
            }`}>
              <span className="material-symbols-outlined text-sm">verified</span>
              <span>{isChainValid ? 'Hash Chain Integrity Verified' : 'Hash Chain Tamper Detected'}</span>
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {auditLogs.map((log, idx) => (
              <div
                key={log.id || idx}
                className="p-3.5 rounded-2xl bg-indigo-50/30 hover:bg-indigo-50/70 border border-indigo-100 flex flex-col gap-1.5 transition-colors font-mono"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-[#4648d4] text-white text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-[#1a1b25] capitalize">{log.action_type || log.action}</span>
                    <span className="text-slate-400 font-sans font-normal">• Actor: {log.actor_name}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-sans">
                    {new Date(log.created_at || log.timestamp).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs font-sans text-slate-700">
                  {log.notes}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] pt-1 text-slate-400">
                  <div className="truncate">
                    <span className="font-semibold text-slate-500">Prev: </span>
                    <span>{log.previous_hash || '0x00000000000000000000000000000000'}</span>
                  </div>
                  <div className="truncate">
                    <span className="font-semibold text-purple-600">Hash: </span>
                    <span className="text-purple-700 font-bold">{log.block_hash || log.hash}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      )}

      {/* TAB 4: CAMPUS LOSS HOTSPOTS */}
      {activeSubTab === 'analytics' && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          <div className="glass-card rounded-3xl p-5 border border-indigo-200/80 shadow-lg flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[#1a1b25] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4648d4]">map</span>
              <span>Top Campus Loss Hotspot Quadrants</span>
            </h3>
            <div className="flex flex-col gap-2 pt-2">
              {analytics.hotspotZones?.map((zone, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-bold text-[#1a1b25]">{zone.zone}</span>
                  </div>
                  <span className="text-xs font-bold text-[#4648d4]">{zone.count} items recorded</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-5 border border-indigo-200/80 shadow-lg flex flex-col gap-3">
            <h3 className="text-sm font-bold text-[#1a1b25] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#6b38d4]">category</span>
              <span>Most Common Lost Categories</span>
            </h3>
            <div className="flex flex-col gap-2 pt-2">
              {analytics.categories?.map((cat, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
                  <span className="text-xs font-bold text-[#1a1b25]">{cat.category}</span>
                  <span className="text-xs font-bold text-[#6b38d4]">{cat.count} reports</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
