import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export const CAMPUS_ZONES = [
  {
    id: 'zone-cabot',
    name: 'Cabot Science Library',
    code: 'CSL-01',
    sector: 'North Quad',
    area: 'Central Science Quad',
    x: 28,
    y: 20,
    isSafeZone: true,
    desk: 'Cabot Circulation Desk (Counter B)',
    hours: '8:00 AM – 11:00 PM',
    cctvCoverage: '99.4%',
    securityStaff: 'Officer Marcus Vance',
    securityStatus: 'Active Safe Vault',
    icon: 'local_library',
    color: '#4648d4',
    description: 'Main STEM science library with dual-signature exchange lockbox and 24/7 front desk verification.'
  },
  {
    id: 'zone-science-plaza',
    name: 'Science Center Plaza',
    code: 'SCP-02',
    sector: 'North Quad',
    area: 'North Campus Hub',
    x: 50,
    y: 16,
    isSafeZone: true,
    desk: 'Plaza Information Kiosk',
    hours: '7:00 AM – 10:00 PM',
    cctvCoverage: '96.8%',
    securityStaff: 'Guard D. Alvarez',
    securityStatus: 'Active Safe Vault',
    icon: 'hub',
    color: '#0891b2',
    description: 'High-traffic open-air plaza and food court connecting Science Center, Cabot, and Memorial Hall.'
  },
  {
    id: 'zone-annenberg',
    name: 'Annenberg Memorial Hall',
    code: 'ANB-03',
    sector: 'North Quad',
    area: 'Memorial Hall North',
    x: 74,
    y: 18,
    isSafeZone: false,
    desk: 'Dining Commons Reception',
    hours: '7:30 AM – 8:30 PM',
    cctvCoverage: '89.2%',
    securityStaff: 'Lead Sarah T.',
    securityStatus: 'Monitored Area',
    icon: 'restaurant',
    color: '#dc2626',
    description: 'First-year dining hall and historic auditorium. Common recovery point for backpacks, coats, and tablets.'
  },
  {
    id: 'zone-police',
    name: 'Campus Police HQ',
    code: 'HUPD-04',
    sector: 'West Gate',
    area: 'Main Gate 24/7 Checkpoint',
    x: 14,
    y: 40,
    isSafeZone: true,
    desk: '24/7 Central Dispatch Desk',
    hours: '24/7 Monitored',
    cctvCoverage: '100%',
    securityStaff: 'Sgt. Miller (Dispatch)',
    securityStatus: 'Maximum Security',
    icon: 'local_police',
    color: '#334155',
    description: 'Central university safety headquarters with secure evidence locker, fingerprint custody logs, and fast escort dispatch.'
  },
  {
    id: 'zone-memchurch',
    name: 'Memorial Church',
    code: 'MEM-05',
    sector: 'Central Yard',
    area: 'North Harvard Yard',
    x: 44,
    y: 40,
    isSafeZone: true,
    desk: 'Chapel Office Reception',
    hours: '8:30 AM – 7:00 PM',
    cctvCoverage: '92.5%',
    securityStaff: 'Staff Coordinator R. Patel',
    securityStatus: 'Active Safe Vault',
    icon: 'church',
    color: '#d97706',
    description: 'Historic landmark at the center of Harvard Yard. Designated peaceful meeting point for low-friction returns.'
  },
  {
    id: 'zone-sever',
    name: 'Sever Hall & Arts Quad',
    code: 'SEV-06',
    sector: 'East Yard',
    area: 'East Harvard Yard',
    x: 74,
    y: 42,
    isSafeZone: false,
    desk: 'Sever Academic Office #104',
    hours: '8:00 AM – 9:00 PM',
    cctvCoverage: '91.0%',
    securityStaff: 'Proctor E. Wright',
    securityStatus: 'Monitored Area',
    icon: 'school',
    color: '#7c3aed',
    description: 'Humanities lecture hall and classroom complex. Frequent sightings of stationery, notebooks, and AirPods.'
  },
  {
    id: 'zone-union',
    name: 'Smith Campus Center',
    code: 'SCC-07',
    sector: 'South Hub',
    area: 'Student Union & Commons',
    x: 26,
    y: 65,
    isSafeZone: true,
    desk: '1st Floor Welcome Desk',
    hours: '7:00 AM – Midnight',
    cctvCoverage: '98.5%',
    securityStaff: 'Campus Monitor J. Diaz',
    securityStatus: 'Active Safe Vault',
    icon: 'apartment',
    color: '#2563eb',
    description: 'Multi-story student union with study pavilions, food venues, and official 24-hour lost and found storage.'
  },
  {
    id: 'zone-widener',
    name: 'Widener Flagship Library',
    code: 'WID-08',
    sector: 'Central Yard',
    area: 'Harvard Yard South',
    x: 58,
    y: 62,
    isSafeZone: true,
    desk: 'Widener Front Portico Desk',
    hours: '9:00 AM – 10:00 PM',
    cctvCoverage: '99.5%',
    securityStaff: 'Guard K. Thorne',
    securityStatus: 'Active Safe Vault',
    icon: 'menu_book',
    color: '#4648d4',
    description: 'Flagship research library with high security perimeter, turnstile check-in, and primary custody intake.'
  },
  {
    id: 'zone-malkin',
    name: 'Malkin Athletic Center',
    code: 'MAC-09',
    sector: 'West Gate',
    area: 'Athletics & Rec Field',
    x: 16,
    y: 84,
    isSafeZone: true,
    desk: 'Equipment Desk (Court Level)',
    hours: '6:00 AM – 11:00 PM',
    cctvCoverage: '95.5%',
    securityStaff: 'Supervisor B. Chen',
    securityStatus: 'Active Safe Vault',
    icon: 'fitness_center',
    color: '#059669',
    description: 'Campus gymnasium and recreation center with lockers, basketball courts, and pool facility.'
  },
  {
    id: 'zone-winthrop',
    name: 'Winthrop River House',
    code: 'WIN-10',
    sector: 'River Quad',
    area: 'Charles River Residential',
    x: 64,
    y: 84,
    isSafeZone: false,
    desk: 'Winthrop House Office',
    hours: '24/7 Resident Access',
    cctvCoverage: '90.2%',
    securityStaff: 'Resident Tutor M. Hayes',
    securityStatus: 'Monitored Area',
    icon: 'home',
    color: '#ea580c',
    description: 'Undergraduate residential house bordering the Charles River. Common area for lost student IDs and keys.'
  }
];

// Ordered pathway connections between adjacent campus nodes
const PATHWAYS = [
  ['zone-cabot', 'zone-science-plaza'],
  ['zone-science-plaza', 'zone-annenberg'],
  ['zone-police', 'zone-cabot'],
  ['zone-police', 'zone-union'],
  ['zone-police', 'zone-malkin'],
  ['zone-science-plaza', 'zone-memchurch'],
  ['zone-memchurch', 'zone-sever'],
  ['zone-cabot', 'zone-union'],
  ['zone-memchurch', 'zone-widener'],
  ['zone-sever', 'zone-widener'],
  ['zone-union', 'zone-widener'],
  ['zone-union', 'zone-malkin'],
  ['zone-widener', 'zone-winthrop'],
  ['zone-malkin', 'zone-winthrop']
];

export default function CampusMapScreen({ onSelectItem, focusedBuilding }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedZone, setSelectedZone] = useState(CAMPUS_ZONES[0]);
  const [activeSector, setActiveSector] = useState('all');
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'safe', 'alerts'

  useEffect(() => {
    if (focusedBuilding) {
      const match = CAMPUS_ZONES.find(z => 
        z.name.toLowerCase().includes(focusedBuilding.toLowerCase()) || 
        focusedBuilding.toLowerCase().includes(z.name.toLowerCase()) ||
        z.id.toLowerCase().includes(focusedBuilding.toLowerCase()) ||
        z.code.toLowerCase().includes(focusedBuilding.toLowerCase())
      );
      if (match) setSelectedZone(match);
    }
  }, [focusedBuilding]);

  useEffect(() => {
    async function loadItems() {
      try {
        const res = await fetch('/api/items');
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
        }
      } catch (e) {
        console.error('Failed to load items for map', e);
      }
    }
    loadItems();
  }, []);

  // Alert count lookup map
  const zoneAlertCount = useMemo(() => {
    const counts = {};
    CAMPUS_ZONES.forEach(z => {
      const matchCount = items.filter(it => {
        const loc = (it.coarse_location || '').toLowerCase();
        const zName = z.name.toLowerCase();
        const zCode = z.code.toLowerCase();
        return loc.includes(zName) || zName.includes(loc) || loc.includes(zCode);
      }).length;
      counts[z.id] = matchCount;
    });
    return counts;
  }, [items]);

  // Filtered zones based on sector / filter mode
  const displayedZones = useMemo(() => {
    return CAMPUS_ZONES.filter(z => {
      if (activeSector !== 'all' && z.sector !== activeSector) return false;
      if (filterMode === 'safe' && !z.isSafeZone) return false;
      if (filterMode === 'alerts' && (zoneAlertCount[z.id] || 0) === 0) return false;
      return true;
    });
  }, [activeSector, filterMode, zoneAlertCount]);

  // Filter items in current selected building/zone
  const zoneItems = useMemo(() => {
    return items.filter(it => {
      const loc = (it.coarse_location || '').toLowerCase();
      const zName = selectedZone.name.toLowerCase();
      const zCode = selectedZone.code.toLowerCase();
      return loc.includes(zName) || zName.includes(loc) || loc.includes(zCode);
    });
  }, [items, selectedZone]);

  // Helper to get coordinates for SVG pathways
  const zoneMap = useMemo(() => {
    const map = {};
    CAMPUS_ZONES.forEach(z => { map[z.id] = z; });
    return map;
  }, []);

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-24">
      
      {/* Top Header & Overview Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              Campus Radar & Safe Zones
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time monitoring across 10 campus checkpoints, safe vault locations, and intake desks.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-lg bg-slate-100/90 border border-slate-200/80 text-xs font-medium">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                filterMode === 'all' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Locations ({CAMPUS_ZONES.length})
            </button>
            <button
              onClick={() => setFilterMode('safe')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'safe' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-xs">shield</span>
              Safe Vaults (7)
            </button>
            <button
              onClick={() => setFilterMode('alerts')}
              className={`px-3 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${
                filterMode === 'alerts' ? 'bg-amber-600 text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-xs">notifications_active</span>
              Active Alerts
            </button>
          </div>
        </div>
      </div>

      {/* Sector Quick-Nav Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-4 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1 shrink-0">Sector:</span>
        {['all', 'North Quad', 'Central Yard', 'East Yard', 'South Hub', 'West Gate', 'River Quad'].map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSector(sec)}
            className={`px-3 py-1 rounded-lg whitespace-nowrap transition-all border text-xs font-medium cursor-pointer ${
              activeSector === sec
                ? 'bg-indigo-50 text-indigo-700 font-semibold border-indigo-200 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {sec === 'all' ? 'All Sectors' : sec}
          </button>
        ))}
      </div>

      {/* Main Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* LEFT PANEL: Ordered Campus Map Stage (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs overflow-hidden flex flex-col gap-3 relative">
          
          {/* Map Top Status Strip */}
          <div className="flex items-center justify-between px-2 text-xs text-[#464554]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#4648d4] font-mono text-[11px] font-bold border border-indigo-200/70">
                HARVARD QUADRANGLE MATRIX
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
                GEOFENCE: ACTIVE
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-emerald-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>10 SECURE CHECKPOINTS</span>
            </div>
          </div>

          {/* Interactive Map Board Canvas */}
          <div className="relative w-full h-[490px] sm:h-[550px] rounded-2xl bg-gradient-to-b from-[#f3f4fd] via-[#fbf8ff] to-[#edf0fc] border border-indigo-200/70 overflow-hidden shadow-inner select-none">
            
            {/* Subtle Grid Texture */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#4648d4 1.2px, transparent 1.2px), linear-gradient(to right, rgba(99,102,241,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.08) 1px, transparent 1px)',
                backgroundSize: '32px 32px, 32px 32px, 32px 32px'
              }}
            />

            {/* Clean Ordered Campus Lawn Polygons (Background Landscape) */}
            <div className="absolute top-[8%] left-[20%] w-[62%] h-[24%] rounded-3xl bg-emerald-500/10 border border-emerald-500/20 pointer-events-none flex items-start justify-end p-3 text-[10px] font-bold text-emerald-800 tracking-wider">
              SCIENCE QUAD & NORTH LAWN
            </div>
            
            <div className="absolute top-[34%] left-[34%] w-[50%] h-[32%] rounded-3xl bg-indigo-500/10 border border-indigo-500/20 pointer-events-none flex items-start justify-end p-3 text-[10px] font-bold text-indigo-800 tracking-wider">
              HARVARD YARD CORE
            </div>

            <div className="absolute bottom-[4%] left-[10%] w-[78%] h-[20%] rounded-3xl bg-teal-500/10 border border-teal-500/20 pointer-events-none flex items-end justify-start p-3 text-[10px] font-bold text-teal-800 tracking-wider">
              ATHLETICS & RIVER COMMONS
            </div>

            {/* Dynamic Spotlight Glow Centered on Selected Building */}
            <div 
              className="absolute pointer-events-none transition-all duration-500 ease-out z-0"
              style={{
                top: `${selectedZone.y}%`,
                left: `${selectedZone.x}%`,
                transform: 'translate(-50%, -50%)',
                width: '280px',
                height: '280px',
                background: 'radial-gradient(circle, rgba(99,102,241,0.22) 0%, rgba(99,102,241,0.04) 50%, transparent 70%)'
              }}
            />

            {/* SVG Pathway Network with Flowing Light Particles */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              {/* Clean Base Connector Lines */}
              {PATHWAYS.map(([fromId, toId], idx) => {
                const zFrom = zoneMap[fromId];
                const zTo = zoneMap[toId];
                if (!zFrom || !zTo) return null;
                return (
                  <line
                    key={`base-${idx}`}
                    x1={`${zFrom.x}%`}
                    y1={`${zFrom.y}%`}
                    x2={`${zTo.x}%`}
                    y2={`${zTo.y}%`}
                    stroke="#818cf8"
                    strokeWidth="2"
                    strokeOpacity="0.3"
                    strokeDasharray="4 4"
                  />
                );
              })}

              {/* Animated Light Energy Streams */}
              {PATHWAYS.map(([fromId, toId], idx) => {
                const zFrom = zoneMap[fromId];
                const zTo = zoneMap[toId];
                if (!zFrom || !zTo) return null;
                return (
                  <line
                    key={`pulse-${idx}`}
                    x1={`${zFrom.x}%`}
                    y1={`${zFrom.y}%`}
                    x2={`${zTo.x}%`}
                    y2={`${zTo.y}%`}
                    stroke="#4648d4"
                    strokeWidth="2.5"
                    strokeDasharray="6 14"
                    className="animate-[dash_5s_linear_infinite]"
                  />
                );
              })}
            </svg>

            {/* Clean Ordered Campus Node Pins */}
            {CAMPUS_ZONES.map((zone) => {
              const isSelected = selectedZone.id === zone.id;
              const isDisplayed = displayedZones.some(z => z.id === zone.id);
              const alertCount = zoneAlertCount[zone.id] || 0;

              return (
                <div
                  key={zone.id}
                  style={{
                    top: `${zone.y}%`,
                    left: `${zone.x}%`,
                    zIndex: isSelected ? 40 : 20
                  }}
                  onClick={() => setSelectedZone(zone)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group transition-all duration-300 ${
                    isDisplayed ? 'opacity-100 scale-100' : 'opacity-30 scale-90'
                  }`}
                >
                  {/* Radiating Ripple Shockwave Rings for Selected Node */}
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <span className="absolute w-12 h-12 rounded-full border-2 border-[#4648d4] animate-ping"></span>
                      <span className="absolute w-20 h-20 rounded-full border border-indigo-400/40 animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
                    </div>
                  )}

                  {/* UNIFIED PIN CARD (Icon Tile + Badge + Label) */}
                  <div className={`flex flex-col items-center transition-transform duration-200 ${
                    isSelected ? 'scale-110 -translate-y-1' : 'group-hover:scale-105 group-hover:-translate-y-0.5'
                  }`}>
                    
                    {/* Location Tile */}
                    <div className="relative">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-md border-2 transition-all ${
                        isSelected
                          ? 'bg-[#4648d4] text-white border-white ring-4 ring-indigo-300 shadow-indigo-500/30'
                          : zone.isSafeZone
                          ? 'bg-white text-emerald-700 border-emerald-300 shadow-xs'
                          : 'bg-white text-slate-700 border-indigo-200 shadow-xs'
                      }`}>
                        <span className="material-symbols-outlined text-xl">{zone.icon}</span>
                      </div>

                      {/* Shield / Alert Counter Badge (Directly Anchored at Corner) */}
                      <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold border-2 border-white shadow-xs ${
                        alertCount > 0
                          ? alertCount >= 3 ? 'bg-rose-600 animate-bounce' : 'bg-amber-500'
                          : zone.isSafeZone
                          ? 'bg-emerald-600'
                          : 'bg-indigo-500'
                      }`}>
                        {alertCount > 0 ? (
                          alertCount
                        ) : zone.isSafeZone ? (
                          <span className="material-symbols-outlined text-[11px]">shield</span>
                        ) : (
                          <span className="material-symbols-outlined text-[10px]">verified</span>
                        )}
                      </div>
                    </div>

                    {/* Clean Location Label Tag */}
                    <div className={`mt-1 px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-sm text-[11px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#1a1b25] text-white border-transparent ring-2 ring-indigo-400'
                        : 'bg-white/95 text-[#1a1b25] border-indigo-100 group-hover:border-[#4648d4] group-hover:shadow-md'
                    }`}>
                      <span className="text-[9px] font-mono font-bold text-indigo-400">{zone.code}</span>
                      <span>{zone.name}</span>
                    </div>

                  </div>
                </div>
              );
            })}

            {/* Bottom-Left Verified Vault Info Pill */}
            <div className="absolute bottom-3 left-3 p-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-500/40 shadow-lg max-w-xs z-30 hidden sm:flex items-start gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                <span className="material-symbols-outlined text-base">verified_user</span>
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-800 block">Active Safe Vault Point</span>
                <p className="text-[11px] text-[#464554] leading-tight mt-0.5">
                  {selectedZone.name} is staffed for verified custody returns.
                </p>
              </div>
            </div>

            {/* Bottom-Right Clean Legend */}
            <div className="absolute bottom-3 right-3 p-2.5 rounded-2xl bg-white/95 backdrop-blur-md border border-indigo-100 shadow-lg flex items-center gap-3 text-[10px] text-[#464554] z-30">
              <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span>Safe Vault</span>
              </div>
              <div className="flex items-center gap-1.5 font-bold text-[#4648d4]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4648d4]"></span>
                <span>Selected</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                <span>Alerts</span>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT PANEL: Location Detail & Operations Dispatch (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          
          {/* Active Checkpoint Telemetry Card */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-4">
            
            {/* Header with Code & Security Badge */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                    {selectedZone.code}
                  </span>
                  <span className="text-[11px] font-medium text-slate-500">
                    {selectedZone.sector}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  {selectedZone.name}
                </h3>
              </div>

              {selectedZone.isSafeZone ? (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">shield</span>
                  Safe Vault
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium border border-slate-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  Monitored
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 leading-relaxed">
              {selectedZone.description}
            </p>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">CCTV Coverage</span>
                <div className="flex items-center gap-1 text-xs font-mono font-semibold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {selectedZone.cctvCoverage}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col gap-0.5">
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Security Status</span>
                <span className="text-xs font-semibold text-indigo-700 truncate">
                  {selectedZone.securityStatus}
                </span>
              </div>
            </div>

            {/* Checkpoint Details */}
            <div className="p-3.5 rounded-xl bg-slate-50/50 border border-slate-200/60 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Custody Desk:</span>
                <span className="font-medium text-slate-900 text-right truncate max-w-[180px]">{selectedZone.desk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Access Hours:</span>
                <span className="font-medium text-slate-900">{selectedZone.hours}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Security On Duty:</span>
                <span className="font-medium text-indigo-700">{selectedZone.securityStaff}</span>
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const alertMsg = `Safe Meetup Beacon designated for ${selectedZone.name} (${selectedZone.desk}). Desk personnel notified for dual-signature pickup.`;
                  alert(alertMsg);
                }}
                className="flex-1 py-2.5 rounded-lg btn-gradient-indigo text-white text-xs font-semibold shadow-xs active:scale-[0.99] transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">near_me</span>
                <span>Set Meetup Beacon</span>
              </button>
            </div>

          </div>

          {/* Active Items Clustered at Location */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-indigo-600">inventory_2</span>
                <span>Reports at {selectedZone.code} ({zoneItems.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono">COARSE</span>
            </div>

            {zoneItems.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1">
                <span className="material-symbols-outlined text-xl text-slate-300">check_circle</span>
                <span>No active reports in this checkpoint.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-h-72 overflow-y-auto no-scrollbar pr-0.5">
                {zoneItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className="p-2.5 rounded-xl bg-slate-50/60 hover:bg-slate-100/80 border border-slate-200/60 flex items-center justify-between gap-3 cursor-pointer transition-all shadow-xs group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.photos && item.photos[0] ? (
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-9 h-9 rounded-lg object-cover ring-1 ring-slate-200 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                          <span className="material-symbols-outlined text-base">devices</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-xs font-medium text-slate-800 truncate group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.floor_room || 'General Quadrant'} • #{item.id}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold font-mono shrink-0 ${
                      item.type === 'found'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
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
