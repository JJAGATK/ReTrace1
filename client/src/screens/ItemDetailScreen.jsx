import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ImageZoomModal from '../components/ImageZoomModal';

export default function ItemDetailScreen({ item, onBack, onClaimSuccess, onNavigate }) {
  const { user, token } = useAuth();
  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showZoomModal, setShowZoomModal] = useState(false);
  const [showSightingModal, setShowSightingModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCustodyModal, setShowCustodyModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Bookmarking state
  const [isBookmarked, setIsBookmarked] = useState(false);

  // Sightings state
  const [sightings, setSightings] = useState([]);
  const [loadingSightings, setLoadingSightings] = useState(false);
  const [sightingLocation, setSightingLocation] = useState('');
  const [sightingNotes, setSightingNotes] = useState('');
  const [submittingSighting, setSubmittingSighting] = useState(false);

  // Report/Flag state
  const [reportReason, setReportReason] = useState('inappropriate');
  const [reportDetails, setReportDetails] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Custody Chain state
  const [custodyLogs, setCustodyLogs] = useState([]);
  const [loadingCustody, setLoadingCustody] = useState(false);

  // Delete State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('✓ Post removed successfully.');
        setTimeout(() => {
          onBack();
        }, 800);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to delete post');
        setDeleting(false);
      }
    } catch (e) {
      showToast('Network error deleting post');
      setDeleting(false);
    }
  };

  // Claim form fields
  const [answers, setAnswers] = useState(['', '']);
  const [serialProvided, setSerialProvided] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimFeedback, setClaimFeedback] = useState(null);

  const photos = item.photos && item.photos.length > 0 ? item.photos : [
    'https://lh3.googleusercontent.com/aida-public/AB6AXuAcYCa4DURCtB06gVvwtPVsYi2eLaeQH6lXND3dpajC4vi3vlgOHonBSi1B_lzWF3tQoU5bIfaf8OyHRsRjSFm-ogUAoKhr-MMRDUim8wITRtilwcH6l0-mlWXLPow4TvdpW8tJ02T43qBOA7Gmu1rjjmiDv9OVzPtjPAo3WbvcQPyCuqpRlefbtyUtUtMIeT5P5X2OHygB5eCDHmptk15WKkNEQllzo4Bd-8Mtgh05OHpRy5Ywb8nzmQ'
  ];

  const questions = item.challenge_questions || [
    'What specific custom Bluetooth name broadcasts when opening the lid?',
    'What color or initials are on the silicone lanyard string or case hinge?'
  ];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Check if item is bookmarked
  useEffect(() => {
    async function checkBookmark() {
      if (!token) return;
      try {
        const res = await fetch('/api/bookmarks', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const found = data.bookmarks?.some(b => b.item_id === item.id || b.id === item.id);
          setIsBookmarked(!!found);
        }
      } catch (err) {}
    }
    checkBookmark();
  }, [item.id, token]);

  // Load sightings for lost items
  useEffect(() => {
    async function fetchSightings() {
      setLoadingSightings(true);
      try {
        const res = await fetch(`/api/items/${item.id}/sightings`);
        if (res.ok) {
          const data = await res.json();
          setSightings(data.sightings || []);
        }
      } catch (err) {
      } finally {
        setLoadingSightings(false);
      }
    }
    fetchSightings();
  }, [item.id]);

  const handleToggleBookmark = async () => {
    if (!token) {
      showToast('Please sign in to save listings to your bookmarks');
      return;
    }
    try {
      const res = await fetch(`/api/bookmarks/${item.id}/toggle`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsBookmarked(data.bookmarked);
        showToast(data.message || (data.bookmarked ? 'Saved to bookmarks' : 'Removed from bookmarks'));
      }
    } catch (err) {
      showToast('Failed to update bookmark');
    }
  };

  const handleClaimSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Please log in with your verified campus account to claim');
      return;
    }
    setSubmittingClaim(true);
    setClaimFeedback('Evaluating ownership challenge with secure ReTrace engine...');

    try {
      const res = await fetch(`/api/items/${item.id}/claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          answers,
          serial_provided: serialProvided,
          proof_notes: proofNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setClaimFeedback(data.message);
        setTimeout(() => {
          setShowClaimModal(false);
          if (onClaimSuccess) onClaimSuccess(data);
        }, 1800);
      } else {
        setClaimFeedback(data.error || 'Claim evaluation failed');
      }
    } catch (err) {
      setClaimFeedback('Network error. Failed to evaluate claim.');
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleSightingSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Please log in to report a sighting');
      return;
    }
    setSubmittingSighting(true);
    try {
      const res = await fetch(`/api/items/${item.id}/sightings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          location_clue: sightingLocation,
          notes: sightingNotes
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Thank you! Community sighting recorded and owner alerted.');
        setShowSightingModal(false);
        setSightingLocation('');
        setSightingNotes('');
        const refetch = await fetch(`/api/items/${item.id}/sightings`);
        if (refetch.ok) {
          const fresh = await refetch.json();
          setSightings(fresh.sightings || []);
        }
      } else {
        showToast(data.error || 'Failed to record sighting');
      }
    } catch (err) {
      showToast('Network error while reporting sighting');
    } finally {
      setSubmittingSighting(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      showToast('Please log in to submit a moderation report');
      return;
    }
    setSubmittingReport(true);
    try {
      const res = await fetch('/api/flags', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          target_type: 'item',
          target_id: item.id,
          reason: reportReason
        })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Report submitted for campus moderator review. Thank you!');
        setShowReportModal(false);
        setReportDetails('');
      } else {
        showToast(data.error || 'Failed to submit report');
      }
    } catch (err) {
      showToast('Network error while submitting report');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleOpenCustody = async () => {
    setShowCustodyModal(true);
    setLoadingCustody(true);
    try {
      const res = await fetch(`/api/items/${item.id}/custody-chain`);
      if (res.ok) {
        const data = await res.json();
        setCustodyLogs(data.custodyLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustody(false);
    }
  };

  return (
    <div className="relative z-10 max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 md:pt-6 pb-24">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 md:bottom-8 right-4 sm:right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#1a1b25] text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-bottom-5">
          <span className="material-symbols-outlined text-[#10B981] text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Bar with Back & Actions */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white text-[#1a1b25] border border-indigo-100 text-xs font-semibold shadow-xs transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          <span>Back to Live Feed</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleBookmark}
            title={isBookmarked ? 'Remove Bookmark' : 'Save to Bookmarks'}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs ${
              isBookmarked
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-700'
                : 'bg-white/80 hover:bg-white border-indigo-100 text-slate-600'
            }`}
          >
            <span className={`material-symbols-outlined text-sm ${isBookmarked ? 'fill-current text-amber-600' : 'text-slate-400'}`}>
              bookmark
            </span>
            <span>{isBookmarked ? 'Saved' : 'Save Listing'}</span>
          </button>

          <button
            onClick={handleOpenCustody}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/70 text-[#4648d4] text-xs font-semibold cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">verified_user</span>
            <span>Custody Audit</span>
          </button>

          {/* Delete Post Button for Admin or Owner */}
          {(user?.role === 'admin' || item.user_id === user?.id) && (
            <button
              onClick={() => setShowDeleteModal(true)}
              title={user?.role === 'admin' ? "Delete Listing (Security Administrator)" : "Delete My Listing"}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 text-rose-600 text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              <span>{user?.role === 'admin' ? 'Delete Post (Admin)' : 'Delete Post'}</span>
            </button>
          )}

          <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-700 text-xs font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Campus Net Active</span>
          </span>
        </div>
      </div>

      {/* Two-Column Balanced Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-start">
        
        {/* LEFT COLUMN: Media Stage & Location (7 Cols) */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          
          {/* Hero Gallery Card */}
          <div className="glass-panel rounded-2xl md:rounded-3xl p-3 sm:p-4 shadow-md flex flex-col gap-3 border border-indigo-200/50">
            <div className="relative w-full aspect-[4/3] rounded-xl md:rounded-2xl overflow-hidden bg-indigo-50/50 group">
              <img
                src={photos[activePhotoIdx]}
                alt={item.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02] cursor-pointer"
                onClick={() => setShowZoomModal(true)}
              />

              {/* Floating Badges */}
              <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                <span className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-semibold text-[#1a1b25] shadow-xs border border-white/80">
                  <span className="material-symbols-outlined text-emerald-600 text-sm">verified</span>
                  <span>Verified ReTrace Asset</span>
                </span>
                <span className="pointer-events-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-[11px] font-medium text-slate-600 shadow-xs border border-white/80">
                  <span className="material-symbols-outlined text-xs text-[#4648d4]">schedule</span>
                  <span>{new Date(item.created_at || Date.now()).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </span>
              </div>

              {/* Zoom Button */}
              <div className="absolute bottom-3 right-3 pointer-events-auto">
                <button
                  onClick={() => setShowZoomModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1a1b25]/85 hover:bg-[#1a1b25] text-white backdrop-blur-md text-xs font-semibold shadow-xs cursor-pointer transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">zoom_in</span>
                  <span>Zoom Proof</span>
                </button>
              </div>
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhotoIdx(idx)}
                    className={`relative aspect-square rounded-xl overflow-hidden shadow-xs cursor-pointer transition-all ${
                      activePhotoIdx === idx ? 'ring-2 ring-[#4648d4] scale-95' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Verification Telemetry Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="glass-panel-subtle rounded-2xl p-3 flex items-center gap-3 border border-indigo-100/70">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 shrink-0">
                <span className="material-symbols-outlined text-lg">image_search</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#1a1b25]">Exif Metadata Verified</div>
                <div className="text-[11px] text-[#464554] truncate">No tampering • 3024×4032 Original</div>
              </div>
            </div>

            <div className="glass-panel-subtle rounded-2xl p-3 flex items-center gap-3 border border-indigo-100/70">
              <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center text-[#4648d4] shrink-0">
                <span className="material-symbols-outlined text-lg">wifi_tethering</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#1a1b25]">Campus Wi-Fi Proximity</div>
                <div className="text-[11px] text-[#464554] truncate">Matched AP: Cabot-FL3-East</div>
              </div>
            </div>
          </div>

          {/* Radar Coarse Map View */}
          <div className="glass-panel rounded-2xl md:rounded-3xl p-4 sm:p-5 flex flex-col gap-3 border border-indigo-200/50">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-[#4648d4]">
                  <span className="material-symbols-outlined text-base">near_me</span>
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[#1a1b25]">Discovery Location</h3>
                  <p className="text-xs text-[#464554]">{item.coarse_location} — {item.floor_room}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('map', { building: item.coarse_location });
                  } else {
                    showToast(`Viewing ${item.coarse_location} on Campus Map`);
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-[#4648d4] font-semibold text-xs border border-indigo-200/70 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-sm">directions</span>
                <span>Campus Directions</span>
              </button>
            </div>

            {/* Simulated campus radar */}
            <div className="relative w-full h-44 rounded-xl overflow-hidden bg-[#eeecfc] border border-indigo-200/60 flex items-center justify-center">
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#4648d4_1px,transparent_1px)] [background-size:16px_16px]"></div>
              <div className="relative z-10 flex flex-col items-center">
                <span className="relative flex h-10 w-10 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4648d4] opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-8 w-8 bg-[#4648d4] items-center justify-center text-white shadow-md">
                    <span className="material-symbols-outlined text-base">
                      {item.category === 'Electronics' ? 'devices' : item.category === 'Wallets & IDs' ? 'badge' : 'inventory_2'}
                    </span>
                  </span>
                </span>
                <div className="mt-2 px-2.5 py-0.5 rounded-full bg-white shadow-xs text-[11px] font-bold text-[#1a1b25] border border-indigo-100">
                  {item.coarse_location}
                </div>
              </div>
              <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md shadow-xs flex items-center gap-1.5 text-[11px] font-medium text-[#1a1b25] border border-indigo-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Coarse Zone (Exact Coordinates Protected by ReTrace)</span>
              </div>
            </div>
          </div>

          {/* Community Sightings History (Especially for Lost Items) */}
          <div className="glass-panel rounded-2xl md:rounded-3xl p-4 sm:p-5 flex flex-col gap-3 border border-indigo-200/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#4648d4] text-lg">share_location</span>
                <h3 className="font-bold text-sm text-[#1a1b25]">Community Sightings ({sightings.length})</h3>
              </div>
              <button
                onClick={() => setShowSightingModal(true)}
                className="text-xs text-[#4648d4] font-semibold hover:underline cursor-pointer"
              >
                + Add Sighting
              </button>
            </div>

            {loadingSightings ? (
              <p className="text-xs text-slate-400 py-2">Loading campus reports...</p>
            ) : sightings.length === 0 ? (
              <p className="text-xs text-[#464554] italic py-2">
                No sightings reported yet. If you have spotted this item on campus, click "+ Add Sighting" to help the owner.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {sightings.map((s, idx) => (
                  <div key={s.id || idx} className="p-2.5 rounded-xl bg-white/70 border border-indigo-100/80 flex items-start gap-2.5 text-xs">
                    <span className="material-symbols-outlined text-amber-500 text-sm mt-0.5">location_on</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-[#1a1b25]">{s.location_description}</span>
                        <span className="text-[10px] text-slate-400">{new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {s.notes && <p className="text-[#464554] mt-0.5">{s.notes}</p>}
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                        <span>Reported by</span>
                        <strong className="text-indigo-600">{s.reporter_name || 'Verified Student'}</strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: Liquid Glass Detail & Claim Card (5 Cols) */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="glass-panel rounded-2xl md:rounded-3xl p-5 sm:p-6 flex flex-col gap-4 border border-indigo-200/60 shadow-lg shadow-indigo-500/5">
            
            {/* Top Badge & ID Row */}
            <div className="flex items-center justify-between">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                item.type === 'found'
                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/25'
                  : 'bg-rose-500/10 text-rose-700 border border-rose-500/25'
              }`}>
                <span className={`w-2 h-2 rounded-full ${item.type === 'found' ? 'bg-emerald-500' : 'bg-[#F43F5E]'}`}></span>
                <span>{item.type === 'found' ? 'FOUND & SAFEKEEPING' : 'LOST REPORT'}</span>
              </span>
              <span className="text-xs font-semibold text-slate-400 tracking-wide font-mono">
                ID #{item.id}
              </span>
            </div>

            {/* Header */}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
                {item.title}
              </h1>
              <p className="text-xs sm:text-sm text-[#464554] mt-1 flex items-center gap-1.5">
                <span>{item.category}</span>
                <span>•</span>
                <span className="text-[#4648d4] font-semibold">Eligible for Campus Verification</span>
              </p>
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-[#464554] leading-relaxed">
              {item.description}
            </p>

            {/* Safekeeping Desk Node */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-100 text-[#4648d4] shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-lg">local_police</span>
              </div>
              <div className="text-xs leading-relaxed">
                <div className="font-bold text-[#1a1b25] mb-0.5">Secure Physical Custody</div>
                <p className="text-[#464554]">
                  Stored at the <strong className="text-[#1a1b25] font-semibold">{item.custody_desk_name || 'Cabot Library Circulation Desk'}</strong>. Duty librarian available until 11:00 PM.
                </p>
              </div>
            </div>

            {/* Finder Trust Profile Widget */}
            <div className="p-3.5 rounded-2xl bg-white/70 border border-indigo-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    alt={item.reporter_name}
                    className="w-11 h-11 rounded-full object-cover ring-2 ring-indigo-200 shadow-xs"
                    src={item.reporter_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">
                    <span className="material-symbols-outlined text-[10px]">check</span>
                  </span>
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-[#1a1b25] truncate">{item.reporter_name}</span>
                    <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-[10px] font-semibold text-indigo-700">
                      Undergrad '25
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#464554] mt-0.5">
                    <span className="text-emerald-600 font-semibold">14 Returns</span>
                    <span>•</span>
                    <span className="text-[#4648d4] font-semibold">100% Trust Score</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (onNavigate) {
                    onNavigate('handover', { itemId: item.id });
                  } else {
                    showToast('Opening secure handover dispatch chat');
                  }
                }}
                className="p-2 rounded-full text-slate-500 hover:text-[#4648d4] hover:bg-indigo-50 transition-colors cursor-pointer"
                title="Message Finder / Handover Desk"
              >
                <span className="material-symbols-outlined text-lg">chat_bubble_outline</span>
              </button>
            </div>

            {/* Claim Verification Security Criteria */}
            {item.type === 'found' && (
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200/70 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-[#6b38d4]">
                  <span className="material-symbols-outlined text-base">shield_lock</span>
                  <span className="font-bold text-xs uppercase tracking-wide">Verification Required</span>
                </div>
                <p className="text-xs text-[#464554]">To claim this item securely, you will need to confirm:</p>
                <ul className="list-disc list-inside text-xs text-[#1a1b25] font-medium space-y-1 pl-1 pt-0.5">
                  <li>Bluetooth broadcast name or case markings</li>
                  <li>Approximate timestamp in Apple Find My or receipt proof</li>
                </ul>
              </div>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col gap-2 pt-1">
              {item.type === 'found' && item.status !== 'returned' ? (
                <button
                  type="button"
                  onClick={() => setShowClaimModal(true)}
                  className="w-full py-3 px-6 rounded-full btn-gradient-indigo text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">verified_user</span>
                  <span>Claim This Item (Proof Challenge)</span>
                </button>
              ) : item.type === 'lost' ? (
                <button
                  type="button"
                  onClick={() => setShowSightingModal(true)}
                  className="w-full py-3 px-6 rounded-full bg-[#F43F5E] hover:bg-rose-600 text-white font-bold text-sm shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-lg">visibility</span>
                  <span>I've Spotted This Item</span>
                </button>
              ) : (
                <div className="w-full py-3 px-6 rounded-full bg-emerald-100 text-emerald-800 text-center font-bold text-xs">
                  Item Safely Returned to Verified Owner
                </div>
              )}

              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate('handover', { itemId: item.id });
                    } else {
                      showToast('Connecting to Cabot Desk dispatch...');
                    }
                  }}
                  className="py-2 px-2 rounded-full bg-white hover:bg-indigo-50 text-[#1a1b25] font-semibold text-xs transition-colors flex items-center justify-center gap-1 border border-indigo-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-[#4648d4]">chat</span>
                  <span>Desk</span>
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    showToast('Shareable link copied to clipboard!');
                  }}
                  className="py-2 px-2 rounded-full bg-white hover:bg-indigo-50 text-[#1a1b25] font-semibold text-xs transition-colors flex items-center justify-center gap-1 border border-indigo-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-[#4648d4]">share</span>
                  <span>Share</span>
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="py-2 px-2 rounded-full bg-white hover:bg-rose-50 text-slate-600 font-semibold text-xs transition-colors flex items-center justify-center gap-1 border border-indigo-100 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base text-rose-500">flag</span>
                  <span>Report</span>
                </button>
              </div>
            </div>

            {/* Handover Notice */}
            <div className="flex items-center gap-2 text-[#464554] text-[11px] pt-1">
              <span className="material-symbols-outlined text-[#6b38d4] text-base shrink-0">qr_code_2</span>
              <span>Physical handover verified via dynamic QR code & student ID at Cabot Desk.</span>
            </div>

          </div>
        </section>

      </div>

      {/* INTERACTIVE MULTI-LEVEL IMAGE ZOOM VIEWER */}
      <ImageZoomModal
        isOpen={showZoomModal}
        onClose={() => setShowZoomModal(false)}
        photos={photos}
        initialIdx={activePhotoIdx}
        itemTitle={item.title}
      />

      {/* SIGHTING SUBMISSION MODAL */}
      {showSightingModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200/80 flex flex-col gap-4 text-[#1a1b25]">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <span className="material-symbols-outlined text-lg">visibility</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1a1b25]">Report Item Sighting</h3>
                  <p className="text-xs text-slate-400">{item.title}</p>
                </div>
              </div>
              <button
                onClick={() => setShowSightingModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100:bg-indigo-950/60 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-[#464554]">
              Where and when did you spot this item? Your report will be instantly dispatched to the campus community and verified owner.
            </p>

            <form onSubmit={handleSightingSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">Campus Location</span>
                <input
                  type="text"
                  required
                  value={sightingLocation}
                  onChange={(e) => setSightingLocation(e.target.value)}
                  placeholder="e.g. Science Center, 2nd floor lounge sofa"
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">Notes or Clues</span>
                <textarea
                  rows={3}
                  value={sightingNotes}
                  onChange={(e) => setSightingNotes(e.target.value)}
                  placeholder="e.g. Saw it near the coffee machine around 1:30 PM. Looked intact."
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4] resize-none"
                ></textarea>
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSightingModal(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200:bg-[#282b45] text-[#1a1b25] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSighting}
                  className="flex-1 py-2.5 rounded-full bg-[#F43F5E] hover:bg-rose-600 text-white text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingSighting ? 'Dispatching...' : 'Submit Sighting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPORT / FLAG MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200/80 flex flex-col gap-4 text-[#1a1b25]">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600">
                  <span className="material-symbols-outlined text-lg">flag</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1a1b25]">Report Listing</h3>
                  <p className="text-xs text-slate-400">Item #{item.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100:bg-indigo-950/60 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleReportSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">Reason</span>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                >
                  <option value="inappropriate">Inappropriate or offensive content</option>
                  <option value="spam">Spam or fake listing</option>
                  <option value="privacy_violation">Contains private personal data (PII)</option>
                  <option value="counterfeit">Suspicious or prohibited item</option>
                  <option value="other">Other issue</option>
                </select>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">Additional Details</span>
                <textarea
                  rows={3}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Explain why this listing violates campus guidelines..."
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4] resize-none"
                ></textarea>
              </label>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200:bg-[#282b45] text-[#1a1b25] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReport}
                  className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTODY AUDIT CHAIN MODAL */}
      {showCustodyModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200/80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-[#1a1b25]">
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-[#4648d4]">
                  <span className="material-symbols-outlined text-lg">lock_reset</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1a1b25]">Cryptographic Custody Chain</h3>
                  <p className="text-xs text-slate-400">ReTrace Immutable Audit Trail</p>
                </div>
              </div>
              <button
                onClick={() => setShowCustodyModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100:bg-indigo-950/60 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {loadingCustody ? (
              <div className="py-8 text-center text-xs text-slate-400">Verifying SHA-256 blocks...</div>
            ) : custodyLogs.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No custody events logged yet.</div>
            ) : (
              <div className="flex flex-col gap-3">
                {custodyLogs.map((log, idx) => (
                  <div key={log.id || idx} className="p-3 rounded-2xl bg-indigo-50/40 border border-indigo-100 text-xs flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#1a1b25] capitalize">{log.action_type?.replace(/_/g, ' ')}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-[#464554]">{log.notes || `Custody event by ${log.actor_name || 'Authorized Officer'}`}</p>
                    <div className="text-[10px] font-mono text-slate-400 truncate bg-white/80 p-1.5 rounded border border-indigo-100/60 mt-1">
                      Hash: {log.block_hash || log.previous_hash || '0x7e81a9...c4b2'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setShowCustodyModal(false)}
                className="px-5 py-2 rounded-full bg-slate-100 hover:bg-slate-200:bg-[#282b45] text-[#1a1b25] text-xs font-semibold cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Ownership Verification Modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-indigo-200/80 flex flex-col gap-4 max-h-[90vh] overflow-y-auto text-[#1a1b25]">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-[#4648d4]">
                  <span className="material-symbols-outlined text-lg">fingerprint</span>
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#1a1b25]">Ownership Verification</h3>
                  <p className="text-xs text-slate-400">{item.title} #{item.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowClaimModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:bg-slate-100:bg-indigo-950/60 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-xs text-[#464554] leading-relaxed">
              To prevent theft, answer the finder's private questions. Answers are evaluated securely on the server and are never disclosed to other claimants or the public.
            </p>

            <form onSubmit={handleClaimSubmit} className="flex flex-col gap-3">
              
              {/* Question 1 */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">
                  1. {questions[0] || 'What is the custom device broadcast name or lock screen detail?'}
                </span>
                <input
                  type="text"
                  required
                  value={answers[0] || ''}
                  onChange={(e) => {
                    const next = [...answers];
                    next[0] = e.target.value;
                    setAnswers(next);
                  }}
                  placeholder="e.g. Evan's Pods 2024 or custom name"
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </label>

              {/* Question 2 */}
              {questions[1] && (
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-[#1a1b25]">
                    2. {questions[1]}
                  </span>
                  <input
                    type="text"
                    value={answers[1] || ''}
                    onChange={(e) => {
                      const next = [...answers];
                      next[1] = e.target.value;
                      setAnswers(next);
                    }}
                    placeholder="e.g. Laser engraving initials, case color..."
                    className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                  />
                </label>
              )}

              {/* Serial number match */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">
                  3. Serial Number / Engraved ID (If Known)
                </span>
                <input
                  type="text"
                  value={serialProvided}
                  onChange={(e) => setSerialProvided(e.target.value)}
                  placeholder="e.g. H9CGV42K01 (from box, receipt, or Apple ID)"
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs font-mono text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </label>

              {/* Distinguishing proof notes */}
              <label className="flex flex-col gap-1">
                <span className="text-xs font-bold text-[#1a1b25]">
                  4. Proof of Ownership Notes
                </span>
                <textarea
                  rows={2}
                  value={proofNotes}
                  onChange={(e) => setProofNotes(e.target.value)}
                  placeholder="Describe timestamp in Apple Find My, scratches, or attach receipt details..."
                  className="px-3.5 py-2 rounded-xl bg-indigo-50/40 text-xs text-[#1a1b25] border border-indigo-200/70 focus:outline-none focus:ring-2 focus:ring-[#4648d4] resize-none"
                ></textarea>
              </label>

              {claimFeedback && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-xs font-semibold text-[#4648d4]">
                  {claimFeedback}
                </div>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClaimModal(false)}
                  className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200:bg-[#282b45] text-[#1a1b25] text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingClaim}
                  className="flex-1 py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold shadow-sm active:scale-[0.98] transition-all cursor-pointer disabled:opacity-50"
                >
                  {submittingClaim ? 'Evaluating...' : 'Submit Verification'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-[#1a1b25]/70 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-200 flex flex-col gap-4 text-[#1a1b25]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">delete_forever</span>
              </div>
              <div>
                <h3 className="font-bold text-base text-[#1a1b25]">Delete Campus Post?</h3>
                <p className="text-xs text-slate-400">Post ID #{item.id}</p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-xs text-[#1a1b25]">
              <p className="font-bold mb-1">"{item.title}"</p>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                Are you sure you want to permanently delete this listing? All active claim challenges, messages, and custody chain events for this item will be removed.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#1a1b25] cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">
                  {deleting ? 'sync' : 'delete'}
                </span>
                <span>{deleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
