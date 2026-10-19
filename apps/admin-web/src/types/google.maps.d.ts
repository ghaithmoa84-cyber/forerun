declare namespace google.maps {
  interface LatLngLiteral {
    lat: number;
    lng: number;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    lat(): number;
    lng(): number;
  }

  interface MapOptions {
    center?: LatLngLiteral | LatLng;
    zoom?: number;
    mapTypeControl?: boolean;
    streetViewControl?: boolean;
    fullscreenControl?: boolean;
    zoomControl?: boolean;
    [key: string]: unknown;
  }

  interface MarkerOptions {
    position: LatLngLiteral | LatLng;
    map?: Map;
    title?: string;
    icon?: string | unknown;
    [key: string]: unknown;
  }

  class Marker {
    constructor(opts?: MarkerOptions);
    setMap(map: Map | null): void;
    setPosition(latLng: LatLngLiteral | LatLng): void;
    setTitle(title: string): void;
    addListener(event: string, handler: (...args: unknown[]) => void): unknown;
  }

  interface InfoWindowOptions {
    content?: string | Node;
    [key: string]: unknown;
  }

  class InfoWindow {
    constructor(opts?: InfoWindowOptions);
    open(options?: { anchor?: Marker; map?: Map } | Map): void;
    close(): void;
    setContent(content: string | Node): void;
  }

  class Map {
    constructor(mapDiv: HTMLElement, opts?: MapOptions);
    setCenter(latLng: LatLngLiteral | LatLng): void;
    setZoom(zoom: number): void;
  }
}

declare namespace google {
  export import maps = google.maps;
}

interface Window {
  google?: typeof google;
}
