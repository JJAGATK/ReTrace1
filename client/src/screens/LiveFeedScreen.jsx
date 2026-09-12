import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const BASE_CATEGORIES = [
  { id: 'All Items', label: 'All Items', icon: 'dataset' },
  { id: 'Tech & Audio', label: 'Tech', icon: 'devices' },
  { id: 'Bags & Wallets', label: 'Bags', icon: 'backpack' },
  { id: 'Campus IDs', label: 'IDs & Cards', icon: 'badge' },
  { id: 'Keys & Dorm', label: 'Keys', icon: 'key' },
  { id: 'Bottles & Mugs', label: 'Bottles', icon: 'water_bottle' },
  { id: 'Apparel', label: 'Apparel', icon: 'apparel' },
  { id: 'Books & Notes', label: 'Books', icon: 'menu_book' },
  { id: 'Eyewear', label: 'Eyewear', icon: 'visibility' },
  { id: 'Other', label: 'Other', icon: 'category' },
];

export default function LiveFeedScreen({ onSelectItem, onOpenPostModal, onOpenClaimModal, searchQuery, onNavigateTab }) {
  const { user, token } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all'); // 'all', 'lost', 'found', 'returned', 'saved'
  const [toastMessage, setToastMessage] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [stats, setStats] = useState({ total: 0, found: 0, lost: 0, returned: 0, categoryCounts: {} });

  // Sighting Modal State
  const [sightingTargetItem, setSightingTargetItem] = useState(null);
  const [sightingLocation, setSightingLocation] = useState('');
  const [sightingNotes, setSightingNotes] = useState('');
  const [submittingSighting, setSubmittingSighting] = useState(false);

  // Custody Log Modal State
  const [activeCustodyLogs, setActiveCustodyLogs] = useState(null);
  const [custodyModalItemTitle, setCustodyModalItemTitle] = useState('');

  // Perks Modal State
  const [showPerksModal, setShowPerksModal] = useState(false);

  // Delete Confirmation Modal State
  const [deleteConfirmItem, setDeleteConfirmItem] = useState(null);
  const [deletingPost, setDeletingPost] = useState(false);

  const handleDeleteItem = async (itemId) => {
    if (!token) return;
    setDeletingPost(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        showToast(data.message || 'Post removed successfully');
        setItems(prev => prev.filter(it => it.id !== itemId));
        fetchStats();
        setDeleteConfirmItem(null);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete post');
      }
    } catch (e) {
      showToast('Network error deleting post');
    } finally {
      setDeletingPost(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {}
  };

  const fetchBookmarks = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/bookmarks', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(new Set(data.bookmarks));
      }
    } catch (e) {}
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTypeFilter !== 'all' && selectedTypeFilter !== 'saved') {
        if (selectedTypeFilter === 'returned') {
          params.append('status', 'returned');
        } else if (selectedTypeFilter === 'bounty') {
          params.append('bounty_only', 'true');
        } else {
          params.append('type', selectedTypeFilter);
        }
      }
      if (selectedCategory !== 'All Items') {
        params.append('category', selectedCategory);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/items?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let fetched = data.items;
        if (selectedTypeFilter === 'saved') {
          fetched = fetched.filter(it => bookmarkedIds.has(it.id));
        }
        setItems(fetched);
      }
    } catch (e) {
      console.error('Error fetching items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchBookmarks();
  }, [token]);

  useEffect(() => {
    fetchItems();
    fetchStats();
  }, [selectedCategory, selectedTypeFilter, searchQuery, bookmarkedIds]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleToggleBookmark = async (e, itemId) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/bookmarks/${itemId}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(prev => {
          const next = new Set(prev);
          if (data.bookmarked) next.add(itemId);
          else next.delete(itemId);
          return next;
        });
        showToast(data.message);
      }
    } catch (err) {
      showToast('Error updating saved listings');
    }
  };

  const handleSubmitSighting = async (e) => {
    e.preventDefault();
    if (!sightingLocation.trim()) {
      showToast('Please specify where you spotted the item.');
      return;
    }

    setSubmittingSighting(true);
    try {
      const res = await fetch(`/api/items/${sightingTargetItem.id}/sightings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location_clue: sightingLocation.trim(),
          notes: sightingNotes.trim()
        })
      });

      if (res.ok) {
        const data = await res.json();
        showToast(data.message);
        setSightingTargetItem(null);
        setSightingLocation('');
        setSightingNotes('');
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to submit sighting');
      }
    } catch (err) {
      showToast('Network error submitting sighting');
    } finally {
      setSubmittingSighting(false);
    }
  };

  const handleOpenCustodyLog = async (itemId, title) => {
    setCustodyModalItemTitle(title);
    try {
      const res = await fetch(`/api/items/${itemId}/custody-chain`);
      if (res.ok) {
        const data = await res.json();
        setActiveCustodyLogs(data.logs);
      }
    } catch (e) {
      showToast('Failed to load custody chain logs.');
    }
  };

  const getCategoryBadgeCount = (catId) => {
    let countMap = stats.totalCategoryCounts || stats.categoryCounts || {};
    let totalCount = stats.total ?? items.length;

    if (selectedTypeFilter === 'lost') {
      countMap = stats.lostCategoryCounts || {};
      totalCount = stats.lost ?? items.filter(it => it.type === 'lost' && it.status !== 'returned').length;
    } else if (selectedTypeFilter === 'found') {
      countMap = stats.foundCategoryCounts || {};
      totalCount = stats.found ?? items.filter(it => it.type === 'found' && it.status !== 'returned').length;
    } else if (selectedTypeFilter === 'returned') {
      countMap = stats.returnedCategoryCounts || {};
      totalCount = stats.returned ?? items.filter(it => it.status === 'returned').length;
    } else if (selectedTypeFilter === 'bounty') {
      const bountyItems = items.filter(it => it.reward_offered && String(it.reward_offered).trim() !== '');
      if (catId === 'All Items') return stats.bounties ?? bountyItems.length;
      return bountyItems.filter(it => it.category === catId).length;
    } else if (selectedTypeFilter === 'saved') {
      if (catId === 'All Items') return bookmarkedIds.size;
      const standardList = ['Tech & Audio', 'Bags & Wallets', 'Campus IDs', 'Keys & Dorm', 'Bottles & Mugs', 'Books & Notes', 'Eyewear'];
      if (catId === 'Apparel') {
        return items.filter(it => bookmarkedIds.has(it.id) && (it.category === 'Apparel' || it.category === 'Jackets & Gear')).length;
      }
      if (catId === 'Other') {
        return items.filter(it => bookmarkedIds.has(it.id) && !standardList.includes(it.category) && it.category !== 'Apparel' && it.category !== 'Jackets & Gear').length;
      }
      return items.filter(it => bookmarkedIds.has(it.id) && it.category === catId).length;
    }

    if (catId === 'All Items') {
      return totalCount;
    }

    let val = countMap[catId] || 0;
    if (catId === 'Apparel' && countMap['Jackets & Gear']) {
      val += countMap['Jackets & Gear'];
    }
    return val;
  };

  return (
    <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 pb-24 md:pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white shadow-xl text-xs font-medium animate-in fade-in slide-in-from-bottom-4">
          <span className="material-symbols-outlined text-emerald-400 text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-6">
        
        {/* Minimal Category Rail (Original Icon-Only Design with Tooltips & Badges) */}
        <section className="w-full relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categories</h2>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {selectedCategory !== 'All Items' ? `${selectedCategory} • ` : ''}
                {selectedTypeFilter === 'lost'
                  ? `${stats.lost ?? 0} lost`
                  : selectedTypeFilter === 'found'
                  ? `${stats.found ?? 0} found`
                  : selectedTypeFilter === 'returned'
                  ? `${stats.returned ?? 0} reunited`
                  : selectedTypeFilter === 'bounty'
                  ? `${stats.bounties ?? 0} bounties`
                  : selectedTypeFilter === 'saved'
                  ? `${bookmarkedIds.size} saved`
                  : `${stats.total ?? items.length ?? 0} items`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar scroll-smooth py-1.5 px-0.5">
            {BASE_CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              const count = getCategoryBadgeCount(cat.id);

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  title={cat.label}
                  className={`group relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shrink-0 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-105'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className={`material-symbols-outlined text-xl transition-transform ${
                    isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-900 group-hover:scale-110'
                  }`}>
                    {cat.icon}
                  </span>
                  
                  {count > 0 && (
                    <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold rounded-full border shadow-xs ${
                      isActive
                        ? 'bg-indigo-600 text-white border-white'
                        : 'bg-slate-100 text-slate-700 border-slate-200 group-hover:bg-slate-200'
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Minimal Filter Toolbar */}
        <div className="bg-white p-1.5 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto no-scrollbar border border-slate-200">
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                selectedTypeFilter === 'all'
                  ? 'bg-slate-100 text-slate-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              All Items
            </button>

            <button
              onClick={() => setSelectedTypeFilter('lost')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'lost'
                  ? 'bg-rose-50 text-rose-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>Lost Reports</span>
            </button>

            <button
              onClick={() => setSelectedTypeFilter('found')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'found'
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>Found Safeguarded</span>
            </button>

            <button
              onClick={() => setSelectedTypeFilter('bounty')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'bounty'
                  ? 'bg-amber-50 text-amber-700 font-semibold border border-amber-200/60'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs text-amber-600">monetization_on</span>
              <span>Bounties</span>
              {stats.bounties > 0 && (
                <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded-full">
                  {stats.bounties}
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedTypeFilter('returned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'returned'
                  ? 'bg-purple-50 text-purple-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
              <span>Reunited</span>
            </button>

            <button
              onClick={() => setSelectedTypeFilter('saved')}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'saved'
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined text-xs">bookmark</span>
              <span>Saved ({bookmarkedIds.size})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0 pr-2">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Main Grid: 8 cols Feed + 4 cols Desktop Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Feed Column */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            
            {loading ? (
              <div className="bg-white rounded-2xl p-12 text-center flex flex-col items-center justify-center border border-slate-200">
                <span className="material-symbols-outlined text-3xl text-indigo-600 animate-spin mb-2">sync</span>
                <p className="text-xs font-medium text-slate-500">Loading campus listings...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                <h3 className="text-sm font-semibold text-slate-900">No items match this filter</h3>
                <p className="text-xs text-slate-500 mt-1">Try selecting "All Items" or resetting your search.</p>
              </div>
            ) : (
              items.map((item) => {
                const isFound = item.type === 'found';
                const isReturned = item.status === 'returned';
                const isBookmarked = bookmarkedIds.has(item.id);

                return (
                  <article
                    key={item.id}
                    className="bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-slate-300 transition-all shadow-2xs"
                  >
                    {/* Card Header */}
                    <div className="p-4 flex items-center justify-between border-b border-slate-100">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.reporter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                          alt={item.reporter_name}
                          className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 leading-tight">
                              {item.reporter_name}
                            </h3>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                              .edu
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                            <span className="material-symbols-outlined text-slate-400 text-xs">location_on</span>
                            <span>{item.coarse_location} • {item.floor_room || 'Campus Area'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isReturned ? (
                          <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 text-[11px] font-semibold">
                            Reunited
                          </span>
                        ) : isFound ? (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold">
                            Found
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-[11px] font-semibold">
                            Lost
                          </span>
                        )}
                        <span className="text-[11px] text-slate-400">
                          {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </span>
                      </div>
                    </div>

                    {/* Card Media Stage */}
                    {item.photos && item.photos.length > 0 && (
                      <div 
                        onClick={() => onSelectItem(item)}
                        className="relative aspect-[16/9] w-full bg-slate-50 overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        />

                        {/* Minimal Badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          {item.custody_type === 'official_desk' && (
                            <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-medium">
                              Desk Safekeeping
                            </span>
                          )}
                          {item.reward_offered && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-semibold shadow-xs">
                              {item.reward_offered}
                            </span>
                          )}
                        </div>

                        {item.photos.length > 1 && (
                          <div className="absolute bottom-3 right-3">
                            <span className="px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">photo_camera</span> {item.photos.length}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Body & Details */}
                    <div className="p-4 flex flex-col gap-3">
                      <div>
                        <h4 
                          onClick={() => onSelectItem(item)}
                          className="text-sm sm:text-base font-bold text-slate-900 tracking-tight hover:text-indigo-600 cursor-pointer transition-colors"
                        >
                          {item.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      {/* Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          #{item.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium">
                          #{item.coarse_location.replace(/\s+/g, '')}
                        </span>

                        {isFound && item.has_challenge && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-medium flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">lock</span> Verification Challenge
                          </span>
                        )}
                      </div>

                      {/* Action Bar */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => handleToggleBookmark(e, item.id)}
                            aria-label="Bookmark"
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              isBookmarked
                                ? 'text-indigo-600 bg-indigo-50'
                                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="material-symbols-outlined text-lg">
                              {isBookmarked ? 'bookmark' : 'bookmark_border'}
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              try {
                                navigator.clipboard?.writeText(window.location.href);
                                showToast('Link copied to clipboard!');
                              } catch (e) {
                                showToast('Link ready to share');
                              }
                            }}
                            aria-label="Share"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-lg">share</span>
                          </button>

                          {/* Security Administrator or Owner Delete Button */}
                          {(user?.role === 'admin' || item.user_id === user?.id) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmItem(item);
                              }}
                              title={user?.role === 'admin' ? "Delete Post (Security Admin)" : "Delete My Post"}
                              aria-label="Delete Post"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-lg">delete</span>
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectItem(item)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Details</span>
                          </button>

                          {isFound && !isReturned && (
                            <button
                              onClick={() => onOpenClaimModal(item)}
                              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">verified_user</span>
                              <span>Claim</span>
                            </button>
                          )}

                          {!isFound && !isReturned && (
                            <button
                              onClick={() => setSightingTargetItem(item)}
                              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              <span>I've Seen This</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })
            )}

            {/* Reunited Showcase Card */}
            <article className="bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-4 border border-slate-200">
              <div className="relative w-full sm:w-24 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <img
                  alt="Sony Headphones"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8Wswf5Q5_OaleRZkuD_pIfe3AoMlXtOICoGZ4io8GRDJ3J8af98eLn6Cfq0fm1kbg0Tg2THj2KrTrd7tQpEY7yw8cn9kOpaiG4FAdukk83RztCIG8hV9M_inVAoKSdOcFQNNB-FXJ5kt3HvbuONs4E842g3d8CibCj0nPx4QPD_88lfAhpACtmq0KE5qLmHGyLRk38YAO9o2nnCBq8gIINRn-Fr9G2G2iyfnSwmkk4SIb-CqbjTzZNQ"
                />
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-semibold">
                    Reunited
                  </span>
                  <span className="text-[11px] text-slate-400">Yesterday at Cabot Desk</span>
                </div>
                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 mt-1">
                  Sony WH-1000XM5 Headphones Reunited
                </h4>
                <p className="text-xs text-slate-500 line-clamp-1">
                  Safely returned to verified owner via desk custody lockbox.
                </p>
              </div>
              <button 
                onClick={() => handleOpenCustodyLog('REC-8846', 'Sony WH-1000XM5 Headphones')}
                className="w-full sm:w-auto shrink-0 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors cursor-pointer"
              >
                View Log
              </button>
            </article>

          </div>

          {/* Minimal Sidebar */}
          <aside className="lg:col-span-4 flex flex-col gap-4 w-full">
            
            {/* Quick Report Banner */}
            <div className="rounded-2xl p-5 bg-slate-900 text-white shadow-sm border border-slate-800">
              <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider block mb-1">
                Found or Lost Something?
              </span>
              <h3 className="text-base font-bold tracking-tight">
                Report a Campus Item
              </h3>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                Post in seconds to alert students and campus security desks.
              </p>
              <button
                onClick={onOpenPostModal}
                className="mt-4 w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                <span>Post Lost or Found</span>
              </button>
            </div>

            {/* Campus Leaderboard Preview Widget */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-amber-500 text-lg">emoji_events</span>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Campus Leaderboard</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-bold">
                  Top Returners
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ranked by verified items returned to rightful owners.
              </p>

              <div className="flex flex-col gap-1.5 pt-1">
                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('leaderboard') : null}
                  className="p-2.5 rounded-xl bg-amber-50/50 hover:bg-amber-50 border border-amber-200/60 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 font-black text-[10px] flex items-center justify-center shrink-0">1</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Officer Marcus Vance</p>
                      <span className="text-[10px] text-amber-700 font-medium">Campus Guardian</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900">98</span>
                    <span className="text-[10px] text-slate-500 ml-1">returned</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('leaderboard') : null}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-300 text-slate-900 font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Maya Lin</p>
                      <span className="text-[10px] text-indigo-600 font-medium">Campus Champion</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900">18</span>
                    <span className="text-[10px] text-slate-500 ml-1">returned</span>
                  </div>
                </div>

                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('leaderboard') : null}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-amber-700 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Liam Zhao</p>
                      <span className="text-[10px] text-indigo-600 font-medium">Campus Champion</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900">15</span>
                    <span className="text-[10px] text-slate-500 ml-1">returned</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab ? onNavigateTab('leaderboard') : null}
                className="mt-1 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <span className="material-symbols-outlined text-sm">leaderboard</span>
                <span>View Full Leaderboard</span>
              </button>
            </div>

            {/* Safe Exchange Zones Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-slate-700 text-lg">shield</span>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-900">Safe Exchange Zones</h3>
                </div>
                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-medium">
                  Monitored
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Campus checkpoints with official staff recommended for safe item handovers.
              </p>

              <div className="flex flex-col gap-1.5 pt-1">
                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('map') : null}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Campus Police Annex</p>
                      <span className="text-[10px] text-slate-400">Main Gate • 24/7 Monitored</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Zone A</span>
                </div>

                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('map') : null}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Cabot Circulation Desk</p>
                      <span className="text-[10px] text-slate-400">Central Atrium • Until 11 PM</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Zone B</span>
                </div>

                <div 
                  onClick={() => onNavigateTab ? onNavigateTab('map') : null}
                  className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-100 flex items-center justify-between transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">Student Union Info Hub</p>
                      <span className="text-[10px] text-slate-400">Lounge 2 • 8 AM – 10 PM</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500">Zone C</span>
                </div>
              </div>
            </div>

            {/* Trust Score Card */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 border border-slate-200">
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-semibold text-slate-900">Your Trust Score</h4>
                  <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-700 text-[10px] font-semibold rounded">
                    {user?.trust_score || 98}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {user?.returns_count || 14} verified handovers completed.
                </p>
              </div>
              <button 
                onClick={() => setShowPerksModal(true)}
                className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-semibold text-slate-800 shrink-0 cursor-pointer"
              >
                Perks
              </button>
            </div>

          </aside>
        </div>

      </div>

      {/* Sighting Report Modal */}
      {sightingTargetItem && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1a1b25]">Report Item Sighting</h3>
                  <p className="text-[11px] text-slate-400">{sightingTargetItem.title}</p>
                </div>
              </div>
              <button onClick={() => setSightingTargetItem(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-[#464554]">
              Spotted this lost item on campus? Send a quick location clue to help the student owner find it.
            </p>

            <form onSubmit={handleSubmitSighting} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-bold text-[#1a1b25] mb-1">
                  Where did you spot it? *
                </label>
                <input
                  type="text"
                  required
                  value={sightingLocation}
                  onChange={(e) => setSightingLocation(e.target.value)}
                  placeholder="e.g. Cabot Library 2nd Floor Near Vending Machine"
                  className="w-full px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1a1b25] mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={sightingNotes}
                  onChange={(e) => setSightingNotes(e.target.value)}
                  placeholder="e.g. Handed it to front desk staff around 1:15 PM"
                  className="w-full px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4] resize-none"
                ></textarea>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSightingTargetItem(null)}
                  className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#1a1b25] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSighting}
                  className="flex-1 py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                >
                  {submittingSighting ? 'Dispatching...' : 'Submit Location Clue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custody Log Modal */}
      {activeCustodyLogs && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  SHA-256 Sealed Audit
                </span>
                <h3 className="font-bold text-base text-[#1a1b25] mt-1">{custodyModalItemTitle}</h3>
              </div>
              <button onClick={() => setActiveCustodyLogs(null)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {activeCustodyLogs.map((log, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100 text-xs font-mono flex flex-col gap-1">
                  <div className="flex items-center justify-between font-bold text-[#1a1b25]">
                    <span>#{idx + 1} {log.action}</span>
                    <span className="font-sans text-[10px] text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="font-sans text-[#464554] text-[11px]">{log.notes}</p>
                  <div className="text-[9px] text-purple-700 truncate pt-0.5 border-t border-indigo-100/60">
                    Hash: {log.hash}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setActiveCustodyLogs(null)}
              className="w-full py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#1a1b25] cursor-pointer mt-1"
            >
              Close Log
            </button>
          </div>
        </div>
      )}

      {/* Perks Modal */}
      {showPerksModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-indigo-200 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-[#4648d4] flex items-center justify-center font-bold">
                  ★
                </div>
                <h3 className="font-bold text-base text-[#1a1b25]">Campus Trust Level 3</h3>
              </div>
              <button onClick={() => setShowPerksModal(false)} className="p-1 rounded-full text-slate-400 hover:bg-slate-100 cursor-pointer">
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-[#464554]">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-2">
                <span className="material-symbols-outlined text-emerald-600 text-base">verified</span>
                <div>
                  <strong className="text-emerald-900 block">Fast-Track Desk Release</strong>
                  <span>Your high verification rating qualifies you for priority lockbox pickup without waiting for secondary manual inspection.</span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-start gap-2">
                <span className="material-symbols-outlined text-[#4648d4] text-base">military_tech</span>
                <div>
                  <strong className="text-indigo-900 block">Verified Finder Badge</strong>
                  <span>Your lost & found listings receive top placement on quad monitors and student alert broadcasts.</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPerksModal(false)}
              className="w-full py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold cursor-pointer"
            >
              Awesome!
            </button>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-200 flex flex-col gap-4 text-[#1a1b25]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1a1b25]">Delete Campus Listing?</h3>
                <p className="text-xs text-slate-400">Post ID #{deleteConfirmItem.id}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-xs text-[#1a1b25]">
              <p className="font-bold mb-1">"{deleteConfirmItem.title}"</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Are you sure you want to permanently remove this listing? All associated claim challenges, sightings, and handover dispatch data will be deleted from the database.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={deletingPost}
                onClick={() => setDeleteConfirmItem(null)}
                className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#1a1b25] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingPost}
                onClick={() => handleDeleteItem(deleteConfirmItem.id)}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">
                  {deletingPost ? 'sync' : 'delete'}
                </span>
                <span>{deletingPost ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

