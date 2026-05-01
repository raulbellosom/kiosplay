import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const POLL_INTERVAL = 30000;

function cacheKey(slug) {
  return `kiosk-cache:${slug}`;
}

function readCachedKiosk(slug) {
  try {
    const raw = window.localStorage.getItem(cacheKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCachedKiosk(slug, data) {
  try {
    window.localStorage.setItem(cacheKey(slug), JSON.stringify(data));
  } catch {
    // Storage can be disabled or full; playback should continue online.
  }
}

function playlistSignature(items) {
  return (items || [])
    .map(item => [
      item.id,
      item.filePath,
      item.durationSeconds,
      item.sortOrder,
      item.updatedAt,
      item.enabled,
    ].join(':'))
    .join('|');
}

function mediaUrl(item) {
  return `/uploads${item.filePath}`;
}

function precachePlaylist(items) {
  if (!('serviceWorker' in navigator)) return;

  const urls = (items || []).map(mediaUrl);
  if (urls.length === 0) return;

  const message = { type: 'PRECACHE_MEDIA', urls };
  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return;
  }

  navigator.serviceWorker.ready
    .then(registration => registration.active?.postMessage(message))
    .catch(() => {});
}

export default function KioskView() {
  const { slug } = useParams();
  const cachedKiosk = readCachedKiosk(slug);

  const [kiosk, setKiosk] = useState(cachedKiosk);
  const [items, setItems] = useState(cachedKiosk?.items || []);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const itemsRef = useRef(cachedKiosk?.items || []);
  const indexRef = useRef(0);
  const kioskRef = useRef(cachedKiosk);

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function goTo(index, itemsOverride) {
    const list = itemsOverride || itemsRef.current;
    if (list.length === 0) return;
    const next = index % list.length;
    clearTimer();
    setFade(false);
    setTimeout(() => {
      indexRef.current = next;
      setCurrentIndex(next);
      setFade(true);
    }, 300);
  }

  const fetchKiosk = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch(`/api/public/kiosk/${slug}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) throw new Error('Kiosko no disponible');

      const data = await res.json();
      const newItems = data.items || [];

      writeCachedKiosk(slug, data);
      precachePlaylist(newItems);
      setNotFound(false);
      kioskRef.current = data;
      setKiosk(data);

      if (isPolling) {
        if (playlistSignature(itemsRef.current) !== playlistSignature(newItems)) {
          itemsRef.current = newItems;
          setItems(newItems);
          goTo(0, newItems);
        }
      } else {
        itemsRef.current = newItems;
        setItems(newItems);
      }
    } catch {
      const cached = readCachedKiosk(slug);
      if (cached && !isPolling) {
        const cachedItems = cached.items || [];
        itemsRef.current = cachedItems;
        kioskRef.current = cached;
        setKiosk(cached);
        setItems(cachedItems);
        setNotFound(false);
      } else if (!isPolling && !kioskRef.current) {
        setNotFound(true);
      }
    }
  }, [slug]);

  useEffect(() => {
    fetchKiosk(false);

    const pollId = setInterval(() => fetchKiosk(true), POLL_INTERVAL);
    return () => clearInterval(pollId);
  }, [fetchKiosk]);

  function advance() {
    goTo(indexRef.current + 1);
  }

  useEffect(() => {
    if (items.length === 0) return undefined;
    const item = items[currentIndex];
    if (!item) return undefined;

    if (item.type === 'image') {
      clearTimer();
      timerRef.current = setTimeout(() => advance(), (item.durationSeconds || 5) * 1000);
    }

    return () => clearTimer();
  }, [currentIndex, items]);

  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex];
    if (item?.type === 'video' && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {
        setTimeout(() => {
          if (videoRef.current) videoRef.current.play().catch(() => {});
        }, 300);
      });
    }
  }, [currentIndex, items]);

  function handleVideoEnded() {
    advance();
  }

  function handleVideoError() {
    advance();
  }

  function handleImageError() {
    advance();
  }

  if (notFound) {
    return (
      <div className="player-no-content">
        Kiosko no encontrado
      </div>
    );
  }

  if (!kiosk) {
    return <div className="player-no-content" />;
  }

  if (items.length === 0) {
    return (
      <div className="player-no-content">
        Sin contenido
      </div>
    );
  }

  const item = items[currentIndex];
  const orientation = kiosk.orientation === 'landscape' ? 'landscape' : 'portrait';
  const fitMode = kiosk.fitMode === 'contain' ? 'contain' : 'cover';
  const mediaSrc = mediaUrl(item);

  return (
    <div className={`player-fullscreen player-fullscreen--${orientation}`}>
      {item.type === 'image' ? (
        <img
          key={item.id}
          src={mediaSrc}
          alt=""
          className={`player-media ${fade ? 'player-fade' : ''}`}
          onError={handleImageError}
          style={{ objectFit: fitMode }}
        />
      ) : (
        <video
          key={item.id}
          ref={videoRef}
          className={`player-media ${fade ? 'player-fade' : ''}`}
          autoPlay
          muted
          playsInline
          preload="auto"
          onCanPlay={() => { if (videoRef.current) videoRef.current.play().catch(() => {}); }}
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          style={{ objectFit: fitMode }}
        >
          <source src={mediaSrc} type={item.mimeType} />
        </video>
      )}
    </div>
  );
}
