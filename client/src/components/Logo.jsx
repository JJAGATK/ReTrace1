import React from 'react';

export default function Logo({ size = 'md', showText = true, animated = false, className = '' }) {
  const sizeMap = {
    xs: { icon: 22, text: 'text-base', gap: 'gap-1.5' },
    sm: { icon: 28, text: 'text-lg', gap: 'gap-2' },
    md: { icon: 34, text: 'text-xl', gap: 'gap-2.5' },
    lg: { icon: 48, text: 'text-2xl sm:text-3xl', gap: 'gap-3' },
    xl: { icon: 64, text: 'text-3xl sm:text-4xl', gap: 'gap-3.5' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center ${currentSize.gap} ${className} select-none`}>
      {/* Brand Icon (Purple Concentric Trace Ring) */}
      <div 
        className={`relative flex items-center justify-center shrink-0 ${animated ? 'animate-pulse' : ''}`}
        style={{ width: currentSize.icon, height: currentSize.icon }}
      >
        <svg 
          viewBox="0 0 100 100" 
          className="w-full h-full drop-shadow-xs overflow-visible" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer Violet Ring */}
          <circle 
            cx="50" 
            cy="50" 
            r="38" 
            stroke="#7C3AED" 
            strokeWidth="8.5" 
          />
          {/* Inner Trace Arc Loop */}
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

      {/* Brand Wordmark */}
      {showText && (
        <span className={`font-bold tracking-tight text-[#16192e] ${currentSize.text} font-sans leading-none`}>
          ReTrace
        </span>
      )}
    </div>
  );
}
