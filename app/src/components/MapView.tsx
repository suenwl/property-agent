"use client";

import { useEffect, useRef } from "react";
import type { PropertyDoc } from "@/types";

// Leaflet must only run in the browser — dynamic import guards SSR
let L: typeof import("leaflet") | null = null;

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  L = require("leaflet");
  // Patch default marker icon paths broken by webpack
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const icons = require("leaflet/dist/images/marker-icon.png");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const icons2x = require("leaflet/dist/images/marker-icon-2x.png");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const shadow = require("leaflet/dist/images/marker-shadow.png");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L!.Icon.Default.prototype as any)._getIconUrl;
  L!.Icon.Default.mergeOptions({
    iconUrl: icons.default ?? icons,
    iconRetinaUrl: icons2x.default ?? icons2x,
    shadowUrl: shadow.default ?? shadow,
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
  const propertiesRef = useRef(properties);
  const onSelectRef = useRef(onSelect);

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

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
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
      }
    }

    // Add new markers
    for (const property of properties) {
      if (markersRef.current.has(property._id)) continue;

      const { lat, lon } = property.location;
      const marker = L.marker([lat, lon]);

      const isRental = property.listing_type === "rental";
      const price = isRental && property.price_per_month
        ? `$${property.price_per_month.toLocaleString()}/mo`
        : property.price
        ? `$${(property.price / 1000).toFixed(0)}K`
        : "";

      marker.bindPopup(`
        <div style="min-width:160px">
          <strong style="font-size:13px">${property.property_name ?? property.address}</strong>
          <br/><span style="color:#666;font-size:12px">${property.town}</span>
          <br/><strong style="color:#222;font-size:13px">${price}</strong>
          <br/><span style="font-size:12px">${property.bedrooms} bed · ${property.bathrooms} bath · ${property.size_sqft.toLocaleString()} sqft</span>
        </div>
      `);

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
  }, [properties]);

  // Highlight selected marker
  useEffect(() => {
    if (!L) return;

    const selectedIcon = L.divIcon({
      className: "",
      html: `<div style="width:20px;height:20px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
    const defaultIcon = new L.Icon.Default();

    for (const [id, marker] of markersRef.current.entries()) {
      marker.setIcon(id === selectedId ? selectedIcon : defaultIcon);
      if (id === selectedId) {
        marker.openPopup();
        mapRef.current?.panTo(marker.getLatLng(), { animate: true });
      }
    }
  }, [selectedId]);

  return <div ref={containerRef} className="w-full h-full" />;
}
