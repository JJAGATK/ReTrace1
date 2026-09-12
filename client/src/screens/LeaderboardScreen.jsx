import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function LeaderboardScreen({ onNavigateTab, onBack }) {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterAffiliation, setFilterAffiliation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Global Escape key navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (onBack) onBack();
        else if (onNavigateTab) onNavigateTab('feed');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBack, onNavigateTab]);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const res = await fetch('/api/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setLeaderboard(data.leaderboard || []);
          setStats(data.stats || null);
        }
      } catch (err) {
        console.error('Failed to load leaderboard:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, []);

  // Filtered users
  const filteredUsers = leaderboard.filter(u => {
    if (filterAffiliation !== 'all') {
      if (filterAffiliation === 'student' && u.role !== 'student') return false;
      if (filterAffiliation === 'admin' && u.role !== 'admin') return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        (u.campus_affiliation && u.campus_affiliation.toLowerCase().includes(q)) ||
        u.tierTitle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const currentUserStanding = leaderboard.find(u => u.id === user?.id) || {
    rank: 2,
    name: user?.name || 'You',
    returns_count: user?.returns_count || 0,
    bounties_earned: user?.bounties_earned || 0,
    trust_score: user?.trust_score || 98,
    tierTitle: 'Campus Guardian 🛡️',
    tierColor: 'emerald'
  };

  const top3 = leaderboard.slice(0, 3);

  // Next tier calculation for current user
  const returnsCount = currentUserStanding.returns_count || 0;
  let nextTierName = 'Master Finder 🥇';
  let returnsNeeded = 15 - returnsCount;
  let progressPercent = Math.min(100, Math.round((returnsCount / 15) * 100));

  if (returnsCount >= 15) {
    nextTierName = 'Campus Legend 🏆';
    returnsNeeded = Math.max(0, 50 - returnsCount);
    progressPercent = Math.min(100, Math.round((returnsCount / 50) * 100));
  } else if (returnsCount >= 10) {
    nextTierName = 'Master Finder 🥇';
    returnsNeeded = 15 - returnsCount;
    progressPercent = Math.min(100, Math.round(((returnsCount - 10) / 5) * 100));
  } else if (returnsCount >= 5) {
    nextTierName = 'Campus Guardian 🛡️';
    returnsNeeded = 10 - returnsCount;
    progressPercent = Math.min(100, Math.round(((returnsCount - 5) / 5) * 100));
  } else {
    nextTierName = 'Senior Scout ⭐';
    returnsNeeded = 5 - returnsCount;
    progressPercent = Math.min(100, Math.round((returnsCount / 5) * 100));
  }

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24 text-slate-900">
      
      {/* Top Navigation Bar with Go Back */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-3 border-b border-slate-200/80">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (onNavigateTab) onNavigateTab('feed');
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>← Back to Live Feed</span>
        </button>

        <span className="text-xs text-slate-400 font-medium">Campus Recognition Network</span>
      </div>

      {/* Header & Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-xs font-bold flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">emoji_events</span>
              <span>Honor Roll</span>
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Campus Returners Leaderboard
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Recognizing trusted students & staff who reunite lost valuables with their rightful owners across Harvard.
          </p>
        </div>

        {/* Global Impact Summary Badges */}
        {stats && (
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-600 text-base">verified</span>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Reunited Items</div>
                <div className="text-xs font-bold text-slate-900">{stats.totalReturns} Returned</div>
              </div>
            </div>

            <div className="px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 shadow-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-base">payments</span>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">Bounties Claimed</div>
                <div className="text-xs font-bold text-emerald-700">${stats.totalBountiesDistributed} Paid</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CURRENT USER STANDING BANNER */}
      {user && (
        <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              <img
                src={user.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                alt={user.name}
                className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-400"
              />
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black shadow-xs">
                #{currentUserStanding.rank}
              </span>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">{user.name}</h3>
                <span className="px-2 py-0.5 rounded-md bg-white/10 text-white text-[10px] font-semibold border border-white/20">
                  {currentUserStanding.tierTitle}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 flex items-center gap-2">
                <span><strong>{currentUserStanding.returns_count}</strong> Items Safely Returned</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">${currentUserStanding.bounties_earned} Bounties Earned</span>
                <span>•</span>
                <span className="text-indigo-300 font-medium">{user.trust_score || 100}% Trust</span>
              </p>
            </div>
          </div>

          {/* Progress to Next Tier */}
          <div className="flex flex-col md:items-end gap-1 min-w-[200px]">
            <div className="text-[11px] text-slate-300">
              {returnsNeeded > 0 ? (
                <><strong>{returnsNeeded} more return{returnsNeeded > 1 ? 's' : ''}</strong> to reach <span className="text-amber-400 font-bold">{nextTierName}</span></>
              ) : (
                <span className="text-amber-400 font-bold">Top Tier Achieved! 🏆</span>
              )}
            </div>
            <div className="w-full md:w-48 h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* TOP 3 PODIUM */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          
          {/* 2nd Place (Silver) */}
          <div className="order-2 md:order-1 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
              #2 SILVER 🥈
            </div>
            
            <div className="relative mt-2 mb-3">
              <img
                src={top3[1].avatar_url}
                alt={top3[1].name}
                className="w-16 h-16 rounded-full object-cover ring-4 ring-slate-200 shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center border-2 border-white">
                2
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-900">{top3[1].name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-full">{top3[1].campus_affiliation}</p>
            <span className="mt-2 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100">
              {top3[1].tierTitle}
            </span>

            <div className="grid grid-cols-2 gap-2 w-full mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Returns</span>
                <span className="font-bold text-slate-800">{top3[1].returns_count}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Bounties</span>
                <span className="font-bold text-emerald-700">${top3[1].bounties_earned}</span>
              </div>
            </div>
          </div>

          {/* 1st Place (Gold / Champion) */}
          <div className="order-1 md:order-2 bg-gradient-to-b from-amber-50/50 via-white to-white rounded-2xl p-6 border-2 border-amber-300 shadow-sm flex flex-col items-center text-center relative overflow-hidden md:-translate-y-2">
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
              <span className="px-3 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold shadow-xs">
                #1 CHAMPION 👑
              </span>
            </div>
            
            <div className="relative mt-4 mb-3">
              <img
                src={top3[0].avatar_url}
                alt={top3[0].name}
                className="w-20 h-20 rounded-full object-cover ring-4 ring-amber-400 shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-sm flex items-center justify-center border-2 border-white shadow-xs">
                1
              </span>
            </div>

            <h3 className="font-bold text-base text-slate-900">{top3[0].name}</h3>
            <p className="text-xs text-slate-500 mt-0.5 truncate max-w-full">{top3[0].campus_affiliation}</p>
            <span className="mt-2 px-3 py-0.5 rounded-md bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200">
              {top3[0].tierTitle}
            </span>

            <div className="grid grid-cols-2 gap-2 w-full mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Total Returns</span>
                <span className="font-bold text-base text-slate-900">{top3[0].returns_count}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Total Bounties</span>
                <span className="font-bold text-base text-emerald-700">${top3[0].bounties_earned}</span>
              </div>
            </div>
          </div>

          {/* 3rd Place (Bronze) */}
          <div className="order-3 bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-900 text-[10px] font-bold border border-amber-200/70">
              #3 BRONZE 🥉
            </div>
            
            <div className="relative mt-2 mb-3">
              <img
                src={top3[2].avatar_url}
                alt={top3[2].name}
                className="w-16 h-16 rounded-full object-cover ring-4 ring-amber-600/30 shadow-xs"
              />
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-700 text-white font-bold text-xs flex items-center justify-center border-2 border-white">
                3
              </span>
            </div>

            <h3 className="font-bold text-sm text-slate-900">{top3[2].name}</h3>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-full">{top3[2].campus_affiliation}</p>
            <span className="mt-2 px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-semibold border border-indigo-100">
              {top3[2].tierTitle}
            </span>

            <div className="grid grid-cols-2 gap-2 w-full mt-4 pt-3 border-t border-slate-100 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">Returns</span>
                <span className="font-bold text-slate-800">{top3[2].returns_count}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Bounties</span>
                <span className="font-bold text-emerald-700">${top3[2].bounties_earned}</span>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* FILTER & SEARCH BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-100 text-xs font-medium">
          <button
            onClick={() => setFilterAffiliation('all')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterAffiliation === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All Returners ({leaderboard.length})
          </button>
          <button
            onClick={() => setFilterAffiliation('student')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterAffiliation === 'student' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Students
          </button>
          <button
            onClick={() => setFilterAffiliation('admin')}
            className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
              filterAffiliation === 'admin' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Desk Officers
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
            search
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search returner name or hall..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* FULL LEADERBOARD TABLE */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4 w-16 text-center">Rank</th>
                <th className="py-3 px-4">Student / Officer</th>
                <th className="py-3 px-4">Tier & Badges</th>
                <th className="py-3 px-4 text-center">Returns</th>
                <th className="py-3 px-4 text-center">Bounties Claimed</th>
                <th className="py-3 px-4 text-center">Trust Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                    <span className="material-symbols-outlined text-2xl animate-spin mb-1 text-indigo-600 block">sync</span>
                    <span>Loading campus standings...</span>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400 text-xs">
                    No returners match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isMe = user?.id === u.id;
                  const isTop3 = u.rank <= 3;

                  return (
                    <tr
                      key={u.id}
                      className={`transition-colors ${
                        isMe
                          ? 'bg-indigo-50/70 font-medium'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Rank Number */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                          u.rank === 1
                            ? 'bg-amber-400 text-slate-950 shadow-xs'
                            : u.rank === 2
                            ? 'bg-slate-200 text-slate-800'
                            : u.rank === 3
                            ? 'bg-amber-700/20 text-amber-900'
                            : 'text-slate-500'
                        }`}>
                          {u.rank}
                        </span>
                      </td>

                      {/* User Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                            alt={u.name}
                            className={`w-9 h-9 rounded-full object-cover ring-1 ${
                              isTop3 ? 'ring-amber-300' : 'ring-slate-200'
                            }`}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 truncate">
                                {u.name}
                              </span>
                              {isMe && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-600 text-white text-[9px] font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-500 block truncate">
                              {u.campus_affiliation}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Tier Title */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium whitespace-nowrap">
                          {u.tierTitle}
                        </span>
                      </td>

                      {/* Returns Count */}
                      <td className="py-3.5 px-4 text-center font-bold text-slate-900 text-xs">
                        {u.returns_count}
                      </td>

                      {/* Bounties Claimed */}
                      <td className="py-3.5 px-4 text-center font-semibold text-emerald-700 text-xs">
                        {u.bounties_earned > 0 ? `$${u.bounties_earned}` : '—'}
                      </td>

                      {/* Trust Score */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          <span className="material-symbols-outlined text-xs">shield</span>
                          <span>{u.trust_score || 100}%</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MILESTONE TIERS EXPLAINER */}
      <div className="mt-8 bg-slate-50 rounded-2xl p-5 border border-slate-200/80">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base text-indigo-600">military_tech</span>
          <span>Campus Returner Honor Tiers</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-0.5">
            <span className="font-bold text-slate-800">New Scout 🌱</span>
            <span className="text-[11px] text-slate-500">0 returns</span>
            <span className="text-[10px] text-slate-400 mt-1">First step on ReTrace</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-0.5">
            <span className="font-bold text-slate-800">Senior Scout ⭐</span>
            <span className="text-[11px] text-slate-500">5+ returns</span>
            <span className="text-[10px] text-slate-400 mt-1">Trusted quad contributor</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-0.5">
            <span className="font-bold text-emerald-700">Guardian 🛡️</span>
            <span className="text-[11px] text-slate-500">10+ returns</span>
            <span className="text-[10px] text-slate-400 mt-1">Safe vault escort privilege</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-0.5">
            <span className="font-bold text-indigo-700">Master Finder 🥇</span>
            <span className="text-[11px] text-slate-500">15+ returns</span>
            <span className="text-[10px] text-slate-400 mt-1">Priority dispatch alerts</span>
          </div>

          <div className="bg-white p-3 rounded-xl border border-amber-300 shadow-xs flex flex-col gap-0.5 bg-gradient-to-b from-amber-50/50 to-white">
            <span className="font-bold text-amber-800">Campus Legend 🏆</span>
            <span className="text-[11px] text-slate-500">50+ returns</span>
            <span className="text-[10px] text-slate-400 mt-1">Permanent Harvard honor</span>
          </div>
        </div>
      </div>

    </div>
  );
}