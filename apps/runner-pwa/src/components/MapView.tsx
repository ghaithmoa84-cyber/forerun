import { useEffect, useRef, useState } from 'react';

export interface MapViewProps {
  lat: number;
  lng: number;
  description: string;
}

let googleMapsPromise: Promise<typeof google> | null = null;

export function loadGoogleMapsScript(apiKey: string): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Window is not defined'));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]'
    );

    if (existingScript) {
      if (window.google?.maps) {
        resolve(window.google);
        return;
      }
      existingScript.addEventListener('load', () => {
        if (window.google?.maps) {
          resolve(window.google);
        } else {
          reject(new Error('Google Maps script loaded but window.google.maps is undefined'));
        }
      });
      existingScript.addEventListener('error', (err) => reject(err));
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.maps) {
        resolve(window.google);
      } else {
        reject(new Error('Google Maps script loaded but window.google.maps is undefined'));
      }
    };
    script.onerror = (err) => {
      googleMapsPromise = null;
      reject(err);
    };
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

export function MapView({ lat, lng, description }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);
  const infoWindowInstanceRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

  useEffect(() => {
    if (!mapContainerRef.current || typeof window === 'undefined') return;

    if (!apiKey) {
      setLoadError('مفتاح Google Maps غير مضبوط');
      return;
    }

    let isMounted = true;

    loadGoogleMapsScript(apiKey)
      .then((googleInstance) => {
        if (!isMounted || !mapContainerRef.current) return;

        const position = { lat, lng };

        if (!mapInstanceRef.current) {
          const map = new googleInstance.maps.Map(mapContainerRef.current, {
            center: position,
            zoom: 15,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });
          mapInstanceRef.current = map;

          const marker = new googleInstance.maps.Marker({
            position,
            map,
            title: description || 'موقع تسليم الطلب',
          });
          markerInstanceRef.current = marker;

          const infoWindow = new googleInstance.maps.InfoWindow({
            content: `<div dir="rtl" style="font-family: inherit; font-size: 13px; font-weight: 600; padding: 4px; color: #1e293b;">${
              description || 'موقع تسليم الطلب'
            }</div>`,
          });
          infoWindowInstanceRef.current = infoWindow;
          infoWindow.open({ anchor: marker, map });

          marker.addListener('click', () => {
            infoWindow.open({ anchor: marker, map });
          });
        } else {
          mapInstanceRef.current.setCenter(position);
          if (markerInstanceRef.current) {
            markerInstanceRef.current.setPosition(position);
            markerInstanceRef.current.setTitle(description || 'موقع تسليم الطلب');
          }
          if (infoWindowInstanceRef.current) {
            infoWindowInstanceRef.current.setContent(
              `<div dir="rtl" style="font-family: inherit; font-size: 13px; font-weight: 600; padding: 4px; color: #1e293b;">${
                description || 'موقع تسليم الطلب'
              }</div>`
            );
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(err instanceof Error ? err.message : 'تعذر تحميل خرائط غوغل');
      });

    return () => {
      isMounted = false;
    };
  }, [lat, lng, description, apiKey]);

  if (loadError) {
    return (
      <div
        data-testid="runner-map-fallback"
        className="map-container"
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8fafc',
          padding: '16px',
          textAlign: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#f0fdfa',
            border: '1px solid #ccfbf1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#0d9488',
            marginBottom: '8px',
          }}
        >
          📍
        </div>
        <p
          data-testid="runner-map-description"
          style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}
        >
          {description || 'موقع تسليم الطلب'}
        </p>
        <p
          data-testid="runner-map-coordinates"
          style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace', margin: '0 0 10px 0' }}
        >
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#0f766e',
            backgroundColor: '#f0fdfa',
            border: '1px solid #99f6e4',
            padding: '6px 12px',
            borderRadius: '6px',
            textDecoration: 'none',
          }}
        >
          عرض على Google Maps ↗
        </a>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      data-testid="runner-map-container"
      className="map-container"
      style={{ height: '100%', width: '100%' }}
    />
  );
}
