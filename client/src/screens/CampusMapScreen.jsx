import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const CAMPUS_ZONES = [
  {
    id: 'zone-cabot',
    name: 'Cabot Science Library',
    area: 'Central Science Quad',
    x: 35,
    y: 25,
    isSafeZone: true,
    desk: 'Cabot Circulation Desk (Staff #L-89)',
    hours: '8:00 AM – 11:00 PM'
  },
  {
    id: 'zone-widener',
    name: 'Widener Library',
    area: 'Harvard Yard South',
    x: 65,
    y: 55,
    isSafeZone: true,
    desk: 'Widener Front Desk',
    hours: '9:00 AM – 10:00 PM'
  },
  {
    id: 'zone-union',
    name: 'Student Union Hub',
    area: 'Campus Center & Cafe',
    x: 48,
    y: 65,
    isSafeZone: true,
    desk: 'Student Union Info Hub',
    hours: '8:00 AM – Midnight'
  },
  {
    id: 'zone-annenberg',
    name: 'Annenberg Hall',
    area: 'Memorial Hall North',
    x: 75,
    y: 30,
    isSafeZone: false,
    desk: 'Dining Commons Desk',
    hours: '7:30 AM – 8:00 PM'
  },
  {
    id: 'zone-malkin',
    name: 'Malkin Athletic Center',
    area: 'Athletics & Rec Field',
    x: 25,
    y: 75,
    isSafeZone: true,
    desk: 'Equipment Desk 2',
    hours: '6:00 AM – 11:00 PM'
  },
  {
    id: 'zone-police',
    name: 'Campus Police Annex',
    area: 'Main Gate 24/7 Checkpoint',
    x: 18,
    y: 45,
    isSafeZone: true,
    desk: '24/7 Dispatch Desk',
    hours: '24/7 CCTV Monitored'
  }
];

export default function CampusMapScreen({ onSelectItem }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedZone, setSelectedZone] = useState(CAMPUS_ZONES[0]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'found', 'lost'

  useEffect(() => {
    async function loadItems() {
      try {
        const res = await fetch('/api/items');
        if (res.ok) {
          const data = await res.json();
          setItems(data.items);
        }
      } catch (e) {
        console.error('Failed to load items for map', e);
      }
    }
    loadItems();
  }, []);

  // Filter items in current selected building/zone
  const zoneItems = items.filter(it => {
    const matchesZone = it.coarse_location?.toLowerCase().includes(selectedZone.name.toLowerCase()) ||
                        selectedZone.name.toLowerCase().includes(it.coarse_location?.toLowerCase());
    if (!matchesZone) return false;
    if (filterType === 'all') return true;
    return it.type === filterType;
  });

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      
      {/* Map Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a1b25]">
              Campus Geofenced Radar Map
            </h1>
          </div>
          <p className="text-xs text-[#464554] mt-0.5">
            Browse clustered lost & found reports across university quads. Exact GPS is hidden for privacy until admin verification approval.
          </p>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-full glass-panel border border-indigo-100">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'all' ? 'btn-gradient-indigo text-white shadow-xs' : 'text-[#464554] hover:bg-indigo-50'
            }`}
          >
            All Pins
          </button>
          <button
            onClick={() => setFilterType('found')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'found' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#464554] hover:bg-emerald-50'
            }`}
          >
            Found
          </button>
          <button
            onClick={() => setFilterType('lost')}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              filterType === 'lost' ? 'bg-[#F43F5E] text-white shadow-xs' : 'text-[#464554] hover:bg-rose-50'
            }`}
          >
            Lost
          </button>
        </div>
      </div>

      {/* Main Map Layout: 8 Cols Interactive Canvas + 4 Cols Zone Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Interactive Campus Map Canvas (8 Cols) */}
        <div className="lg:col-span-8 glass-card rounded-3xl p-4 sm:p-5 border border-indigo-200/80 shadow-xl overflow-hidden flex flex-col gap-3">
          
          <div className="flex items-center justify-between text-xs text-[#464554]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#4648d4] text-base">domain</span>
              <span className="font-bold text-[#1a1b25]">Harvard Yard & Campus Quadrangles</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#4648d4] font-semibold border border-indigo-200/60">
              Campus Geofence Restricted (Lat: 42.37, Lng: -71.11)
            </span>
          </div>

          {/* Stylized Interactive Campus Grid Vector */}
          <div className="relative w-full h-[380px] sm:h-[460px] rounded-2xl bg-gradient-to-br from-[#eeecfc] via-[#fbf8ff] to-[#e8e7f6] border border-indigo-200/60 overflow-hidden shadow-inner select-none">
            
            {/* Campus walkways & grid texture */}
            <div className="absolute inset-0 opacity-30 bg-[radial-gradient(#4648d4_1.5px,transparent_1.5px)] [background-size:24px_24px]"></div>
            
            {/* Campus Pathways (SVG paths) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40">
              <line x1="20%" y1="45%" x2="35%" y2="25%" stroke="#6366f1" strokeWidth="3" strokeDasharray="4 4" />
              <line x1="35%" y1="25%" x2="75%" y2="30%" stroke="#6366f1" strokeWidth="3" strokeDasharray="4 4" />
              <line x1="35%" y1="25%" x2="48%" y2="65%" stroke="#6366f1" strokeWidth="4" />
              <line x1="48%" y1="65%" x2="65%" y2="55%" stroke="#6366f1" strokeWidth="4" />
              <line x1="48%" y1="65%" x2="25%" y2="75%" stroke="#6366f1" strokeWidth="3" strokeDasharray="4 4" />
              <line x1="65%" y1="55%" x2="75%" y2="30%" stroke="#6366f1" strokeWidth="4" />
            </svg>

            {/* Campus Lawn Polygons */}
            <div className="absolute top-1/4 left-1/3 w-32 h-24 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 -rotate-6 flex items-center justify-center text-[10px] font-bold text-emerald-800">
              Main Quad Lawn
            </div>
            <div className="absolute bottom-1/4 right-1/4 w-36 h-28 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 rotate-3 flex items-center justify-center text-[10px] font-bold text-indigo-800">
              Harvard Yard Core
            </div>

            {/* Interactive Campus Zone Markers */}
            {CAMPUS_ZONES.map((zone) => {
              const isSelected = selectedZone.id === zone.id;
              const count = items.filter(it => 
                it.coarse_location?.toLowerCase().includes(zone.name.toLowerCase()) ||
                zone.name.toLowerCase().includes(it.coarse_location?.toLowerCase())
              ).length;

              return (
                <div
                  key={zone.id}
                  style={{ top: `${zone.y}%`, left: `${zone.x}%` }}
                  onClick={() => setSelectedZone(zone)}
                  className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 flex flex-col items-center"
                >
                  {/* Pin Circle */}
                  <div className={`relative flex items-center justify-center transition-all ${
                    isSelected ? 'scale-125' : 'group-hover:scale-110'
                  }`}>
                    {isSelected && (
                      <span className="absolute w-12 h-12 rounded-full bg-[#4648d4]/30 animate-ping"></span>
                    )}

                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white ${
                      zone.isSafeZone
                        ? isSelected ? 'bg-[#4648d4]' : 'bg-emerald-600'
                        : 'bg-indigo-500'
                    }`}>
                      <span className="material-symbols-outlined text-base">
                        {zone.isSafeZone ? 'shield' : 'domain'}
                      </span>
                    </div>

                    {count > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#F43F5E] text-white text-[10px] font-bold flex items-center justify-center border border-white">
                        {count}
                      </span>
                    )}
                  </div>

                  {/* Pin Label */}
                  <div className={`mt-1 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-md text-[11px] font-bold whitespace-nowrap transition-all border ${
                    isSelected
                      ? 'bg-[#1a1b25] text-white border-transparent'
                      : 'bg-white/95 text-[#1a1b25] border-indigo-100 group-hover:border-[#4648d4]'
                  }`}>
                    {zone.name}
                  </div>
                </div>
              );
            })}

            {/* Approved Handover Live Beacon Overlay (Feature 3 Core Requirement) */}
            <div className="absolute top-4 left-4 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-500/40 shadow-lg max-w-xs z-30">
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs mb-1">
                <span className="material-symbols-outlined text-base">verified_user</span>
                <span>Active Safe Handover Point</span>
              </div>
              <p className="text-[11px] text-[#464554] leading-relaxed">
                <strong>Cabot Science Library Desk</strong> is currently active for verified dual-signature pickup.
              </p>
            </div>

            {/* Legend */}
            <div className="absolute bottom-3 right-3 p-2.5 rounded-xl bg-white/90 backdrop-blur-md border border-indigo-100 shadow-sm flex flex-col gap-1 text-[10px] text-[#464554] z-30">
              <div className="flex items-center gap-1.5 font-bold text-[#1a1b25]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Safe CCTV Checkpoint</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4648d4]"></span>
                <span>Selected Quad Node</span>
              </div>
            </div>

          </div>
        </div>

        {/* Zone Detail Drawer (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          
          {/* Selected Building Details */}
          <div className="glass-card rounded-3xl p-5 border border-indigo-200/80 shadow-lg flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#4648d4] block">
                  {selectedZone.area}
                </span>
                <h3 className="text-base font-bold text-[#1a1b25] mt-0.5">
                  {selectedZone.name}
                </h3>
              </div>
              {selectedZone.isSafeZone && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">videocam</span> Monitored
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 flex flex-col gap-1.5 text-xs text-[#464554]">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1a1b25]">Central Desk:</span>
                <span>{selectedZone.desk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#1a1b25]">Hours:</span>
                <span>{selectedZone.hours}</span>
              </div>
            </div>

            {/* Walking Directions Box */}
            <div className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/70 text-xs">
              <div className="font-bold text-emerald-800 flex items-center gap-1 mb-1">
                <span className="material-symbols-outlined text-sm">directions_walk</span>
                <span>Campus Navigation Directions</span>
              </div>
              <p className="text-[#464554] text-[11px] leading-relaxed">
                Enter via Main Quadway arches. Lost & Found custody lockbox is stationed at Circulation Counter B.
              </p>
            </div>
          </div>

          {/* Items In This Quad Zone */}
          <div className="glass-card rounded-3xl p-5 border border-indigo-200/80 shadow-lg flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1b25]">
                Items at this location ({zoneItems.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-medium">Coarse view</span>
            </div>

            {zoneItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No active reports in this specific quadrant.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto no-scrollbar">
                {zoneItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className="p-3 rounded-2xl bg-white/80 hover:bg-white border border-indigo-100 flex items-center justify-between gap-3 cursor-pointer transition-all hover:border-[#4648d4] shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.photos && item.photos[0] ? (
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-indigo-100 shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4648d4] shrink-0">
                          <span className="material-symbols-outlined text-lg">devices</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-[#1a1b25] truncate">
                          {item.title}
                        </h5>
                        <p className="text-[10px] text-[#464554] truncate">
                          {item.floor_room || 'General Zone'}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      item.type === 'found'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-[#F43F5E]'
                    }`}>
                      {item.type.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
}
