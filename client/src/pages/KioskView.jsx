import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';

const POLL_INTERVAL = 30000; // 30 segundos

export default function KioskView() {
  const { slug } = useParams();

  const [kiosk, setKiosk] = useState(null);
  const [items, setItems] = useState([]);
  const [notFound, setNotFound] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);

  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const itemsRef = useRef([]);
  const indexRef = useRef(0);

  // Cargar datos del kiosko
  const fetchKiosk = useCallback(async (isPolling = false) => {
    try {
      const res = await fetch(`/api/public/kiosk/${slug}`);
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) return;
      const data = await res.json();

      const newItems = data.items || [];

      if (isPolling) {
        // Comparar IDs para ver si el playlist cambió
        const oldIds = itemsRef.current.map(i => i.id).join(',');
        const newIds = newItems.map(i => i.id).join(',');
        if (oldIds !== newIds) {
          // Playlist cambió: resetear al inicio
          itemsRef.current = newItems;
          setItems(newItems);
          goTo(0, newItems);
        }
      } else {
        itemsRef.current = newItems;
        setKiosk(data);
        setItems(newItems);
      }
    } catch (e) {
      // Silencioso en polling
      if (!isPolling) setNotFound(true);
    }
  }, [slug]);

  useEffect(() => {
    fetchKiosk(false);

    const pollId = setInterval(() => fetchKiosk(true), POLL_INTERVAL);
    return () => clearInterval(pollId);
  }, [fetchKiosk]);

  // Ir a un índice concreto con fade
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

  function advance() {
    goTo(indexRef.current + 1);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  // Cuando cambia el item actual, programar el avance si es imagen
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex];
    if (!item) return;

    if (item.type === 'image') {
      clearTimer();
      timerRef.current = setTimeout(() => advance(), (item.durationSeconds || 5) * 1000);
    }
    // Para video el avance se maneja en onEnded

    return () => clearTimer();
  }, [currentIndex, items]);

  // Cuando el índice cambia y hay un video, intentar reproducirlo
  useEffect(() => {
    if (items.length === 0) return;
    const item = items[currentIndex];
    if (item?.type === 'video' && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [currentIndex, items]);

  function handleVideoEnded() {
    advance();
  }

  function handleVideoError() {
    // Si el video falla, saltar al siguiente
    advance();
  }

  function handleImageError(e) {
    // Si la imagen falla, saltar al siguiente
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
  const mediaSrc = `/uploads${item.filePath}`;

  return (
    <div className="player-fullscreen">
      {item.type === 'image' ? (
        <img
          key={item.id}
          src={mediaSrc}
          alt=""
          className={`player-media ${fade ? 'player-fade' : ''}`}
          onError={handleImageError}
          style={{ objectFit: 'cover' }}
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
          onEnded={handleVideoEnded}
          onError={handleVideoError}
          style={{ objectFit: 'cover' }}
        >
          <source src={mediaSrc} type={item.mimeType} />
        </video>
      )}
    </div>
  );
}
