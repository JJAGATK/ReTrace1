import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const CAMPUS_BUILDINGS = [
  { name: 'Cabot Science Library', icon: 'local_library', lat: 42.3785, lng: -71.1167 },
  { name: 'Widener Library', icon: 'account_balance', lat: 42.3738, lng: -71.1165 },
  { name: 'Student Union Hub', icon: 'groups', lat: 42.3736, lng: -71.1189 },
  { name: 'Annenberg Hall', icon: 'restaurant', lat: 42.3762, lng: -71.1156 },
  { name: 'Malkin Athletic Center', icon: 'fitness_center', lat: 42.3705, lng: -71.1202 },
  { name: 'Pierce Engineering Hall', icon: 'domain', lat: 42.3789, lng: -71.1158 },
];

const ITEM_CATEGORIES = [
  { id: 'Tech & Audio', icon: 'headphones' },
  { id: 'Campus IDs', icon: 'badge' },
  { id: 'Bags & Wallets', icon: 'backpack' },
  { id: 'Keys & Dorm', icon: 'key' },
  { id: 'Jackets & Gear', icon: 'apparel' },
  { id: 'Bottles & Mugs', icon: 'water_bottle' },
  { id: 'Books & Notes', icon: 'menu_book' },
  { id: 'Eyewear', icon: 'qr_code_2' },
];

export default function PostItemScreen({ onPostCreated, onCancel }) {
  const { user, token } = useAuth();

  const [itemType, setItemType] = useState('found'); // 'found' or 'lost'
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tech & Audio');
  const [building, setBuilding] = useState('Cabot Science Library');
  const [floorRoom, setFloorRoom] = useState('3rd Floor Carrel #42 (Near window)');
  const [description, setDescription] = useState('');
  const [custodyType, setCustodyType] = useState('official_desk');
  const [custodyDeskName, setCustodyDeskName] = useState('Cabot Circulation Desk (Staff ID: #L-89)');
  const [reward, setReward] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Verification challenge (Found only)
  const [q1, setQ1] = useState('What specific custom Bluetooth name broadcasts when opening the lid?');
  const [a1, setA1] = useState("Evan's Pods 2024");
  const [q2, setQ2] = useState('What color or initials are on the silicone lanyard string or case hinge?');
  const [a2, setA2] = useState('M.C.');
  const [intakeSerial, setIntakeSerial] = useState('H9CGV42K01');

  // Multi-angle mock photos
  const [photos, setPhotos] = useState([
    'https://lh3.googleusercontent.com/aida-public/AB6AXuDj-ehWVMfQn7dF8yS4Wdy3kiDqHStQsuTIaVroIBJqJJfrq5A4MXPb6i_8P8a-jkoNTn5ckg2hA4RPN7b3YvgmeeYtZNfn8byz1rt84F8K6bFMXJ-Jshc9r2SRUKBgg9FZ_gmZ7N_d_qTWM-EBwA_sjxSAuk_BSMhrxLYTSXmtKYKt2xSdUsS6-K0v4Cx_farA6TDzG-OFNOoU8_aojIGDYKscb10VKlq5zRQzP4S6hxrA80d-AuWaEA',
    'https://lh3.googleusercontent.com/aida-public/AB6AXuARgCaAW3sNK09cxfc3bfSu5DhR6athy2IA-cXHTeJa6niO5hy5jcJFiirqG6ib1dVrgUaVkW2QaPnUDSIQvURZvOw3xjEvSK548xgYq8k6L8eu-up699bagl9kCvFyXtfKjZH98m45waIahllahQ8YwKybZSeEou9sjF51Nd1VucIRDNY9_j7gHwAH-mK6IkGYMPP63t04aCPRMRNdBJHtrGxsJZTSYSAOu7dcEAP4TdX3r4EIV5u7Yg'
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title) {
      setFeedback('Please provide an item title.');
      return;
    }

    setSubmitting(true);
    setFeedback('Matching Quad Beacons & Encrypting PII...');

    try {
      const bObj = CAMPUS_BUILDINGS.find(b => b.name === building) || CAMPUS_BUILDINGS[0];

      const payload = {
        type: itemType,
        title,
        category,
        description,
        coarse_location: building,
        floor_room: floorRoom,
        latitude: bObj.lat,
        longitude: bObj.lng,
        exact_location_notes: `${building}, ${floorRoom}`,
        custody_type: custodyType,
        custody_desk_name: custodyType === 'official_desk' ? custodyDeskName : 'Safe Self-Custody with Finder',
        photos,
        reward_offered: itemType === 'lost' ? reward : null,
        is_urgent: isUrgent,
        verification_questions: itemType === 'found' ? [q1, q2].filter(Boolean) : [],
        secret_answers: itemType === 'found' ? [a1, a2].filter(Boolean) : [],
        intake_serial: itemType === 'found' ? intakeSerial : null
      };

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFeedback('✓ Alert Dispatched to Campus Commons!');
        setTimeout(() => {
          onPostCreated();
        }, 1200);
      } else {
        const err = await res.json();
        setFeedback(err.error || 'Failed to submit report');
        setSubmitting(false);
      }
    } catch (err) {
      setFeedback('Network error. Check connection to campus net.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28">
      
      {/* Top Breadcrumb / Title Bar */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
            Post Campus Alert
          </h1>
          <p className="text-xs text-[#464554] mt-0.5">
            Report an item found on campus or broadcast a lost item to the university network.
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#1a1b25] text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Mode Switcher Tabs */}
      <div className="glass-panel p-2 rounded-2xl mb-6 max-w-xl mx-auto flex gap-2 border border-indigo-100/80">
        <button
          type="button"
          onClick={() => setItemType('found')}
          className={`flex-1 p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
            itemType === 'found'
              ? 'bg-white text-[#1a1b25] border border-primary/20 shadow-md font-bold'
              : 'text-[#464554] hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600 text-xl">back_hand</span>
            <div>
              <div className="text-xs sm:text-sm">I Found an Item</div>
              <div className="text-[10px] text-slate-400 font-normal">Add verification challenge</div>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
        </button>

        <button
          type="button"
          onClick={() => setItemType('lost')}
          className={`flex-1 p-3 rounded-xl flex items-center justify-between text-left transition-all cursor-pointer ${
            itemType === 'lost'
              ? 'bg-white text-[#1a1b25] border border-primary/20 shadow-md font-bold'
              : 'text-[#464554] hover:bg-white/60'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#F43F5E] text-xl">travel_explore</span>
            <div>
              <div className="text-xs sm:text-sm">I Lost an Item</div>
              <div className="text-[10px] text-slate-400 font-normal">Broadcast to campus quads</div>
            </div>
          </div>
          <span className="w-2.5 h-2.5 rounded-full bg-[#F43F5E]"></span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Photos & Location (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          
          {/* Photos Drop Well */}
          <div className="glass-card rounded-2xl p-5 border border-indigo-100/70">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4648d4] text-xl">center_focus_strong</span>
                <h2 className="text-sm font-bold text-[#1a1b25]">Photos & AI Scan</h2>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">auto_awesome</span> Smart-Match V2.4
              </span>
            </div>

            <div className="relative group rounded-xl bg-indigo-50/40 border-2 border-dashed border-indigo-200/80 p-5 text-center cursor-pointer hover:bg-indigo-50/70 transition-colors">
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-indigo-500/15 to-violet-500/15 text-[#4648d4] flex items-center justify-center">
                  <span className="material-symbols-outlined text-2xl">add_a_photo</span>
                </div>
                <p className="text-xs font-semibold text-[#1a1b25] mt-1">
                  Photos attached from gallery
                </p>
                <p className="text-[11px] text-slate-400 max-w-xs">
                  Front, serial label, and distinctive markings.
                </p>
              </div>
            </div>

            {/* Preview Thumbnails */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="relative aspect-square rounded-xl overflow-hidden shadow-xs border border-indigo-100">
                <img src={photos[0]} alt="Angle 1" className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-emerald-500/90 text-white text-[9px] font-bold">Front</span>
              </div>
              <div className="relative aspect-square rounded-xl overflow-hidden shadow-xs border border-indigo-100">
                <img src={photos[1]} alt="Angle 2" className="w-full h-full object-cover" />
                <span className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-indigo-600/90 text-white text-[9px] font-bold">Serial</span>
              </div>
              <div className="aspect-square rounded-xl bg-indigo-50/30 border border-dashed border-indigo-200 flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-xl">add</span>
                <span className="text-[10px]">Context</span>
              </div>
            </div>

            {/* AI Auto-Tag Analysis Box */}
            <div className="mt-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex items-start gap-2.5">
              <span className="material-symbols-outlined text-[#4648d4] text-lg shrink-0 mt-0.5">psychology</span>
              <div className="text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1a1b25]">Campus AI Autodetect</span>
                  <span className="text-[10px] text-[#4648d4] font-bold">98.4% Confidence</span>
                </div>
                <p className="text-[11px] text-[#464554] mt-0.5">
                  Recognized: <strong>{title || 'Apple AirPods Pro (2nd Gen)'}</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Discovery Location Card */}
          <div className="glass-card rounded-2xl p-5 border border-indigo-100/70">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#4648d4] text-xl">map</span>
                <h2 className="text-sm font-bold text-[#1a1b25]">Discovery Location</h2>
              </div>
              <span className="text-[11px] text-[#4648d4] font-semibold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-xs">my_location</span> Geofenced
              </span>
            </div>

            {/* Building Quick Selector */}
            <label className="block text-xs font-semibold text-[#464554] mb-1.5">
              Select Campus Building
            </label>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {CAMPUS_BUILDINGS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBuilding(b.name)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    building === b.name
                      ? 'btn-gradient-indigo text-white shadow-xs'
                      : 'bg-indigo-50/60 hover:bg-indigo-100 text-[#464554] border border-indigo-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">{b.icon}</span>
                  <span>{b.name}</span>
                </button>
              ))}
            </div>

            {/* Floor / Room Specification */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#464554]">
                Specific Room / Carrel / Desk
              </label>
              <input
                type="text"
                value={floorRoom}
                onChange={(e) => setFloorRoom(e.target.value)}
                placeholder="e.g. 3rd Floor Carrel #42 (Near window)"
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Specifications, Custody & Verification Challenge (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          
          {/* Classification & Title */}
          <div className="glass-card rounded-2xl p-5 border border-indigo-100/70">
            <h2 className="text-sm font-bold text-[#1a1b25] mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#4648d4] text-xl">category</span>
              <span>Item Classification & Description</span>
            </h2>

            {/* Category Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {ITEM_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer ${
                    category === cat.id
                      ? 'bg-gradient-to-br from-[#4648d4] to-[#6b38d4] text-white shadow-md shadow-indigo-500/20'
                      : 'bg-indigo-50/40 hover:bg-indigo-50 text-[#464554] border border-indigo-100'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl mb-0.5">{cat.icon}</span>
                  <span className="text-[11px] font-bold">{cat.id}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#464554] mb-1">
                  Item Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Apple AirPods Pro (2nd Generation) in Blue Case"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-100 text-xs font-medium text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#464554] mb-1">
                  Public Description (Do NOT include secret answers or private serials)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Describe general appearance, visible stickers, where it was spotted..."
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none"
                ></textarea>
              </div>

              {itemType === 'lost' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-[#464554] mb-1">
                      Optional Student Bounty / Reward
                    </label>
                    <input
                      type="text"
                      value={reward}
                      onChange={(e) => setReward(e.target.value)}
                      placeholder="e.g. $50 Reward Offered"
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="urgentCheck"
                      checked={isUrgent}
                      onChange={(e) => setIsUrgent(e.target.checked)}
                      className="w-4 h-4 text-rose-600 rounded accent-rose-600"
                    />
                    <label htmlFor="urgentCheck" className="text-xs font-bold text-rose-600 cursor-pointer">
                      Mark as Urgent Campus Broadcast
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Physical Custody Protocol */}
          {itemType === 'found' && (
            <div className="glass-card rounded-2xl p-5 border border-indigo-100/70">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#6b38d4] text-xl">shield_person</span>
                  <h2 className="text-sm font-bold text-[#1a1b25]">Physical Custody Protocol</h2>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-200">
                  Quad Safety Standard
                </span>
              </div>
              <p className="text-xs text-[#464554] mb-3">
                Choose where the physical item is held while the owner is verified.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Option A */}
                <label 
                  onClick={() => setCustodyType('official_desk')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    custodyType === 'official_desk'
                      ? 'bg-indigo-50/70 border-[#4648d4] shadow-xs'
                      : 'bg-white border-indigo-100 hover:bg-indigo-50/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1a1b25] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[#4648d4] text-base">desk</span>
                        Official Desk Drop
                      </span>
                      <input
                        type="radio"
                        name="custody"
                        checked={custodyType === 'official_desk'}
                        onChange={() => setCustodyType('official_desk')}
                        className="accent-[#4648d4]"
                      />
                    </div>
                    <p className="text-[11px] text-[#464554] mt-1.5">
                      Handed to staff at a verified campus lost & found desk counter.
                    </p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-indigo-100 text-[11px] font-semibold text-[#4648d4]">
                    {custodyDeskName}
                  </div>
                </label>

                {/* Option B */}
                <label 
                  onClick={() => setCustodyType('self_custody')}
                  className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                    custodyType === 'self_custody'
                      ? 'bg-indigo-50/70 border-[#4648d4] shadow-xs'
                      : 'bg-white border-indigo-100 hover:bg-indigo-50/40'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#1a1b25] flex items-center gap-1">
                        <span className="material-symbols-outlined text-slate-500 text-base">lock</span>
                        In My Safe Care
                      </span>
                      <input
                        type="radio"
                        name="custody"
                        checked={custodyType === 'self_custody'}
                        onChange={() => setCustodyType('self_custody')}
                        className="accent-[#4648d4]"
                      />
                    </div>
                    <p className="text-[11px] text-[#464554] mt-1.5">
                      You retain possession and only hand it over at a marked CCTV Safe Zone upon admin approval.
                    </p>
                  </div>
                  <div className="mt-2 pt-1 border-t border-indigo-100 text-[11px] font-semibold text-slate-600">
                    Safe Meeting Zone Handover
                  </div>
                </label>

              </div>
            </div>
          )}

          {/* Proof-of-Ownership Challenge (Feature 2 Core) */}
          {itemType === 'found' && (
            <div className="glass-card rounded-2xl p-5 border border-indigo-100/70">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-purple-600 text-xl">encrypted</span>
                  <h2 className="text-sm font-bold text-[#1a1b25]">Proof-of-Ownership Challenge</h2>
                </div>
                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-bold uppercase tracking-wider">
                  Confidential
                </span>
              </div>
              <p className="text-xs text-[#464554] mb-3">
                Claimants must correctly answer these questions before obtaining handover instructions. Secret answers are matched server-side and never displayed publicly.
              </p>

              {/* Challenge 1 */}
              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#1a1b25] flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-[#4648d4] text-white text-[10px] font-bold flex items-center justify-center">1</span>
                    Verification Question (Shown to Claimant)
                  </span>
                </div>
                <input
                  type="text"
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none mb-2"
                />

                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#6b38d4] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">key</span>
                    Expected Secret Answer (Encrypted, Hidden from Public)
                  </span>
                </div>
                <input
                  type="text"
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs text-purple-900 font-semibold focus:outline-none"
                />
              </div>

              {/* Challenge 2 */}
              <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-[#1a1b25] flex items-center gap-1">
                    <span className="w-4 h-4 rounded-full bg-slate-400 text-white text-[10px] font-bold flex items-center justify-center">2</span>
                    Secondary Question (Optional)
                  </span>
                </div>
                <input
                  type="text"
                  value={q2}
                  onChange={(e) => setQ2(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-indigo-100 text-xs text-[#1a1b25] focus:outline-none mb-2"
                />
                <input
                  type="text"
                  value={a2}
                  onChange={(e) => setA2(e.target.value)}
                  placeholder="Expected secret answer 2"
                  className="w-full px-3 py-1.5 rounded-lg bg-white border border-purple-200 text-xs text-purple-900 font-semibold focus:outline-none"
                />
              </div>

              {/* Intake Serial */}
              <div>
                <label className="block text-xs font-semibold text-[#464554] mb-1">
                  Private Intake Serial / ID Number (Optional, for auto-match)
                </label>
                <input
                  type="text"
                  value={intakeSerial}
                  onChange={(e) => setIntakeSerial(e.target.value)}
                  placeholder="e.g. H9CGV42K01 or Student ID"
                  className="w-full px-3 py-1.5 rounded-xl bg-white border border-indigo-100 text-xs font-mono text-[#1a1b25] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  Encrypted with AES-256; checked when claimant enters a serial number.
                </span>
              </div>
            </div>
          )}

          {/* Action Dock */}
          <div className="glass-panel p-3 sm:p-4 rounded-full border border-indigo-200 flex items-center justify-between gap-3 shadow-lg shadow-indigo-500/10">
            <div className="flex items-center gap-2 pl-2">
              <span className="material-symbols-outlined text-[#4648d4] text-xl">satellite_alt</span>
              <div className="text-xs">
                <span className="font-bold text-[#1a1b25] block">Live Campus Matching Active</span>
                <span className="text-[10px] text-slate-400">Push notification sent to Cabot desk & feeds</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {feedback && (
                <span className="text-xs font-bold text-[#4648d4] px-2">{feedback}</span>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-full btn-gradient-indigo text-white text-xs font-bold active:scale-[0.98] transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm">
                  {submitting ? 'sync' : 'broadcast_on_personal'}
                </span>
                <span>{itemType === 'found' ? 'Publish Campus Alert' : 'Broadcast Lost Report'}</span>
              </button>
            </div>
          </div>

        </div>

      </form>

    </div>
  );
}
