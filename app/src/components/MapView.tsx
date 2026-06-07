"use client";

import { useEffect, useRef, useState } from "react";
import type { PropertyDoc } from "@/types";

// Leaflet must only run in the browser — dynamic import guards SSR
let L: typeof import("leaflet") | null = null;

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  L = require("leaflet");
}

// Returns the relevant price for color-coding (rental = monthly, sale = total)
function getEffectivePrice(property: PropertyDoc): number | null {
  if (property.listing_type === "rental") return property.price_per_month ?? null;
  return property.price ?? null;
}

// Maps a normalised value t ∈ [0, 1] (cheap→expensive) to a CSS hsl color
// green (120°) → orange (30°) → red (0°)
function priceToColor(t: number): string {
  const hue = Math.round(120 * (1 - t));
  return `hsl(${hue}, 80%, 40%)`;
}

function makePinIcon(L: typeof import("leaflet"), color: string, size = 16) {
  return L.divIcon({
    className: "",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// Singapore center
const SG_CENTER: [number, number] = [1.3521, 103.8198];
const DEFAULT_ZOOM = 12;

interface MapViewProps {
  properties: PropertyDoc[];
  selectedId: string | null;
  onSelect: (property: PropertyDoc) => void;
}

export function MapView({ properties, selectedId, onSelect }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<Map<string, any>>(new Map());
  // Stores the computed color for each marker so the selection effect can restore it
  const markerColorsRef = useRef<Map<string, string>>(new Map());
  const propertiesRef = useRef(properties);
  const onSelectRef = useRef(onSelect);
  // Tracks whether the Leaflet map instance is ready so the marker sync
  // effect re-runs after initialization even if `properties` hasn't changed.
  const [mapReady, setMapReady] = useState(false);

  // Keep callback ref up to date without re-running effect
  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);
  useEffect(() => { propertiesRef.current = properties; }, [properties]);

  // Initialize map once
  useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      center: SG_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(mapRef.current);

    setMapReady(true);

    // The map is often created (via the dynamic import) before its flex
    // container has finished layout, so Leaflet measures it as 0×0 and tiles
    // / markers never paint until a resize fires invalidateSize internally
    // (e.g. opening devtools). A ResizeObserver fixes this for every case.
    const observer = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      // The markers belonged to the now-destroyed map. Clear the cache so the
      // marker-sync effect re-creates them on the next map instance (important
      // for React Strict Mode's mount → unmount → remount cycle in dev).
      markersRef.current.clear();
      setMapReady(false);
    };
  }, []);

  // Sync markers when properties change
  useEffect(() => {
    if (!L || !mapRef.current) return;

    const map = mapRef.current;
    const currentIds = new Set(properties.map((p) => p._id));

    // Remove markers no longer in results
    for (const [id, marker] of markersRef.current.entries()) {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
        markerColorsRef.current.delete(id);
      }
    }

    // Compute price range per (listing_type × town) so colours reflect value
    // relative to comparable properties in the same estate and category.
    const groupBounds = new Map<string, { min: number; max: number }>();
    for (const property of properties) {
      const p = getEffectivePrice(property);
      if (p === null) continue;
      const key = `${property.listing_type}::${property.town}`;
      const g = groupBounds.get(key);
      if (!g) groupBounds.set(key, { min: p, max: p });
      else { g.min = Math.min(g.min, p); g.max = Math.max(g.max, p); }
    }

    // Add new markers (remove & re-add existing ones so colours update with new range)
    for (const property of properties) {
      // Remove stale marker so it gets recreated with the updated colour
      const existing = markersRef.current.get(property._id);
      if (existing) {
        existing.remove();
        markersRef.current.delete(property._id);
      }

      const { lat, lon } = property.location;

      const effectivePrice = getEffectivePrice(property);
      const key = `${property.listing_type}::${property.town}`;
      const g = groupBounds.get(key);
      const range = g ? (g.max - g.min || 1) : 1;
      const t = effectivePrice !== null && g ? (effectivePrice - g.min) / range : 0.5;
      const color = priceToColor(t);
      markerColorsRef.current.set(property._id, color);

      const Lib = L;
      const marker = Lib.marker([lat, lon], { icon: makePinIcon(Lib, color) });

      const isRental = property.listing_type === "rental";
      const price = isRental && property.price_per_month
        ? `$${property.price_per_month.toLocaleString()}/mo`
        : property.price
        ? `$${(property.price / 1000).toFixed(0)}K`
        : "";

      marker.bindTooltip(`
        <div style="min-width:160px">
          <strong style="font-size:13px">${property.property_name ?? property.address}</strong>
          <br/><span style="color:#666;font-size:12px">${property.town}</span>
          <br/><strong style="color:#222;font-size:13px">${price}</strong>
          <br/><span style="font-size:12px">${property.bedrooms} bed · ${property.bathrooms} bath · ${property.size_sqft.toLocaleString()} sqft</span>
        </div>
      `, { sticky: false });

      marker.on("click", () => {
        const p = propertiesRef.current.find((x) => x._id === property._id);
        if (p) onSelectRef.current(p);
      });

      marker.addTo(map);
      markersRef.current.set(property._id, marker);
    }

    // Fit bounds to all markers if we have properties
    if (properties.length > 0 && properties.length <= 200) {
      const coords = properties.map((p) => [p.location.lat, p.location.lon] as [number, number]);
      try {
        map.fitBounds(L.latLngBounds(coords), { padding: [32, 32], maxZoom: 14 });
      } catch {
        // fitBounds can fail with a single point
        const first = properties[0];
        map.setView([first.location.lat, first.location.lon], 14);
      }
    }
  }, [properties, mapReady]);

  // Highlight selected marker — keep its price colour, just make it bigger
  useEffect(() => {
    if (!L) return;
    const Lib = L;

    for (const [id, marker] of markersRef.current.entries()) {
      const color = markerColorsRef.current.get(id) ?? "hsl(60, 80%, 40%)";
      marker.setIcon(
        id === selectedId
          ? makePinIcon(Lib, color, 24)
          : makePinIcon(Lib, color, 16),
      );
      if (id === selectedId) {
        mapRef.current?.panTo(marker.getLatLng(), { animate: true });
      }
    }
  }, [selectedId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
