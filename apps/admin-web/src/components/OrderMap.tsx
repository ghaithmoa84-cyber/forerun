'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface OrderMapProps {
  lat: number;
  lng: number;
  description?: string;
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

export function OrderMap({ lat, lng, description }: OrderMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerInstanceRef = useRef<google.maps.Marker | null>(null);
  const infoWindowInstanceRef = useRef<google.maps.InfoWindow | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

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
        data-testid="order-map-fallback"
        className="w-full h-72 rounded-xl overflow-hidden shadow-xs border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center"
      >
        <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 mb-3">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-bold text-slate-800 mb-1" data-testid="map-description">
          {description || 'موقع تسليم الطلب'}
        </p>
        <p className="text-xs text-slate-500 font-mono mb-3" data-testid="map-coordinates">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </p>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors"
        >
          <span>عرض على Google Maps</span>
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    );
  }

  return (
    <div
      ref={mapContainerRef}
      data-testid="order-map-container"
      className="w-full h-72 rounded-xl overflow-hidden shadow-xs border border-slate-200 z-0"
    />
  );
}
