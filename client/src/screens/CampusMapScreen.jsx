import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

const CAMPUS_ZONES = [
  {
    id: 'zone-cabot',
    name: 'Cabot Science Library',
    code: 'CSL-01',
    area: 'Central Science Quad',
    x: 34,
    y: 28,
    elevation: 36,
    isSafeZone: true,
    desk: 'Cabot Circulation Desk (Staff #L-89)',
    hours: '8:00 AM – 11:00 PM',
    cctvCoverage: '98.4%',
    securityStaff: 'Officer Marcus Vance',
    securityStatus: 'Active Safe Vault',
    buildingType: 'library-stepped',
    description: 'Central campus STEM library equipped with safe-exchange lockboxes, dual-sign custody kiosk, and 24/7 security reception.'
  },
  {
    id: 'zone-widener',
    name: 'Widener Library',
    code: 'WID-04',
    area: 'Harvard Yard South',
    x: 64,
    y: 56,
    elevation: 48,
    isSafeZone: true,
    desk: 'Widener Front Portico Desk',
    hours: '9:00 AM – 10:00 PM',
    cctvCoverage: '99.1%',
    securityStaff: 'Guard K. Thorne',
    securityStatus: 'High Surveillance',
    buildingType: 'library-monument',
    description: 'Main flagship research library. High-traffic zone with perimeter optical sensors and lost-and-found intake desk.'
  },
  {
    id: 'zone-union',
    name: 'Student Union Hub',
    code: 'SUH-08',
    area: 'Campus Center & Commons',
    x: 46,
    y: 66,
    elevation: 32,
    isSafeZone: true,
    desk: 'Student Union Info Desk',
    hours: '8:00 AM – Midnight',
    cctvCoverage: '94.0%',
    securityStaff: 'Campus Monitor J. Diaz',
    securityStatus: 'Active Safe Vault',
    buildingType: 'modern-hub',
    description: 'Central student pavilion with dining, lockers, and continuous student traffic. Designated low-friction exchange point.'
  },
  {
    id: 'zone-annenberg',
    name: 'Annenberg Hall',
    code: 'ANB-02',
    area: 'Memorial Hall North',
    x: 74,
    y: 26,
    elevation: 42,
    isSafeZone: false,
    desk: 'Dining Commons Reception',
    hours: '7:30 AM – 8:00 PM',
    cctvCoverage: '88.5%',
    securityStaff: 'Floor Lead Sarah T.',
    securityStatus: 'Standard Watch',
    buildingType: 'gothic-hall',
    description: 'Historic gothic dining hall and auditorium. Frequent reports of left-behind backpacks, electronics, and outerwear.'
  },
  {
    id: 'zone-malkin',
    name: 'Malkin Athletic Center',
    code: 'MAC-11',
    area: 'Athletics & Rec Field',
    x: 22,
    y: 76,
    elevation: 30,
    isSafeZone: true,
    desk: 'Equipment Desk 2 (Court Level)',
    hours: '6:00 AM – 11:00 PM',
    cctvCoverage: '96.2%',
    securityStaff: 'Rec Supervisor B. Chen',
    securityStatus: 'Active Safe Vault',
    buildingType: 'gym-pavilion',
    description: 'Multi-level athletic facility with locker rooms, courts, and fitness studios. Secure lockboxes for recovered valuables.'
  },
  {
    id: 'zone-police',
    name: 'Campus Police Annex',
    code: 'HUPD-00',
    area: 'Main Gate 24/7 Checkpoint',
    x: 16,
    y: 44,
    elevation: 28,
    isSafeZone: true,
    desk: '24/7 Central Dispatch Desk',
    hours: '24/7 CCTV Monitored',
    cctvCoverage: '100%',
    securityStaff: 'Dispatch Lead Sgt. Miller',
    securityStatus: 'Maximum Security',
    buildingType: 'police-annex',
    description: 'Central campus safety headquarters with evidence-grade custody logging, biometric verification, and immediate officer escort.'
  }
];

export default function CampusMapScreen({ onSelectItem, focusedBuilding }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [selectedZone, setSelectedZone] = useState(CAMPUS_ZONES[0]);
  const [filterType, setFilterType] = useState('all'); // 'all', 'found', 'lost'
  const [viewMode, setViewMode] = useState('isometric'); // 'isometric' or 'tactical'
  const [radarPingActive, setRadarPingActive] = useState(true);
  const [hoveredZone, setHoveredZone] = useState(null);

  useEffect(() => {
    if (focusedBuilding) {
      const match = CAMPUS_ZONES.find(z => 
        z.name.toLowerCase().includes(focusedBuilding.toLowerCase()) || 
        focusedBuilding.toLowerCase().includes(z.name.toLowerCase()) ||
        z.id.toLowerCase().includes(focusedBuilding.toLowerCase())
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

  // Filter items in current selected building/zone
  const zoneItems = useMemo(() => {
    return items.filter(it => {
      const matchesZone = it.coarse_location?.toLowerCase().includes(selectedZone.name.toLowerCase()) ||
                          selectedZone.name.toLowerCase().includes(it.coarse_location?.toLowerCase());
      if (!matchesZone) return false;
      if (filterType === 'all') return true;
      return it.type === filterType;
    });
  }, [items, selectedZone, filterType]);

  // Alert stats per zone
  const zoneAlertStats = useMemo(() => {
    const stats = {};
    CAMPUS_ZONES.forEach(z => {
      const count = items.filter(it => 
        it.coarse_location?.toLowerCase().includes(z.name.toLowerCase()) ||
        z.name.toLowerCase().includes(it.coarse_location?.toLowerCase())
      ).length;
      stats[z.id] = count;
    });
    return stats;
  }, [items]);

  // Calculate checkpoint alert color
  const getAlertColorConfig = (alertCount) => {
    if (alertCount === 0) {
      return {
        theme: 'emerald',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        ringColor: '#10B981',
        glowClass: 'shadow-[0_0_15px_rgba(16,185,129,0.5)]',
        statusLabel: 'Idle (0 Alerts)',
        pulseRate: 'animate-pulse'
      };
    }
    if (alertCount <= 2) {
      return {
        theme: 'amber',
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
        ringColor: '#F59E0B',
        glowClass: 'shadow-[0_0_18px_rgba(245,158,11,0.65)]',
        statusLabel: `${alertCount} Active Alert${alertCount > 1 ? 's' : ''}`,
        pulseRate: 'animate-pulse'
      };
    }
    return {
      theme: 'rose',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      ringColor: '#EF4444',
      glowClass: 'shadow-[0_0_22px_rgba(239,68,68,0.75)]',
      statusLabel: `${alertCount} Critical Alerts`,
      pulseRate: 'animate-bounce'
    };
  };

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24">
      
      {/* HUD Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#4648d4] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#4648d4]"></span>
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#1a1b25] flex items-center gap-2">
              Campus Operations Tactical Grid
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-indigo-50 text-[#4648d4] text-[10px] font-mono font-bold uppercase tracking-wider border border-indigo-200/80">
                GEOFENCE VERIFIED
              </span>
            </h1>
          </div>
          <p className="text-xs text-[#464554] mt-1 max-w-2xl">
            Real-time telemetry of quad checkpoints, high-value item clusters, and custody lockers. Privacy-protected coarse view with 24/7 security escort monitoring.
          </p>
        </div>

        {/* Dashboard Control Toolbar */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          
          {/* Isometric vs Tactical Toggle */}
          <div className="flex items-center p-1 rounded-full bg-white/90 glass-panel border border-indigo-200/80 shadow-xs">
            <button
              onClick={() => setViewMode('isometric')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'isometric'
                  ? 'btn-gradient-indigo text-white shadow-sm'
                  : 'text-[#464554] hover:text-[#1a1b25]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">view_in_ar</span>
              <span>3D Quad Terrain</span>
            </button>
            <button
              onClick={() => setViewMode('tactical')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'tactical'
                  ? 'btn-gradient-indigo text-white shadow-sm'
                  : 'text-[#464554] hover:text-[#1a1b25]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">radar</span>
              <span>Top-Down Radar</span>
            </button>
          </div>

          {/* Item Category Filters */}
          <div className="flex items-center p-1 rounded-full bg-white/90 glass-panel border border-indigo-200/80 shadow-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-indigo-100/90 text-[#4648d4] font-bold shadow-xs'
                  : 'text-[#464554] hover:bg-indigo-50'
              }`}
            >
              All Nodes ({items.length})
            </button>
            <button
              onClick={() => setFilterType('found')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'found'
                  ? 'bg-emerald-100 text-emerald-800 font-bold shadow-xs'
                  : 'text-[#464554] hover:bg-emerald-50'
              }`}
            >
              Found ({items.filter(i => i.type === 'found').length})
            </button>
            <button
              onClick={() => setFilterType('lost')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                filterType === 'lost'
                  ? 'bg-rose-100 text-rose-800 font-bold shadow-xs'
                  : 'text-[#464554] hover:bg-rose-50'
              }`}
            >
              Lost ({items.filter(i => i.type === 'lost').length})
            </button>
          </div>

          {/* Radar Ping Pulse Toggle */}
          <button
            onClick={() => setRadarPingActive(!radarPingActive)}
            title="Toggle Live Sweep Ping"
            className={`p-2 rounded-full border transition-all cursor-pointer ${
              radarPingActive
                ? 'bg-indigo-50 border-indigo-300 text-[#4648d4] shadow-xs'
                : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <span className="material-symbols-outlined text-lg">sensors</span>
          </button>

        </div>
      </div>

      {/* Main Operations Grid: 8 Cols Left (Interactive Map), 4 Cols Right (Location HUD) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: Immersive 3D Isometric Map Stage (8 Cols) */}
        <div className="lg:col-span-8 glass-card rounded-3xl p-3 sm:p-4 border border-indigo-200/80 shadow-2xl overflow-hidden flex flex-col gap-3 relative">
          
          {/* Top Stage Telemetry Bar */}
          <div className="flex items-center justify-between px-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-[#4648d4]/10 text-[#4648d4] font-mono text-[11px] font-bold border border-indigo-200/60 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4648d4] animate-ping"></span>
                GRID SECTOR 04 // HARVARD QUAD
              </span>
              <span className="hidden sm:inline-block text-[11px] text-slate-400 font-mono">
                COORD: 42°22'31"N 71°06'58"W
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">shield</span>
                6 Checkpoints Online
              </span>
            </div>
          </div>

          {/* 3D Map Container Canvas */}
          <div className="relative w-full h-[460px] sm:h-[540px] rounded-2xl bg-gradient-to-b from-[#e8e9fb] via-[#f1f3fd] to-[#dfdff7] border border-indigo-200/70 overflow-hidden shadow-inner select-none">
            
            {/* Background 3D Perspective Isometric Plane Grid */}
            <div 
              className={`absolute inset-0 transition-transform duration-700 ${
                viewMode === 'isometric' 
                  ? 'scale-105 origin-center' 
                  : 'scale-100'
              }`}
            >
              
              {/* Isometric Topographic Matrix Pattern */}
              <div 
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage: `
                    radial-gradient(circle at 50% 50%, #4648d4 1.2px, transparent 1.2px),
                    linear-gradient(to right, rgba(99, 102, 241, 0.12) 1px, transparent 1px),
                    linear-gradient(to bottom, rgba(99, 102, 241, 0.12) 1px, transparent 1px)
                  `,
                  backgroundSize: '36px 36px, 36px 36px, 36px 36px'
                }}
              />

              {/* Tactical Radial Range Rings from Grid Center */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                <div className="w-[320px] h-[320px] rounded-full border border-indigo-400 border-dashed"></div>
                <div className="w-[520px] h-[520px] rounded-full border border-indigo-400/60"></div>
                <div className="w-[720px] h-[720px] rounded-full border border-indigo-300/40"></div>
              </div>

              {/* Atmospheric Edge Fog & Vignette */}
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(224,228,252,0.75)_85%,rgba(202,208,248,0.95)_100%)] z-10" />

              {/* Dynamic Spotlight Mask Focusing on Selected Building */}
              <div 
                className="absolute pointer-events-none transition-all duration-700 ease-out z-10"
                style={{
                  top: `${selectedZone.y}%`,
                  left: `${selectedZone.x}%`,
                  transform: 'translate(-50%, -50%)',
                  width: '380px',
                  height: '380px',
                  background: 'radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(99,102,241,0.08) 40%, transparent 70%)'
                }}
              />

              {/* Animated Quad Living Heatmap Polygons */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                <defs>
                  {/* Living Lawn Heatmap Gradient */}
                  <linearGradient id="lawnGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.28">
                      <animate attributeName="stopOpacity" values="0.22;0.35;0.22" dur="4s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="50%" stopColor="#059669" stopOpacity="0.18">
                      <animate attributeName="stopOpacity" values="0.15;0.28;0.15" dur="4s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="#34D399" stopOpacity="0.3">
                      <animate attributeName="stopOpacity" values="0.25;0.4;0.25" dur="4s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>

                  {/* Harvard Yard Living Heatmap Gradient */}
                  <linearGradient id="yardGradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#4648d4" stopOpacity="0.22">
                      <animate attributeName="stopOpacity" values="0.18;0.32;0.18" dur="5s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="70%" stopColor="#818cf8" stopOpacity="0.16">
                      <animate attributeName="stopOpacity" values="0.12;0.26;0.12" dur="5s" repeatCount="indefinite" />
                    </stop>
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0.28">
                      <animate attributeName="stopOpacity" values="0.24;0.36;0.24" dur="5s" repeatCount="indefinite" />
                    </stop>
                  </linearGradient>

                  {/* Laser flow line pulse filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="2" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                </defs>

                {/* Main Quad Lawn (Living Heatmap Island) */}
                <polygon 
                  points="280,120 450,150 420,270 240,230"
                  fill="url(#lawnGradient)"
                  stroke="#10B981"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="transition-all opacity-85"
                />

                {/* Harvard Yard Core (Living Heatmap Island) */}
                <polygon 
                  points="460,260 680,240 760,370 530,420"
                  fill="url(#yardGradient)"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="6 3"
                  className="transition-all opacity-85"
                />

                {/* Primary Connector Pathways (Static Layer) */}
                <g stroke="#818cf8" strokeWidth="2.5" strokeOpacity="0.35" fill="none">
                  <path id="path-cabot-widener" d="M 34% 28% Q 48% 38% 64% 56%" />
                  <path id="path-cabot-annenberg" d="M 34% 28% L 74% 26%" />
                  <path id="path-police-cabot" d="M 16% 44% L 34% 28%" />
                  <path id="path-police-malkin" d="M 16% 44% L 22% 76%" />
                  <path id="path-cabot-union" d="M 34% 28% L 46% 66%" />
                  <path id="path-union-widener" d="M 46% 66% L 64% 56%" />
                  <path id="path-union-malkin" d="M 46% 66% L 22% 76%" />
                  <path id="path-widener-annenberg" d="M 64% 56% L 74% 26%" />
                </g>

                {/* Flowing Laser Particle Streams on Pathways */}
                <g stroke="#4648d4" strokeWidth="3" strokeDasharray="8 16" fill="none" filter="url(#glow)">
                  <path d="M 34% 28% Q 48% 38% 64% 56%" className="animate-[dash_6s_linear_infinite]" />
                  <path d="M 34% 28% L 74% 26%" className="animate-[dash_5s_linear_infinite]" />
                  <path d="M 16% 44% L 34% 28%" className="animate-[dash_4s_linear_infinite]" />
                  <path d="M 16% 44% L 22% 76%" className="animate-[dash_4.5s_linear_infinite]" />
                  <path d="M 34% 28% L 46% 66%" className="animate-[dash_5s_linear_infinite]" />
                  <path d="M 46% 66% L 64% 56%" className="animate-[dash_4s_linear_infinite]" />
                  <path d="M 46% 66% L 22% 76%" className="animate-[dash_5.5s_linear_infinite]" />
                  <path d="M 64% 56% L 74% 26%" className="animate-[dash_4.5s_linear_infinite]" />
                </g>

                {/* Flowing Light Energy Orbs */}
                <circle r="3.5" fill="#4648d4" filter="url(#glow)">
                  <animateMotion path="M 34% 28% Q 48% 38% 64% 56%" dur="4s" repeatCount="indefinite" />
                </circle>
                <circle r="3.5" fill="#10B981" filter="url(#glow)">
                  <animateMotion path="M 16% 44% L 34% 28%" dur="3s" repeatCount="indefinite" />
                </circle>
                <circle r="3.5" fill="#8455ef" filter="url(#glow)">
                  <animateMotion path="M 46% 66% L 64% 56%" dur="3.5s" repeatCount="indefinite" />
                </circle>
                <circle r="3.5" fill="#4648d4" filter="url(#glow)">
                  <animateMotion path="M 46% 66% L 22% 76%" dur="4.2s" repeatCount="indefinite" />
                </circle>
              </svg>

              {/* Heatmap Area Labels */}
              <div 
                className="absolute top-[32%] left-[34%] pointer-events-none px-2.5 py-0.5 rounded-full bg-emerald-900/10 border border-emerald-600/30 text-emerald-800 text-[10px] font-bold font-mono tracking-wider -rotate-6 z-0 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                MAIN QUAD LAWN // HIGH ACTIVITY
              </div>

              <div 
                className="absolute bottom-[28%] right-[22%] pointer-events-none px-2.5 py-0.5 rounded-full bg-indigo-900/10 border border-indigo-600/30 text-indigo-900 text-[10px] font-bold font-mono tracking-wider rotate-3 z-0 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#4648d4] animate-pulse"></span>
                HARVARD YARD CORE // CENTRAL VAULT
              </div>

              {/* Interactive 3D Low-Poly Buildings & Checkpoint Nodes */}
              {CAMPUS_ZONES.map((zone) => {
                const isSelected = selectedZone.id === zone.id;
                const isHovered = hoveredZone === zone.id;
                const alertCount = zoneAlertStats[zone.id] || 0;
                const alertConfig = getAlertColorConfig(alertCount);
                
                // Depth scaling: background nodes (lower y) are slightly smaller & softer, foreground nodes sharper
                const depthScale = 0.88 + (zone.y / 100) * 0.24; 
                const zIndex = Math.floor(zone.y) + (isSelected ? 50 : 20);

                return (
                  <div
                    key={zone.id}
                    style={{
                      top: `${zone.y}%`,
                      left: `${zone.x}%`,
                      zIndex
                    }}
                    onClick={() => setSelectedZone(zone)}
                    onMouseEnter={() => setHoveredZone(zone.id)}
                    onMouseLeave={() => setHoveredZone(null)}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group select-none transition-all duration-300"
                  >
                    
                    {/* Radiating Ripple Shockwave Rings for Selected Node */}
                    {isSelected && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="absolute w-16 h-16 rounded-full border-2 border-[#4648d4]/60 animate-ping"></span>
                        <span className="absolute w-28 h-28 rounded-full border border-[#4648d4]/30 animate-[ping_2.5s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
                        <span className="absolute w-36 h-36 rounded-full bg-indigo-500/10 animate-pulse"></span>
                      </div>
                    )}

                    {/* Low-Poly 3D Building Geometry Block */}
                    <div 
                      className={`relative flex flex-col items-center transition-transform duration-300 ${
                        isSelected ? 'scale-110 -translate-y-2' : isHovered ? 'scale-105 -translate-y-1' : ''
                      }`}
                      style={{ transform: `scale(${depthScale})` }}
                    >
                      
                      {/* Ground Ambient Contact Shadow */}
                      <div className="w-16 h-6 rounded-[100%] bg-indigo-950/20 blur-xs -mb-2 mt-4"></div>

                      {/* 3D Isometric Polygonal Building Model */}
                      <div className="relative w-14 h-12 flex items-center justify-center">
                        <svg viewBox="0 0 80 70" className="w-full h-full drop-shadow-md overflow-visible">
                          
                          {/* Isometric Building Base and Walls */}
                          {zone.buildingType === 'library-stepped' && (
                            <g>
                              {/* Left Shadow Face */}
                              <polygon points="12,35 40,52 40,65 12,48" fill="#5856d6" />
                              {/* Right Highlight Face */}
                              <polygon points="40,52 68,35 68,48 40,65" fill="#7a78e8" />
                              {/* Top Roof Deck */}
                              <polygon points="40,20 68,35 40,52 12,35" fill="#a4a3f4" />
                              {/* Stepped Upper Tier */}
                              <polygon points="24,28 40,38 40,44 24,34" fill="#4648d4" />
                              <polygon points="40,38 56,28 56,34 40,44" fill="#686be5" />
                              <polygon points="40,16 56,28 40,38 24,28" fill="#c3c2fa" />
                              {/* Glass Skylight Stripe */}
                              <polygon points="40,19 48,25 40,30 32,24" fill="#38bdf8" fillOpacity="0.8" />
                            </g>
                          )}

                          {zone.buildingType === 'library-monument' && (
                            <g>
                              {/* Widener Monumental Steps & Portico */}
                              <polygon points="8,40 40,60 40,68 8,48" fill="#4f46e5" />
                              <polygon points="40,60 72,40 72,48 40,68" fill="#6366f1" />
                              <polygon points="40,22 72,40 40,60 8,40" fill="#818cf8" />
                              {/* Classical Pediment Roof */}
                              <polygon points="20,28 40,12 60,28 40,36" fill="#c7d2fe" />
                              <polygon points="40,12 60,28 60,33 40,17" fill="#6366f1" />
                              <polygon points="20,28 40,12 40,17 20,33" fill="#4338ca" />
                            </g>
                          )}

                          {zone.buildingType === 'modern-hub' && (
                            <g>
                              {/* Student Union Angular Pavilion */}
                              <polygon points="10,34 40,54 40,64 10,44" fill="#7c3aed" />
                              <polygon points="40,54 70,34 70,44 40,64" fill="#9333ea" />
                              <polygon points="40,14 70,34 40,54 10,34" fill="#c084fc" />
                              {/* Atrium Cutout */}
                              <polygon points="40,24 54,34 40,44 26,34" fill="#3b82f6" fillOpacity="0.75" />
                            </g>
                          )}

                          {zone.buildingType === 'gothic-hall' && (
                            <g>
                              {/* Annenberg Gothic Hall with Spire */}
                              <polygon points="14,38 40,56 40,66 14,48" fill="#b91c1c" fillOpacity="0.8" />
                              <polygon points="40,56 66,38 66,48 40,66" fill="#dc2626" fillOpacity="0.85" />
                              <polygon points="40,20 66,38 40,56 14,38" fill="#f87171" fillOpacity="0.9" />
                              {/* Steeple Peak */}
                              <polygon points="40,2 45,20 35,20" fill="#991b1b" />
                              <line x1="40" y1="2" x2="40" y2="20" stroke="#fca5a5" strokeWidth="1.5" />
                            </g>
                          )}

                          {zone.buildingType === 'gym-pavilion' && (
                            <g>
                              {/* Malkin Rec Center Broad Dome */}
                              <polygon points="10,36 40,54 40,62 10,44" fill="#0d9488" />
                              <polygon points="40,54 70,36 70,44 40,62" fill="#14b8a6" />
                              <polygon points="40,18 70,36 40,54 10,36" fill="#5eead4" />
                              <ellipse cx="40" cy="34" rx="14" ry="7" fill="#0f766e" />
                            </g>
                          )}

                          {zone.buildingType === 'police-annex' && (
                            <g>
                              {/* Campus Police Fortified Station */}
                              <polygon points="14,34 40,50 40,62 14,46" fill="#1e293b" />
                              <polygon points="40,50 66,34 66,46 40,62" fill="#334155" />
                              <polygon points="40,18 66,34 40,50 14,34" fill="#64748b" />
                              {/* Radar Dish & Beacon Mast */}
                              <line x1="40" y1="4" x2="40" y2="18" stroke="#38bdf8" strokeWidth="2" />
                              <circle cx="40" cy="4" r="2.5" fill="#f43f5e" className="animate-ping" />
                            </g>
                          )}
                        </svg>
                      </div>

                      {/* Floating Hologram Checkpoint Node */}
                      <div className="absolute -top-7 flex items-center justify-center">
                        
                        {/* Soft Breathing Glow Filter */}
                        <div 
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white border-2 border-white transition-all shadow-md ${
                            alertConfig.glowClass
                          } ${
                            isSelected 
                              ? 'bg-[#4648d4] ring-4 ring-indigo-300' 
                              : zone.isSafeZone 
                              ? 'bg-emerald-600' 
                              : 'bg-indigo-600'
                          }`}
                        >
                          <span className="material-symbols-outlined text-sm">
                            {zone.isSafeZone ? 'shield' : 'domain'}
                          </span>
                        </div>

                        {/* Alert Badge Counter */}
                        {alertCount > 0 && (
                          <span 
                            className={`absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full text-white text-[9px] font-mono font-bold flex items-center justify-center border-2 border-white shadow-xs ${
                              alertCount >= 3 ? 'bg-rose-600' : 'bg-amber-500'
                            }`}
                          >
                            {alertCount}
                          </span>
                        )}

                        {/* Safe Vault Verified Beacon Star */}
                        {zone.isSafeZone && (
                          <span className="absolute -bottom-1 -left-1 w-3.5 h-3.5 rounded-full bg-emerald-500 text-white flex items-center justify-center border border-white text-[8px]">
                            ✓
                          </span>
                        )}
                      </div>

                      {/* Building Tactical Callout Tag */}
                      <div className="mt-1 flex flex-col items-center">
                        <div 
                          className={`px-2.5 py-0.5 rounded-full backdrop-blur-md shadow-md text-[11px] font-bold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-[#1a1b25] text-white border-transparent ring-2 ring-indigo-400'
                              : isHovered
                              ? 'bg-white text-[#4648d4] border-[#4648d4] shadow-md'
                              : 'bg-white/95 text-[#1a1b25] border-indigo-100'
                          }`}
                        >
                          <span className="font-mono text-[9px] text-indigo-400 font-bold">{zone.code}</span>
                          <span>{zone.name}</span>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}

            </div>

            {/* Tactical Live Compass HUD Reticle */}
            <div className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 backdrop-blur-md border border-indigo-200/80 shadow-md flex items-center gap-2 z-20">
              <div className="w-7 h-7 rounded-full bg-indigo-50 flex items-center justify-center text-[#4648d4] font-mono font-bold text-[10px] border border-indigo-200/60">
                N
              </div>
              <div className="text-[10px] font-mono text-slate-500">
                <span className="text-[#1a1b25] font-bold block leading-none">GRID OP-01</span>
                <span>Z: 1.00x AUTO</span>
              </div>
            </div>

            {/* Approved Active Safe Handover Point Banner */}
            <div className="absolute bottom-3 left-3 p-3 rounded-2xl bg-white/95 backdrop-blur-md border border-emerald-500/50 shadow-xl max-w-xs z-20 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs mb-1">
                <span className="material-symbols-outlined text-base text-emerald-600">verified_user</span>
                <span>Active Vault: Cabot Circulation Desk</span>
              </div>
              <p className="text-[11px] text-[#464554] leading-relaxed">
                Staffed custody locker equipped for dual-signature student handover & verified return.
              </p>
            </div>

            {/* Tactical Radar Legend */}
            <div className="absolute bottom-3 right-3 p-2.5 rounded-2xl bg-white/90 backdrop-blur-md border border-indigo-100 shadow-lg flex flex-col gap-1.5 text-[10px] text-[#464554] z-20">
              <div className="flex items-center gap-2 font-bold text-[#1a1b25]">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]"></span>
                <span>CCTV Safe Checkpoint</span>
              </div>
              <div className="flex items-center gap-2 font-medium text-[#1a1b25]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4648d4] shadow-[0_0_8px_rgba(70,72,212,0.7)]"></span>
                <span>Selected Grid Target</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500 font-mono">
                <span className="w-2.5 h-1 rounded-full bg-indigo-400"></span>
                <span>Light Energy Pathway</span>
              </div>
            </div>

          </div>

        </div>

        {/* RIGHT PANEL: Location Detail & Operations Dispatch Drawer (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 w-full">
          
          {/* Active Checkpoint Telemetry Card */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-xl flex flex-col gap-4">
            
            {/* Header with Code & Security Badge */}
            <div className="flex items-start justify-between border-b border-indigo-100 pb-3">
              <div>
                <div className="flex items-center gap-1.5 text-[#4648d4]">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    {selectedZone.code}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400">
                    {selectedZone.area}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#1a1b25] mt-1">
                  {selectedZone.name}
                </h3>
              </div>

              {selectedZone.isSafeZone ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200 flex items-center gap-1 shadow-xs">
                  <span className="material-symbols-outlined text-xs">shield</span>
                  Safe Vault
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200 flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  Monitored
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-xs text-[#464554] leading-relaxed">
              {selectedZone.description}
            </p>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">CCTV Coverage</span>
                <div className="flex items-center gap-1 text-xs font-mono font-bold text-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  {selectedZone.cctvCoverage}
                </div>
              </div>

              <div className="p-2.5 rounded-2xl bg-indigo-50/60 border border-indigo-100/80 flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Operational Status</span>
                <span className="text-xs font-bold text-[#4648d4] truncate">
                  {selectedZone.securityStatus}
                </span>
              </div>
            </div>

            {/* Checkpoint Details */}
            <div className="p-3.5 rounded-2xl bg-white/80 border border-indigo-100/80 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Custody Desk:</span>
                <span className="font-semibold text-[#1a1b25] text-right truncate max-w-[180px]">{selectedZone.desk}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Access Hours:</span>
                <span className="font-semibold text-[#1a1b25]">{selectedZone.hours}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Security On Duty:</span>
                <span className="font-semibold text-indigo-700">{selectedZone.securityStaff}</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const alertMsg = `Safe Meetup Beacon designated for ${selectedZone.name} (${selectedZone.desk}). Desk personnel notified for dual-signature pickup.`;
                  alert(alertMsg);
                }}
                className="flex-1 py-2.5 rounded-full btn-gradient-indigo text-white text-xs font-bold tracking-wide shadow-md shadow-indigo-500/20 active:scale-98 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">near_me</span>
                <span>Set Meetup Beacon</span>
              </button>
            </div>

          </div>

          {/* Active Items Clustered at Location */}
          <div className="glass-card rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#1a1b25] flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#4648d4]">inventory_2</span>
                <span>Active Reports at {selectedZone.code} ({zoneItems.length})</span>
              </h4>
              <span className="text-[10px] text-slate-400 font-mono font-medium">COARSE VIEW</span>
            </div>

            {zoneItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-2xl text-slate-300">check_circle</span>
                <span>No pending lost/found alerts at this checkpoint.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto no-scrollbar pr-1">
                {zoneItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectItem(item)}
                    className="p-3 rounded-2xl bg-white/90 hover:bg-white border border-indigo-100 flex items-center justify-between gap-3 cursor-pointer transition-all hover:border-[#4648d4] hover:shadow-md shadow-xs group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.photos && item.photos[0] ? (
                        <img
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-10 h-10 rounded-xl object-cover ring-1 ring-indigo-100 shrink-0 group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-[#4648d4] shrink-0">
                          <span className="material-symbols-outlined text-lg">devices</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <h5 className="text-xs font-bold text-[#1a1b25] truncate group-hover:text-[#4648d4] transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[10px] text-slate-400 truncate">
                          {item.floor_room || 'General Quadrant'} • #{item.id}
                        </p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono shrink-0 ${
                      item.type === 'found'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-50 text-rose-600 border border-rose-200'
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

