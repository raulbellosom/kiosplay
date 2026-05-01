import React, { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Image, Film } from 'lucide-react';

export default function MediaModal({ items, currentIndex, onClose, onNavigate }) {
  const item = items[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && hasPrev) onNavigate(currentIndex - 1);
    if (e.key === 'ArrowRight' && hasNext) onNavigate(currentIndex + 1);
  }, [currentIndex, hasPrev, hasNext, onClose, onNavigate]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  if (!item) return null;

  const src = `/uploads${item.filePath}`;

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="media-modal-overlay" onClick={handleOverlayClick} role="dialog" aria-modal="true">
      {/* Header */}
      <div className="media-modal-header">
        <div className="media-modal-info">
          {item.type === 'image'
            ? <Image size={14} style={{ color: '#a5b4fc', flexShrink: 0 }} />
            : <Film size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
          }
          <span className="media-modal-filename" title={item.originalName}>
            {item.originalName}
          </span>
          <span className="media-modal-counter">
            {currentIndex + 1} / {items.length}
          </span>
        </div>
        <button className="media-modal-close" onClick={onClose} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>

      {/* Prev button */}
      <button
        className="media-modal-nav media-modal-prev"
        onClick={() => onNavigate(currentIndex - 1)}
        disabled={!hasPrev}
        aria-label="Anterior"
      >
        <ChevronLeft size={22} />
      </button>

      {/* Media content */}
      <div className="media-modal-content" onClick={handleOverlayClick}>
        {item.type === 'image' ? (
          <img
            key={item.id}
            src={src}
            alt={item.originalName}
            className="media-modal-img"
          />
        ) : (
          <video
            key={item.id}
            src={src}
            className="media-modal-video"
            controls
            autoPlay
            playsInline
          />
        )}
      </div>

      {/* Next button */}
      <button
        className="media-modal-nav media-modal-next"
        onClick={() => onNavigate(currentIndex + 1)}
        disabled={!hasNext}
        aria-label="Siguiente"
      >
        <ChevronRight size={22} />
      </button>
    </div>
  );
}
