import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function ImageZoomModal({
  isOpen,
  onClose,
  photos = [],
  initialIdx = 0,
  itemTitle = 'Item Photo'
}) {
  const [currentIdx, setCurrentIdx] = useState(initialIdx);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const imageRef = useRef(null);

  // Sync initial index
  useEffect(() => {
    setCurrentIdx(initialIdx);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [initialIdx, isOpen]);

  // Reset zoom & pan when image changes
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback((e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setCurrentIdx((prev) => (prev + 1) % photos.length);
    resetZoom();
  }, [photos.length, resetZoom]);

  const handlePrev = useCallback((e) => {
    if (e) e.stopPropagation();
    if (photos.length <= 1) return;
    setCurrentIdx((prev) => (prev - 1 + photos.length) % photos.length);
    resetZoom();
  }, [photos.length, resetZoom]);

  const zoomIn = (e) => {
    if (e) e.stopPropagation();
    setScale((prev) => Math.min(4, Number((prev + 0.5).toFixed(1))));
  };

  const zoomOut = (e) => {
    if (e) e.stopPropagation();
    setScale((prev) => {
      const next = Math.max(1, Number((prev - 0.5).toFixed(1)));
      if (next === 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (scale > 1) {
      resetZoom();
    } else {
      setScale(2.5);
    }
  };

  // Wheel zoom handler
  const handleWheel = (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setScale((prev) => Math.min(4, Number((prev + 0.25).toFixed(2))));
    } else {
      setScale((prev) => {
        const next = Math.max(1, Number((prev - 0.25).toFixed(2)));
        if (next === 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Keyboard navigation & Esc to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === '+' || e.key === '=') {
        zoomIn();
      } else if (e.key === '-') {
        zoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev, resetZoom]);

  // Drag / Pan mouse handlers
  const handleMouseDown = (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || scale <= 1) return;
    e.preventDefault();
    const maxBound = 300 * (scale - 1);
    const newX = Math.max(-maxBound, Math.min(maxBound, e.clientX - dragStart.x));
    const newY = Math.max(-maxBound, Math.min(maxBound, e.clientY - dragStart.y));
    setPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch pan support
  const handleTouchStart = (e) => {
    if (scale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - position.x,
      y: e.touches[0].clientY - position.y
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || scale <= 1 || e.touches.length !== 1) return;
    const maxBound = 300 * (scale - 1);
    const newX = Math.max(-maxBound, Math.min(maxBound, e.touches[0].clientX - dragStart.x));
    const newY = Math.max(-maxBound, Math.min(maxBound, e.touches[0].clientY - dragStart.y));
    setPosition({ x: newX, y: newY });
  };

  if (!isOpen) return null;

  const currentPhoto = photos[currentIdx] || '';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-xl flex flex-col justify-between p-3 sm:p-6 select-none animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDragging) {
          onClose();
        }
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Top Controls Header */}
      <div className="relative z-20 flex items-center justify-between w-full max-w-5xl mx-auto px-2">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-white text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-[#818cf8]">zoom_in</span>
            <span className="truncate max-w-[200px] sm:max-w-md">{itemTitle}</span>
          </div>
          {photos.length > 1 && (
            <span className="text-xs font-mono font-medium text-slate-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
              {currentIdx + 1} / {photos.length}
            </span>
          )}
        </div>

        {/* Action Controls & Close */}
        <div className="flex items-center gap-2">
          {/* Zoom Level Indicator */}
          <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-mono text-xs border border-indigo-400/30">
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={zoomOut}
            disabled={scale <= 1}
            title="Zoom Out (-)"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
          >
            <span className="material-symbols-outlined text-lg">zoom_out</span>
          </button>

          {/* Reset Zoom Button */}
          <button
            type="button"
            onClick={resetZoom}
            disabled={scale === 1}
            title="Reset Zoom (100%)"
            className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-semibold disabled:opacity-40 disabled:hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
          >
            1x
          </button>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={zoomIn}
            disabled={scale >= 4}
            title="Zoom In (+)"
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white disabled:opacity-40 disabled:hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
          >
            <span className="material-symbols-outlined text-lg">zoom_in</span>
          </button>

          {/* Close Lightbox */}
          <button
            type="button"
            onClick={onClose}
            title="Close (Esc)"
            className="p-2 ml-2 rounded-full bg-rose-500/80 hover:bg-rose-600 text-white transition-all cursor-pointer shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div
        ref={containerRef}
        className="relative flex-1 w-full max-w-5xl mx-auto my-2 flex items-center justify-center overflow-hidden rounded-2xl cursor-default"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        {/* Left Nav Arrow */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            title="Previous Image (Left Arrow)"
            className="absolute left-2 sm:left-4 z-30 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">chevron_left</span>
          </button>
        )}

        {/* Image Container with Zoom & Pan Transforms */}
        <div
          className="relative max-h-[72vh] max-w-full flex items-center justify-center transition-transform duration-75"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0px) scale(${scale})`,
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
          }}
          onDoubleClick={handleDoubleClick}
        >
          <img
            ref={imageRef}
            src={currentPhoto}
            alt={itemTitle}
            draggable={false}
            className="max-h-[70vh] max-w-full object-contain rounded-xl shadow-2xl pointer-events-auto select-none"
          />
        </div>

        {/* Right Nav Arrow */}
        {photos.length > 1 && (
          <button
            type="button"
            onClick={handleNext}
            title="Next Image (Right Arrow)"
            className="absolute right-2 sm:right-4 z-30 p-3 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md border border-white/15 transition-all hover:scale-110 active:scale-95 cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">chevron_right</span>
          </button>
        )}

        {/* Helper Hint Pill */}
        <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
          <span className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] text-slate-300 border border-white/10">
            {scale > 1
              ? 'Drag to pan • Double-click or click 1x to reset'
              : 'Double-click, scroll wheel, or click + to zoom in'}
          </span>
        </div>
      </div>

      {/* Bottom Thumbnail Strip */}
      {photos.length > 1 && (
        <div className="relative z-20 flex items-center justify-center gap-2 overflow-x-auto py-2 max-w-md mx-auto">
          {photos.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setCurrentIdx(i);
                resetZoom();
              }}
              className={`relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                currentIdx === i
                  ? 'border-indigo-400 scale-105 shadow-lg shadow-indigo-500/30'
                  : 'border-white/20 opacity-50 hover:opacity-100'
              }`}
            >
              <img src={p} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
