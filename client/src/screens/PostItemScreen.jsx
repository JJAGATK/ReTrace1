import React, { useState, useRef } from 'react';
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
  { id: 'Tech & Audio', label: 'Tech & Audio', icon: 'headphones' },
  { id: 'Campus IDs', label: 'IDs & Cards', icon: 'badge' },
  { id: 'Bags & Wallets', label: 'Bags & Wallets', icon: 'backpack' },
  { id: 'Keys & Dorm', label: 'Keys & Dorm', icon: 'key' },
  { id: 'Apparel', label: 'Apparel / Clothes', icon: 'apparel' },
  { id: 'Bottles & Mugs', label: 'Bottles & Mugs', icon: 'water_bottle' },
  { id: 'Books & Notes', label: 'Books & Notes', icon: 'menu_book' },
  { id: 'Eyewear', label: 'Glasses / Eyewear', icon: 'visibility' },
  { id: 'Other', label: 'Other Items', icon: 'category' },
];

export default function PostItemScreen({ onPostCreated, onCancel }) {
  const { user, token } = useAuth();
  const fileInputRef = useRef(null);

  const [itemType, setItemType] = useState('found'); // 'found' or 'lost'
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tech & Audio');
  const [customCategory, setCustomCategory] = useState('');
  const [building, setBuilding] = useState('Cabot Science Library');
  const [floorRoom, setFloorRoom] = useState('');
  const [description, setDescription] = useState('');
  const [custodyType, setCustodyType] = useState('official_desk');
  const [custodyDeskName, setCustodyDeskName] = useState('Cabot Circulation Desk');
  const [reward, setReward] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Verification challenge (Found only)
  const [q1, setQ1] = useState('');
  const [a1, setA1] = useState('');
  const [intakeSerial, setIntakeSerial] = useState('');

  // Attached item photos
  const [photos, setPhotos] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleFileSelect = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadingFiles(true);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('photos', file));

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        const uploadedUrls = data.urls || (data.url ? [data.url] : []);
        if (uploadedUrls.length > 0) {
          setPhotos(prev => [...prev, ...uploadedUrls]);
        }
      } else {
        // Fallback to Data URLs
        const dataUrlPromises = files.map(file => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target.result);
            reader.readAsDataURL(file);
          });
        });
        const dataUrls = await Promise.all(dataUrlPromises);
        setPhotos(prev => [...prev, ...dataUrls]);
      }
    } catch (err) {
      console.error('Upload error fallback to data URL', err);
      const dataUrlPromises = files.map(file => {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.readAsDataURL(file);
        });
      });
      const dataUrls = await Promise.all(dataUrlPromises);
      setPhotos(prev => [...prev, ...dataUrls]);
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPhotos(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!title.trim()) {
      setFeedback('Please provide an item name.');
      return;
    }

    setSubmitting(true);
    setFeedback('Posting item...');

    try {
      let activeToken = token;
      if (!activeToken) {
        try {
          const authRes = await fetch('/api/auth/login-demo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ personaId: 'user-maya' })
          });
          if (authRes.ok) {
            const authData = await authRes.json();
            activeToken = authData.token;
          }
        } catch (e) {}
      }

      const bObj = CAMPUS_BUILDINGS.find(b => b.name === building) || CAMPUS_BUILDINGS[0];
      const finalCategory = (category === 'Other' && customCategory.trim()) ? customCategory.trim() : category;

      const payload = {
        type: itemType,
        title: title.trim(),
        category: finalCategory,
        description: description.trim(),
        coarse_location: building,
        floor_room: floorRoom.trim(),
        latitude: bObj.lat,
        longitude: bObj.lng,
        exact_location_notes: `${building}, ${floorRoom}`.trim(),
        custody_type: custodyType,
        custody_desk_name: custodyType === 'official_desk' ? custodyDeskName : 'Safe Self-Custody with Finder',
        photos,
        reward_offered: itemType === 'lost' && reward.trim() ? reward.trim() : null,
        is_urgent: isUrgent,
        verification_questions: itemType === 'found' && q1.trim() ? [q1.trim()] : [],
        secret_answers: itemType === 'found' && a1.trim() ? [a1.trim()] : [],
        intake_serial: itemType === 'found' && intakeSerial.trim() ? intakeSerial.trim() : null
      };

      const res = await fetch('/api/items', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setFeedback('✓ Successfully posted!');
        setTimeout(() => {
          onPostCreated();
        }, 900);
      } else {
        const err = await res.json().catch(() => ({}));
        setFeedback(err.error || 'Failed to submit post.');
        setSubmitting(false);
      }
    } catch (err) {
      setFeedback('Network error. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-[860px] mx-auto px-4 sm:px-6 py-6 pb-28 text-[#1a1b25]">
      
      {/* Top Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
            Post Lost or Found Item
          </h1>
          <p className="text-xs sm:text-sm text-[#464554] mt-0.5">
            Quickly share what you found or report something you lost to get it back.
          </p>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-[#1a1b25] text-xs font-semibold cursor-pointer transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Main Mode Toggle */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setItemType('found')}
          className={`p-4 rounded-2xl flex items-center gap-3 text-left transition-all border-2 cursor-pointer ${
            itemType === 'found'
              ? 'bg-emerald-50/80 border-emerald-500 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            itemType === 'found' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-xl">back_hand</span>
          </div>
          <div>
            <div className="text-sm font-bold text-[#1a1b25]">I Found an Item</div>
            <div className="text-xs text-slate-500">I want to return it to the owner</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setItemType('lost')}
          className={`p-4 rounded-2xl flex items-center gap-3 text-left transition-all border-2 cursor-pointer ${
            itemType === 'lost'
              ? 'bg-rose-50/80 border-[#F43F5E] shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            itemType === 'lost' ? 'bg-[#F43F5E] text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-xl">travel_explore</span>
          </div>
          <div>
            <div className="text-sm font-bold text-[#1a1b25]">I Lost an Item</div>
            <div className="text-xs text-slate-500">Ask campus classmates for help</div>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        
        {/* SECTION 1: Item Details */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 border border-indigo-100 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-indigo-100/70 pb-3">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-[#4648d4] text-xs font-bold flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm sm:text-base font-bold text-[#1a1b25]">
              What is the item?
            </h2>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-[#1a1b25] mb-1.5">
              Item Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === 'found' ? "e.g. Blue Hydro Flask, Apple AirPods Pro, Student ID Card" : "e.g. Matte Black MacBook Air M2, Brown Leather Wallet"}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-indigo-200/80 text-sm text-[#1a1b25] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-bold text-[#1a1b25] mb-2">
              Category *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ITEM_CATEGORIES.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                      isSelected
                        ? 'btn-gradient-indigo text-white border-transparent shadow-sm'
                        : 'bg-indigo-50/40 hover:bg-indigo-50 text-[#464554] border-indigo-100/80'
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {category === 'Other' && (
              <div className="mt-3">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Specify item category (e.g. Umbrella, Calculator, Jewelry...)"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-[#1a1b25] mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe color, brand, condition, or any distinctive marks..."
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-indigo-200/80 text-xs sm:text-sm text-[#1a1b25] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4648d4] resize-none leading-relaxed"
            />
          </div>

          {/* Lost Item Specifics: Reward & Urgent */}
          {itemType === 'lost' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-indigo-100">
              <div>
                <label className="block text-xs font-bold text-[#1a1b25] mb-1">
                  Optional Reward / Bounty
                </label>
                <input
                  type="text"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  placeholder="e.g. $20 Reward or Free Coffee"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </div>

              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  id="urgentCheck"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded accent-rose-600 cursor-pointer"
                />
                <label htmlFor="urgentCheck" className="text-xs font-bold text-rose-600 cursor-pointer">
                  Mark as Urgent (Need back immediately)
                </label>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Location & Photos */}
        <div className="glass-card rounded-2xl p-5 sm:p-6 border border-indigo-100 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-indigo-100/70 pb-3">
            <span className="w-6 h-6 rounded-full bg-indigo-100 text-[#4648d4] text-xs font-bold flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm sm:text-base font-bold text-[#1a1b25]">
              {itemType === 'found' ? 'Where did you find it?' : 'Where did you lose it?'}
            </h2>
          </div>

          {/* Campus Building Selector */}
          <div>
            <label className="block text-xs font-bold text-[#1a1b25] mb-2">
              Campus Location *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMPUS_BUILDINGS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBuilding(b.name)}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer border ${
                    building === b.name
                      ? 'btn-gradient-indigo text-white border-transparent shadow-sm'
                      : 'bg-indigo-50/40 hover:bg-indigo-50 text-[#464554] border-indigo-100/80'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{b.icon}</span>
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Specific Room / Area */}
          <div>
            <label className="block text-xs font-bold text-[#1a1b25] mb-1.5">
              Specific Room or Spot (Optional)
            </label>
            <input
              type="text"
              value={floorRoom}
              onChange={(e) => setFloorRoom(e.target.value)}
              placeholder="e.g. 3rd Floor Carrel #42, Booth near cafe, Locker Room 102"
              className="w-full px-4 py-2 rounded-xl bg-white border border-indigo-200/80 text-xs sm:text-sm text-[#1a1b25] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
            />
          </div>

          {/* Photos Upload */}
          <div className="pt-2 border-t border-indigo-100">
            <label className="block text-xs font-bold text-[#1a1b25] mb-1.5">
              Photos (Optional)
            </label>

            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files)}
            />

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                handleFileSelect(e.dataTransfer.files);
              }}
              className={`rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'bg-indigo-100/80 border-[#4648d4]'
                  : 'bg-indigo-50/40 border-indigo-200 hover:bg-indigo-50/80'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="material-symbols-outlined text-2xl sm:text-3xl text-[#4648d4]">
                  {uploadingFiles ? 'sync' : 'add_a_photo'}
                </span>
                <p className="text-xs font-bold text-[#1a1b25]">
                  {uploadingFiles ? 'Uploading photo...' : 'Click to upload or drag photos here'}
                </p>
                <p className="text-[11px] text-slate-400">
                  PNG, JPG or JPEG (take a photo with your phone)
                </p>
              </div>
            </div>

            {/* Photo Previews */}
            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-indigo-200 group shadow-xs">
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors shadow-xs"
                      title="Remove"
                    >
                      <span className="material-symbols-outlined text-xs">close</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 3: Custody & Verification (Only for Found items) */}
        {itemType === 'found' && (
          <div className="glass-card rounded-2xl p-5 sm:p-6 border border-indigo-100 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-indigo-100/70 pb-3">
              <span className="w-6 h-6 rounded-full bg-indigo-100 text-[#4648d4] text-xs font-bold flex items-center justify-center">
                3
              </span>
              <h2 className="text-sm sm:text-base font-bold text-[#1a1b25]">
                Where is the item now & Owner Verification
              </h2>
            </div>

            {/* Current Item Location Option */}
            <div>
              <label className="block text-xs font-bold text-[#1a1b25] mb-2">
                Where is the item right now?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCustodyType('official_desk')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                    custodyType === 'official_desk'
                      ? 'bg-indigo-50/80 border-[#4648d4] shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl text-[#4648d4]">desk</span>
                  <div>
                    <div className="text-xs font-bold text-[#1a1b25]">Turned into Campus Front Desk</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">e.g. Cabot Circulation Desk, Library staff</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustodyType('self_custody')}
                  className={`p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer flex items-start gap-3 ${
                    custodyType === 'self_custody'
                      ? 'bg-indigo-50/80 border-[#4648d4] shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl text-emerald-600">lock</span>
                  <div>
                    <div className="text-xs font-bold text-[#1a1b25]">I Have It Safely With Me</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">I will hand it over once verified</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Secret Verification Question */}
            <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex flex-col gap-3">
              <div className="flex items-center gap-1.5 text-[#4648d4]">
                <span className="material-symbols-outlined text-lg">help</span>
                <span className="text-xs font-bold">Secret Verification Question (Recommended)</span>
              </div>
              <p className="text-xs text-[#464554]">
                Ask something only the true owner would know to prove ownership (e.g., lock screen wallpaper, engraved initials, what is inside the bag).
              </p>

              <div>
                <label className="block text-[11px] font-bold text-[#1a1b25] mb-1">
                  Question (Shown to person claiming the item)
                </label>
                <input
                  type="text"
                  value={q1}
                  onChange={(e) => setQ1(e.target.value)}
                  placeholder="e.g. What color is the keychain? Or what is the lockscreen wallpaper?"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-indigo-200 text-xs text-[#1a1b25] focus:outline-none focus:ring-2 focus:ring-[#4648d4]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#6b38d4] mb-1">
                  Secret Answer (Kept private, evaluated automatically)
                </label>
                <input
                  type="text"
                  value={a1}
                  onChange={(e) => setA1(e.target.value)}
                  placeholder="e.g. Red lanyard with initials MK"
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-purple-200 text-xs text-purple-950 font-semibold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                />
              </div>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="glass-card rounded-2xl p-4 border border-indigo-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div>
            {feedback && (
              <span className="text-xs font-bold text-[#4648d4]">{feedback}</span>
            )}
            {!feedback && (
              <span className="text-xs text-slate-500">
                {itemType === 'found' ? 'Your report will be immediately visible on the campus live feed.' : 'Classmates will be notified to help spot your item.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#1a1b25] cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-initial px-6 py-2.5 rounded-full btn-gradient-indigo text-white text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {submitting ? 'sync' : 'send'}
              </span>
              <span>{itemType === 'found' ? 'Post Found Item' : 'Post Lost Item'}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
