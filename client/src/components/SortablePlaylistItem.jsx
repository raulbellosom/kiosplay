import React, { useRef, useState, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Trash2, Play, Image } from 'lucide-react';

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function VideoThumbnail({ src }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [thumbSrc, setThumbSrc] = useState(null);

  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    function captureFrame() {
      try {
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, 160, 90);
        setThumbSrc(canvas.toDataURL('image/jpeg', 0.7));
      } catch {
        /* cross-origin or decoding error — stay with placeholder */
      }
    }

    video.addEventListener('loadeddata', captureFrame);
    return () => video.removeEventListener('loadeddata', captureFrame);
  }, [src]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        style={{ display: 'none' }}
        muted
        preload="metadata"
        crossOrigin="anonymous"
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {thumbSrc ? (
        <img src={thumbSrc} alt="" className="thumb-img" />
      ) : (
        <div className="thumb-video-placeholder">
          <Play size={18} />
        </div>
      )}
    </>
  );
}

export default function SortablePlaylistItem({
  item,
  onDelete,
  onToggle,
  onDurationChange,
  onPreview,
  localDuration,
  onDurationEdit,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mediaSrc = `/uploads${item.filePath}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`item-row${isDragging ? ' dnd-dragging' : ''}${!item.enabled ? ' disabled-item' : ''}`}
    >
      {/* Drag handle */}
      <div className="drag-handle" {...attributes} {...listeners} title="Arrastrar para reordenar">
        <GripVertical size={16} />
      </div>

      {/* Thumbnail (clickable to open modal) */}
      <button
        className="thumb-btn"
        onClick={onPreview}
        title="Ver vista previa"
        type="button"
      >
        {item.type === 'image' ? (
          <img
            src={mediaSrc}
            alt={item.originalName}
            className="thumb-img"
          />
        ) : (
          <VideoThumbnail src={mediaSrc} />
        )}
        <div className="thumb-overlay">
          <Eye size={16} />
        </div>
        {item.type === 'video' && (
          <div className="thumb-play-badge">
            <Play size={8} />
          </div>
        )}
      </button>

      {/* Info */}
      <div className="item-info">
        <div className="item-name" title={item.originalName}>
          {item.originalName}
        </div>
        <div className="item-meta">
          <span className={`badge ${item.type === 'image' ? 'badge-img' : 'badge-vid'}`}>
            {item.type === 'image' ? 'IMG' : 'VID'}
          </span>
          <span>{formatBytes(item.size)}</span>
        </div>
      </div>

      {/* Duration */}
      {item.type === 'image' ? (
        <div className="item-duration">
          <input
            type="number"
            min="1"
            max="300"
            value={localDuration ?? item.durationSeconds}
            onChange={e => onDurationEdit(item.id, e.target.value)}
            onBlur={e => onDurationChange(item, e.target.value)}
            title="Duración en segundos"
            aria-label="Duración en segundos"
          />
          <span className="item-duration-label">seg</span>
        </div>
      ) : (
        <span className="item-duration-full">Duración completa</span>
      )}

      {/* Actions */}
      <div className="item-actions">
        <button
          className="btn-icon"
          onClick={() => onToggle(item)}
          title={item.enabled ? 'Desactivar' : 'Activar'}
          type="button"
          style={{ color: item.enabled ? 'var(--success)' : 'var(--text-faint)' }}
        >
          {item.enabled ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
        <button
          className="btn-icon btn-icon-danger"
          onClick={() => onDelete(item)}
          title="Eliminar"
          type="button"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
