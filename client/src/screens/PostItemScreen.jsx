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

  // Dynamic Verification Challenges (Unlimited questions for found items)
  const [securityQuestions, setSecurityQuestions] = useState([
    { question: '', answer: '' }
  ]);
  const [intakeSerial, setIntakeSerial] = useState('');

  const handleAddQuestion = (presetQuestion = '') => {
    setSecurityQuestions(prev => [...prev, { question: presetQuestion, answer: '' }]);
  };

  const handleRemoveQuestion = (indexToRemove) => {
    setSecurityQuestions(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const handleUpdateQuestion = (idx, field, value) => {
    setSecurityQuestions(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  // Attached item photos
  const [photos, setPhotos] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Global Escape key navigation
  React.useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

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
      const validQuestions = securityQuestions.filter(sq => sq.question.trim() && sq.answer.trim());

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
        verification_questions: itemType === 'found' ? validQuestions.map(sq => sq.question.trim()) : [],
        secret_answers: itemType === 'found' ? validQuestions.map(sq => sq.answer.trim()) : [],
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
      
      {/* Top Header with Prominent Go Back Navigation */}
      <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
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
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-semibold cursor-pointer transition-all shadow-xs shrink-0"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>← Back to Live Feed</span>
          </button>
        )}
      </div>

      {/* Main Mode Toggle */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          onClick={() => setItemType('found')}
          className={`p-4 rounded-2xl flex items-center gap-3 text-left transition-colors border cursor-pointer ${
            itemType === 'found'
              ? 'bg-emerald-50 border-emerald-500 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            itemType === 'found' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-lg">back_hand</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">I Found an Item</div>
            <div className="text-xs text-slate-500">I want to return it safely</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setItemType('lost')}
          className={`p-4 rounded-2xl flex items-center gap-3 text-left transition-colors border cursor-pointer ${
            itemType === 'lost'
              ? 'bg-rose-50 border-rose-500 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            itemType === 'lost' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
          }`}>
            <span className="material-symbols-outlined text-lg">travel_explore</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900">I Lost an Item</div>
            <div className="text-xs text-slate-500">Ask campus for recovery help</div>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        
        {/* SECTION 1: Item Details */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
              1
            </span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              What is the item?
            </h2>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Item Name *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === 'found' ? "e.g. Blue Hydro Flask, Apple AirPods Pro, Student ID Card" : "e.g. Matte Black MacBook Air M2, Brown Leather Wallet"}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Category Chips */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
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
                    className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer border ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>

            {category === 'Other' && (
              <div className="mt-2.5">
                <input
                  type="text"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="Specify item category (e.g. Umbrella, Calculator, Jewelry...)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe color, brand, condition, or any distinctive marks..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none leading-relaxed"
            />
          </div>

          {/* Lost Item Specifics: Bounty Reward & Urgent */}
          {itemType === 'lost' && (
            <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-amber-500 text-sm">monetization_on</span>
                    <span>Offer Finder Bounty / Reward (Optional)</span>
                  </label>
                  <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    Boosts return rate by 4x
                  </span>
                </div>
                
                {/* Bounty preset chips */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {['$15', '$25', '$50', '$100'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setReward(reward === preset ? '' : preset)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                        reward === preset
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      🎯 {preset}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setReward('☕ Free Coffee & Treat')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                      reward === '☕ Free Coffee & Treat'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    ☕ Coffee Treat
                  </button>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    placeholder="Custom bounty amount or dining perk (e.g. $30, Dinner, Gift Card)"
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bounties are awarded to the honest finder upon successful dual-confirmed handover at the desk.
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="urgentCheck"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded accent-rose-600 cursor-pointer"
                />
                <label htmlFor="urgentCheck" className="text-xs font-semibold text-rose-700 cursor-pointer flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">priority_high</span>
                  <span>Mark as Urgent (Critical Keys, Exam Notes, Prescriptions)</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Location & Photos */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
              2
            </span>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              {itemType === 'found' ? 'Where did you find it?' : 'Where did you lose it?'}
            </h2>
          </div>

          {/* Campus Building Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-2">
              Campus Location *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CAMPUS_BUILDINGS.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setBuilding(b.name)}
                  className={`p-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer border ${
                    building === b.name
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">{b.icon}</span>
                  <span className="truncate">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Specific Room / Area */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Specific Room or Spot (Optional)
            </label>
            <input
              type="text"
              value={floorRoom}
              onChange={(e) => setFloorRoom(e.target.value)}
              placeholder="e.g. 3rd Floor Carrel #42, Booth near cafe, Lounge"
              className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Photos Upload */}
          <div className="pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
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
              className={`rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'bg-indigo-50 border-indigo-500'
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
              }`}
            >
              <div className="flex flex-col items-center justify-center gap-1">
                <span className="material-symbols-outlined text-2xl text-slate-400">
                  {uploadingFiles ? 'sync' : 'add_a_photo'}
                </span>
                <p className="text-xs font-semibold text-slate-700">
                  {uploadingFiles ? 'Uploading photo...' : 'Click to upload or drag photos here'}
                </p>
                <p className="text-[11px] text-slate-400">
                  PNG or JPG image
                </p>
              </div>
            </div>

            {/* Photo Previews */}
            {photos.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 group">
                    <img src={url} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/70 hover:bg-rose-600 text-white flex items-center justify-center transition-colors"
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
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                3
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-slate-900">
                Safekeeping & Verification
              </h2>
            </div>

            {/* Current Item Location Option */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Where is the item right now?
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setCustodyType('official_desk')}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                    custodyType === 'official_desk'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">desk</span>
                  <div>
                    <div className="text-xs font-semibold">Campus Front Desk</div>
                    <div className={`text-[11px] mt-0.5 ${custodyType === 'official_desk' ? 'text-slate-300' : 'text-slate-500'}`}>
                      e.g. Cabot Circulation Desk
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setCustodyType('self_custody')}
                  className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-start gap-3 ${
                    custodyType === 'self_custody'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">lock</span>
                  <div>
                    <div className="text-xs font-semibold">With Reporter</div>
                    <div className={`text-[11px] mt-0.5 ${custodyType === 'self_custody' ? 'text-slate-300' : 'text-slate-500'}`}>
                      I will hand it over once verified
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Secret Verification Challenges Builder (Unlimited Questions) */}
            <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/40 border border-indigo-200/80 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-900">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
                    <span className="material-symbols-outlined text-base">shield_lock</span>
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                      Security Check Questions ({securityQuestions.length})
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Add as many secret questions as you like. Only the rightful owner who matches your answers can claim this item.
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                  Anti-Theft Active
                </span>
              </div>

              {/* Quick Preset Suggestion Chips */}
              <div>
                <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                  Quick Suggestion Ideas:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    'Custom Bluetooth broadcast name',
                    'Lock screen photo / wallpaper detail',
                    'Initials, engravings, or case markings',
                    'Stickers or keychain attached',
                    'Exact items inside bag / wallet'
                  ].map((presetText) => (
                    <button
                      key={presetText}
                      type="button"
                      onClick={() => handleAddQuestion(presetText)}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
                    >
                      <span className="material-symbols-outlined text-xs">add</span>
                      <span>{presetText}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* List of Dynamic Security Questions */}
              <div className="flex flex-col gap-3">
                {securityQuestions.map((sq, idx) => (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-xl bg-white border border-indigo-100 shadow-2xs flex flex-col gap-2.5 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span>Security Check Question #{idx + 1}</span>
                      </span>

                      {securityQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(idx)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove this security question"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Question (Shown to claimant) *
                      </label>
                      <input
                        type="text"
                        value={sq.question}
                        onChange={(e) => handleUpdateQuestion(idx, 'question', e.target.value)}
                        placeholder="e.g. What specific custom name or engraving is on this item?"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-indigo-700 mb-1">
                        Secret Answer (Evaluated securely on server — never revealed) *
                      </label>
                      <input
                        type="text"
                        value={sq.answer}
                        onChange={(e) => handleUpdateQuestion(idx, 'answer', e.target.value)}
                        placeholder="e.g. Red lanyard with initials MK"
                        className="w-full px-3 py-2 rounded-xl bg-indigo-50/40 border border-indigo-200 text-xs text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Question Action */}
              <button
                type="button"
                onClick={() => handleAddQuestion('')}
                className="w-full py-2.5 rounded-xl bg-white hover:bg-slate-50 text-indigo-700 border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm font-bold">add_circle</span>
                <span>+ Add Another Security Question</span>
              </button>
            </div>
          </div>
        )}

        {/* Submit Bar */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
          <div>
            {feedback && (
              <span className="text-xs font-semibold text-indigo-600">{feedback}</span>
            )}
            {!feedback && (
              <span className="text-xs text-slate-500">
                {itemType === 'found' ? 'Your report will be posted immediately to the live feed.' : 'Classmates will be alerted to help find your item.'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 sm:flex-initial px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {submitting ? 'sync' : 'send'}
              </span>
              <span>{itemType === 'found' ? 'Publish Found Report' : 'Publish Lost Report'}</span>
            </button>
          </div>
        </div>

      </form>

    </div>
  );
}
