import React, { useState, useEffect } from 'react';
import Logo from './Logo';

export default function LoadingScreen({ onFinish }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('Initializing Harvard Quad Geofence...');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsFadingOut(true);
            setTimeout(() => {
              if (onFinish) onFinish();
            }, 600);
          }, 300);
          return 100;
        }

        const next = prev + Math.floor(Math.random() * 14) + 8;
        if (next >= 85) {
          setStatusText('Decentralized Recovery Protocol Ready.');
        } else if (next >= 50) {
          setStatusText('Syncing 10 Quad Checkpoints & Vaults...');
        } else if (next >= 25) {
          setStatusText('Securing Custody Verification Channels...');
        }
        return next > 100 ? 100 : next;
      });
    }, 110);

    return () => clearInterval(interval);
  }, [onFinish]);

  return (
    <div 
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#fbf8ff] transition-opacity duration-700 ease-out select-none ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Animated Gradient Mesh & Matrix */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[400px] sm:w-[650px] h-[400px] sm:h-[650px] rounded-full bg-violet-200/40 blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-32 -right-20 w-[380px] sm:w-[600px] h-[380px] sm:h-[600px] rounded-full bg-indigo-200/35 blur-3xl"></div>
        <div 
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage: 'radial-gradient(#7C3AED 1.5px, transparent 1.5px)',
            backgroundSize: '28px 28px'
          }}
        />
      </div>

      {/* Center Brand & Radar Ripple Container */}
      <div className="relative z-10 flex flex-col items-center max-w-sm px-6 text-center">
        
        {/* Animated Expanding Concentric Radar Rings */}
        <div className="relative mb-6 flex items-center justify-center">
          <span className="absolute w-28 h-28 rounded-full border-2 border-violet-500/20 animate-ping"></span>
          <span className="absolute w-44 h-44 rounded-full border border-indigo-400/20 animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"></span>
          <span className="absolute w-60 h-60 rounded-full bg-violet-500/5 animate-pulse"></span>

          {/* Core Logo Mark */}
          <div className="relative w-20 h-20 rounded-3xl bg-white/90 shadow-2xl border border-violet-200/80 p-3.5 flex items-center justify-center">
            <svg 
              viewBox="0 0 100 100" 
              className="w-full h-full drop-shadow-md" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle 
                cx="50" 
                cy="50" 
                r="38" 
                stroke="#7C3AED" 
                strokeWidth="8.5" 
              />
              <path 
                d="M 30 46 C 30 63 70 63 70 46" 
                stroke="#7C3AED" 
                strokeWidth="7" 
                strokeLinecap="round" 
              />
              <path 
                d="M 37 34 C 43 29 57 29 63 34" 
                stroke="#8B5CF6" 
                strokeWidth="5" 
                strokeLinecap="round" 
                strokeOpacity="0.75"
              />
            </svg>
          </div>
        </div>

        {/* Brand Name & Tagline */}
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#16192e] font-sans">
          Re<span className="text-[#7C3AED]">Trace</span>
        </h1>

        <div className="mt-1.5 flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-200/70 text-[#7C3AED] text-[10px] font-mono font-bold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-600 animate-ping"></span>
          <span>Official Campus Recovery Protocol</span>
        </div>

        {/* Progress Bar & Telemetry Status */}
        <div className="w-full mt-8 flex flex-col gap-2">
          
          <div className="w-full h-2 rounded-full bg-violet-100 overflow-hidden relative p-0.5 border border-violet-200/60 shadow-inner">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] via-[#8B5CF6] to-[#4648d4] transition-all duration-150 ease-out shadow-sm relative"
              style={{ width: `${progress}%` }}
            >
              {/* Glowing tip */}
              <span className="absolute right-0 top-0 bottom-0 w-2 rounded-full bg-white opacity-80 animate-pulse"></span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mt-1">
            <span className="truncate max-w-[240px] text-left font-medium text-slate-600">
              {statusText}
            </span>
            <span className="font-bold text-[#7C3AED] shrink-0">
              {progress}%
            </span>
          </div>

        </div>

      </div>

      {/* Bottom Campus Credentials */}
      <div className="absolute bottom-6 text-[11px] text-slate-400 font-mono tracking-wider flex items-center gap-2">
        <span>GEOFENCE ACTIVE</span>
        <span>•</span>
        <span>HARVARD UNIVERSITY COMMONS</span>
      </div>
    </div>
  );
}
