import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { id: 'All Items', label: 'All Items', icon: 'dataset', count: 142 },
  { id: 'Tech & Audio', label: 'Tech', icon: 'devices', count: 48 },
  { id: 'Bags & Wallets', label: 'Bags', icon: 'backpack', count: 24 },
  { id: 'Campus IDs', label: 'IDs & Cards', icon: 'badge', count: 19 },
  { id: 'Keys & Dorm', label: 'Keys', icon: 'key', count: 17 },
  { id: 'Bottles & Mugs', label: 'Bottles', icon: 'water_bottle', count: 11 },
  { id: 'Apparel', label: 'Apparel', icon: 'apparel', count: 14 },
  { id: 'Books & Notes', label: 'Books', icon: 'menu_book', count: 13 },
];

export default function LiveFeedScreen({ onSelectItem, onOpenPostModal, onOpenClaimModal, searchQuery }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('all'); // 'all', 'lost', 'found', 'returned'
  const [toastMessage, setToastMessage] = useState(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedTypeFilter !== 'all') {
        if (selectedTypeFilter === 'returned') {
          params.append('status', 'returned');
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
        setItems(data.items);
      }
    } catch (e) {
      console.error('Error fetching items', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedCategory, selectedTypeFilter, searchQuery]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 pb-24 md:pb-12">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1b25] text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#10B981] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="flex flex-col gap-5 md:gap-6">
        
        {/* Responsive Category Stories Rail */}
        <section className="w-full relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <h2 className="text-xs md:text-sm font-bold uppercase tracking-wider text-[#1a1b25]">Categories</h2>
              <span className="text-[11px] font-semibold text-[#4648d4] bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                142 active items
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 md:gap-4 overflow-x-auto no-scrollbar scroll-smooth py-1 px-0.5">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="group flex flex-col items-center gap-1.5 shrink-0 focus:outline-none tap-highlight-transparent cursor-pointer"
                >
                  <div className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-2xl p-[2px] transition-all group-hover:scale-105 ${
                    isActive
                      ? 'bg-gradient-to-tr from-[#4648d4] via-[#8455ef] to-pink-500 shadow-md shadow-indigo-500/25'
                      : 'bg-slate-200 group-hover:bg-gradient-to-tr group-hover:from-indigo-400 group-hover:to-violet-400'
                  }`}>
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center">
                      <span className={`material-symbols-outlined text-xl sm:text-2xl transition-colors ${
                        isActive ? 'text-[#4648d4]' : 'text-[#464554] group-hover:text-[#4648d4]'
                      }`}>
                        {cat.icon}
                      </span>
                    </div>
                    <span className={`absolute -bottom-1 -right-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full shadow-xs ${
                      isActive ? 'bg-[#4648d4] text-white' : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {cat.count}
                    </span>
                  </div>
                  <span className={`text-xs tracking-tight ${
                    isActive ? 'font-bold text-[#4648d4]' : 'font-medium text-[#464554]'
                  }`}>
                    {cat.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Fluid Filter Toolbar */}
        <div className="glass-panel p-2 rounded-2xl flex items-center justify-between gap-2 overflow-x-auto no-scrollbar border-indigo-100/70">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setSelectedTypeFilter('all')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                selectedTypeFilter === 'all'
                  ? 'btn-gradient-indigo text-white shadow-xs'
                  : 'bg-white/80 hover:bg-white text-[#464554] border border-indigo-100'
              }`}
            >
              All Items
            </button>

            <button
              onClick={() => setSelectedTypeFilter('lost')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'lost'
                  ? 'bg-[#F43F5E] text-white font-bold shadow-xs'
                  : 'bg-white/80 hover:bg-white text-[#464554] border border-indigo-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedTypeFilter === 'lost' ? 'bg-white' : 'bg-[#F43F5E]'}`}></span>
              <span>Lost Reports</span>
            </button>

            <button
              onClick={() => setSelectedTypeFilter('found')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'found'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'bg-white/80 hover:bg-white text-[#464554] border border-indigo-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedTypeFilter === 'found' ? 'bg-white' : 'bg-emerald-500'}`}></span>
              <span>Found Safeguarded</span>
            </button>

            <button
              onClick={() => setSelectedTypeFilter('returned')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                selectedTypeFilter === 'returned'
                  ? 'bg-violet-600 text-white font-bold shadow-xs'
                  : 'bg-white/80 hover:bg-white text-[#464554] border border-indigo-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${selectedTypeFilter === 'returned' ? 'bg-white' : 'bg-violet-500'}`}></span>
              <span>Reunited</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">
              Showing {items.length} campus matches
            </span>
          </div>
        </div>

        {/* Main Responsive Grid: 8 cols Feed + 4 cols Desktop Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Feed Column */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            
            {loading ? (
              <div className="glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#4648d4] animate-spin mb-2">sync</span>
                <p className="text-xs font-semibold text-slate-500">Scanning campus geofenced radar...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="glass-card rounded-2xl p-12 text-center">
                <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">search_off</span>
                <h3 className="text-sm font-bold text-[#1a1b25]">No items match this filter</h3>
                <p className="text-xs text-slate-500 mt-1">Try selecting "All Items" or reset your search query.</p>
              </div>
            ) : (
              items.map((item) => {
                const isFound = item.type === 'found';
                const isReturned = item.status === 'returned';

                return (
                  <article
                    key={item.id}
                    className={`glass-card glass-card-hover rounded-2xl sm:rounded-3xl overflow-hidden transition-all ${
                      item.is_urgent ? 'border-rose-200/80 shadow-rose-500/5' : 'border-indigo-100/70'
                    }`}
                  >
                    {/* Card Header */}
                    <div className="p-3.5 sm:p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <img
                            src={item.reporter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                            alt={item.reporter_name}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover ring-1 ring-indigo-200"
                          />
                          <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-[9px] font-black">check</span>
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-xs sm:text-sm font-bold text-[#1a1b25] leading-tight">
                              {item.reporter_name}
                            </h3>
                            <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-[10px] font-semibold flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[10px]">verified</span> Verified .edu
                            </span>
                          </div>
                          <p className="text-[11px] sm:text-xs text-[#464554] flex items-center gap-0.5 mt-0.5">
                            <span className="material-symbols-outlined text-[#4648d4] text-xs">pin_drop</span>
                            <span>{item.coarse_location} • {item.floor_room || 'General Zone'}</span>
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium">
                        {item.created_at ? new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                      </span>
                    </div>

                    {/* Card Media Stage */}
                    {item.photos && item.photos.length > 0 && (
                      <div 
                        onClick={() => onSelectItem(item)}
                        className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-indigo-50/50 overflow-hidden cursor-pointer group"
                      >
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />

                        {/* Floating Badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5">
                          {isReturned ? (
                            <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">verified</span> REUNITED
                            </span>
                          ) : isFound ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/95 backdrop-blur-md text-white text-xs font-bold shadow-sm flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> FOUND
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-[#F43F5E] text-white text-xs font-bold shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">error</span> LOST • URGENT
                            </span>
                          )}

                          {item.custody_type === 'official_desk' && (
                            <span className="px-2 py-0.5 rounded-full bg-[#1a1b25]/75 backdrop-blur-md text-white text-[11px] font-medium border border-white/10">
                              Front Desk Safe
                            </span>
                          )}

                          {item.reward_offered && (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-sm flex items-center gap-1">
                              <span className="material-symbols-outlined text-xs">savings</span> {item.reward_offered}
                            </span>
                          )}
                        </div>

                        {item.photos.length > 1 && (
                          <div className="absolute bottom-3 right-3">
                            <span className="px-2 py-0.5 rounded-full bg-[#1a1b25]/75 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1 border border-white/10">
                              <span className="material-symbols-outlined text-xs">photo_camera</span> {item.photos.length} photos
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Card Body & Details */}
                    <div className="p-4 sm:p-5 flex flex-col gap-3">
                      <div>
                        <h4 
                          onClick={() => onSelectItem(item)}
                          className="text-sm sm:text-base font-bold text-[#1a1b25] tracking-tight hover:text-[#4648d4] cursor-pointer transition-colors"
                        >
                          {item.title}
                        </h4>
                        <p className="text-xs sm:text-sm text-[#464554] mt-1 leading-relaxed line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      {/* Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-medium">
                          #{item.category}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[11px] font-medium">
                          #{item.coarse_location.replace(/\s+/g, '')}
                        </span>

                        {isFound && item.has_challenge && (
                          <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/50 flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">lock</span> Ownership Challenge Active
                          </span>
                        )}
                      </div>

                      {/* Fluid Action Bar */}
                      <div className="pt-2 border-t border-indigo-100/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => showToast('Listing saved to your activity')}
                            aria-label="Bookmark"
                            className="p-2 rounded-full text-slate-500 hover:text-[#4648d4] hover:bg-indigo-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg sm:text-xl">bookmark_border</span>
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(window.location.href);
                              showToast('Campus alert link copied!');
                            }}
                            aria-label="Share"
                            className="p-2 rounded-full text-slate-500 hover:text-[#4648d4] hover:bg-indigo-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-lg sm:text-xl">share</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onSelectItem(item)}
                            className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs sm:text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm sm:text-base">visibility</span>
                            <span>Details</span>
                          </button>

                          {isFound && !isReturned && (
                            <button
                              onClick={() => onOpenClaimModal(item)}
                              className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full btn-gradient-indigo text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">verified_user</span>
                              <span>Claim</span>
                            </button>
                          )}

                          {!isFound && !isReturned && (
                            <button
                              onClick={() => showToast('Location clue dispatched to student owner!')}
                              className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-full bg-[#F43F5E] hover:bg-rose-600 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-sm sm:text-base">visibility</span>
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
            <article className="glass-card rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 border-violet-200/50 hover:border-violet-300/80 transition-all">
              <div className="relative w-full sm:w-28 h-24 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                <img
                  alt="Sony Headphones"
                  className="w-full h-full object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuB8Wswf5Q5_OaleRZkuD_pIfe3AoMlXtOICoGZ4io8GRDJ3J8af98eLn6Cfq0fm1kbg0Tg2THj2KrTrd7tQpEY7yw8cn9kOpaiG4FAdukk83RztCIG8hV9M_inVAoKSdOcFQNNB-FXJ5kt3HvbuONs4E842g3d8CibCj0nPx4QPD_88lfAhpACtmq0KE5qLmHGyLRk38YAO9o2nnCBq8gIINRn-Fr9G2G2iyfnSwmkk4SIb-CqbjTzZNQ"
                />
                <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-[9px] font-bold">
                  REUNITED
                </span>
              </div>
              <div className="flex-1 w-full">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-xs">verified</span> Handover Verified
                  </span>
                  <span className="text-[11px] text-slate-400">Yesterday at Cabot Desk</span>
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-[#1a1b25] mt-1">
                  Sony WH-1000XM5 Headphones Reunited!
                </h4>
                <p className="text-xs text-[#464554] line-clamp-1">
                  Matched via Bluetooth MAC address and safely returned to verified owner.
                </p>
              </div>
              <button 
                onClick={() => showToast('Chain of custody verified with SHA-256 hash stamp.')}
                className="w-full sm:w-auto shrink-0 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold transition-all cursor-pointer"
              >
                View Log
              </button>
            </article>

          </div>

          {/* Minimalist Liquid Glass Sidebar */}
          <aside className="lg:col-span-4 flex flex-col gap-5 w-full">
            
            {/* Quick Report Banner */}
            <div className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-[#4648d4] via-indigo-700 to-[#6b38d4] text-white shadow-xl shadow-indigo-500/20 border border-indigo-400/30">
              <div className="relative z-10">
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[11px] font-semibold mb-2">
                  Zero-Hassle Campus Return
                </span>
                <h3 className="text-base sm:text-lg font-bold tracking-tight leading-snug">
                  Found an abandoned item?
                </h3>
                <p className="text-xs text-indigo-100 mt-1 leading-relaxed">
                  Snap a quick photo, drop a pin, and our automated campus matcher alerts rightful owners immediately.
                </p>
                <button
                  onClick={onOpenPostModal}
                  className="mt-4 w-full py-2.5 px-4 rounded-xl bg-white hover:bg-indigo-50 text-[#4648d4] font-bold text-xs tracking-wide shadow-md flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">add_a_photo</span>
                  <span>Publish Quick Report</span>
                </button>
              </div>
              <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none"></div>
            </div>

            {/* Safe Exchange Zones Card */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 flex flex-col gap-3 border-indigo-100/60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#4648d4] text-lg">shield</span>
                  <h3 className="text-xs sm:text-sm font-bold text-[#1a1b25]">Safe Exchange Zones</h3>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-bold">
                  24/7 CCTV
                </span>
              </div>
              <p className="text-xs text-[#464554] leading-relaxed">
                Campus checkpoints with duty officers recommended for contactless recovery handovers.
              </p>

              <div className="flex flex-col gap-2 pt-1">
                <div className="p-2.5 rounded-xl bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-100/70 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#1a1b25] truncate">Campus Police Annex</p>
                      <span className="text-[10px] text-slate-400">Main Gate • 24/7 Monitored</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#4648d4]">Zone A</span>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-100/70 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#1a1b25] truncate">Cabot Circulation Desk</p>
                      <span className="text-[10px] text-slate-400">Central Atrium • Until 11 PM</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#4648d4]">Zone B</span>
                </div>

                <div className="p-2.5 rounded-xl bg-indigo-50/40 hover:bg-indigo-50/80 border border-indigo-100/70 flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-[#1a1b25] truncate">Student Union Info Hub</p>
                      <span className="text-[10px] text-slate-400">Lounge 2 • 8 AM – 10 PM</span>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold text-[#4648d4]">Zone C</span>
                </div>
              </div>
            </div>

            {/* Trust Score Card */}
            <div className="glass-card rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-3 border-indigo-100/60">
              <div className="flex items-center gap-3.5">
                <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      className="text-indigo-100"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3.5"
                    />
                    <path
                      className="text-[#4648d4]"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      strokeDasharray={`${user?.trust_score || 98}, 100`}
                      strokeLinecap="round"
                      strokeWidth="3.5"
                    />
                  </svg>
                  <span className="absolute font-bold text-xs text-[#1a1b25]">
                    {user?.trust_score || 98}%
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-[#1a1b25]">Your Campus Trust Score</h4>
                    <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[9px] font-bold rounded">
                      Level 3
                    </span>
                  </div>
                  <p className="text-[11px] text-[#464554] mt-0.5">
                    {user?.returns_count || 4} items returned with verified classmate ratings.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => showToast('Trust Level 3 qualifies you for priority desk handovers!')}
                className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[11px] font-semibold text-indigo-900 shrink-0 cursor-pointer"
              >
                Perks
              </button>
            </div>

          </aside>
        </div>

      </div>
    </div>
  );
}
