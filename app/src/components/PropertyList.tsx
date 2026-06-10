"use client";

import { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bed, Bath, Maximize2, MapPin, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyDoc } from "@/types";

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortOrder =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "psf_asc"
  | "psf_desc"
  | "size_asc"
  | "size_desc";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price (lowest first)" },
  { value: "price_desc", label: "Price (highest first)" },
  { value: "psf_asc", label: "PSF (lowest)" },
  { value: "psf_desc", label: "PSF (highest)" },
  { value: "size_asc", label: "Size (smallest)" },
  { value: "size_desc", label: "Size (largest)" },
];

function getPrice(p: PropertyDoc): number {
  if (p.listing_type === "rental") return p.price_per_month ?? Infinity;
  return p.price ?? Infinity;
}

function getPsf(p: PropertyDoc): number {
  const v =
    p.listing_type === "rental" ? p.psf_per_month : p.price_per_sqft;
  return v != null && v > 0 ? v : Infinity;
}

function sortProperties(
  properties: PropertyDoc[],
  order: SortOrder
): PropertyDoc[] {
  if (order === "recommended") return properties;
  const arr = [...properties];
  switch (order) {
    case "price_asc":
      return arr.sort((a, b) => getPrice(a) - getPrice(b));
    case "price_desc":
      return arr.sort((a, b) => getPrice(b) - getPrice(a));
    case "psf_asc":
      return arr.sort((a, b) => getPsf(a) - getPsf(b));
    case "psf_desc":
      return arr.sort((a, b) => getPsf(b) - getPsf(a));
    case "size_asc":
      return arr.sort((a, b) => a.size_sqft - b.size_sqft);
    case "size_desc":
      return arr.sort((a, b) => b.size_sqft - a.size_sqft);
  }
}

// ─── Recommendation logic ────────────────────────────────────────────────────

type RecommendationReason = "Best Value" | "Newly Built" | "Extra Spacious";

const REASON_STYLES: Record<
  RecommendationReason,
  { className: string; ring: string }
> = {
  "Best Value": {
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
    ring: "ring-emerald-400",
  },
  "Newly Built": {
    className: "bg-sky-50 text-sky-700 border-sky-200",
    ring: "ring-sky-400",
  },
  "Extra Spacious": {
    className: "bg-violet-50 text-violet-700 border-violet-200",
    ring: "ring-violet-400",
  },
};

// Pick the ring color from the first (highest-priority) reason
const REASON_PRIORITY: RecommendationReason[] = [
  "Best Value",
  "Newly Built",
  "Extra Spacious",
];

function computeRecommendations(
  properties: PropertyDoc[]
): Map<string, RecommendationReason[]> {
  const result = new Map<string, RecommendationReason[]>();

  function addReason(id: string, reason: RecommendationReason) {
    const reasons = result.get(id) ?? [];
    // maintain priority order
    reasons.push(reason);
    reasons.sort(
      (a, b) => REASON_PRIORITY.indexOf(a) - REASON_PRIORITY.indexOf(b)
    );
    result.set(id, reasons);
  }

  // 1. Best Value — PSF at least 15% below the median for current results
  const psfs = properties
    .map((p) =>
      p.listing_type === "rental" ? p.psf_per_month : p.price_per_sqft
    )
    .filter((v): v is number => v != null && v > 0);

  if (psfs.length >= 3) {
    const sorted = [...psfs].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold = median * 0.85;

    for (const p of properties) {
      const psf =
        p.listing_type === "rental" ? p.psf_per_month : p.price_per_sqft;
      if (psf != null && psf > 0 && psf <= threshold) {
        addReason(p._id, "Best Value");
      }
    }
  }

  // 2. Newly Built — built in the last 6 years (≥ 2020)
  const RECENT_THRESHOLD = 2020;
  for (const p of properties) {
    if (p.built_year >= RECENT_THRESHOLD) {
      addReason(p._id, "Newly Built");
    }
  }

  // 3. Extra Spacious — top 20th-percentile sqft within same bedroom count
  //    (only meaningful when there are ≥ 3 properties with that bedroom count)
  const byBedrooms = new Map<number, number[]>();
  for (const p of properties) {
    const arr = byBedrooms.get(p.bedrooms) ?? [];
    arr.push(p.size_sqft);
    byBedrooms.set(p.bedrooms, arr);
  }

  const p80ByBedrooms = new Map<number, number>();
  for (const [beds, sizes] of byBedrooms) {
    if (sizes.length < 3) continue;
    const s = [...sizes].sort((a, b) => a - b);
    p80ByBedrooms.set(beds, s[Math.floor(s.length * 0.8)]);
  }

  for (const p of properties) {
    const threshold = p80ByBedrooms.get(p.bedrooms);
    if (threshold != null && p.size_sqft >= threshold) {
      addReason(p._id, "Extra Spacious");
    }
  }

  return result;
}

// ─── Formatting ──────────────────────────────────────────────────────────────

function formatPrice(p: PropertyDoc): string {
  if (p.listing_type === "rental" && p.price_per_month) {
    return `$${p.price_per_month.toLocaleString()}/mo`;
  }
  if (p.listing_type === "sale" && p.price) {
    return `$${(p.price / 1000).toFixed(0)}K`;
  }
  return "—";
}

// ─── PropertyCard ─────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  isSelected,
  recommendationReasons,
  onClick,
}: {
  property: PropertyDoc;
  isSelected: boolean;
  recommendationReasons: RecommendationReason[];
  onClick: () => void;
}) {
  const isHdb = property.property_category === "hdb";
  const isRecommended = recommendationReasons.length > 0;
  const primaryReason = recommendationReasons[0];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50",
        isSelected && "border-primary bg-primary/5",
        isRecommended && !isSelected && [
          "ring-2",
          REASON_STYLES[primaryReason].ring,
        ]
      )}
    >
      {/* Recommendation reason badges */}
      {isRecommended && (
        <div className="flex items-center gap-1 flex-wrap mb-2">
          <Star className="h-3 w-3 text-amber-500 fill-amber-400 flex-shrink-0" />
          {recommendationReasons.map((reason) => (
            <span
              key={reason}
              className={cn(
                "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                REASON_STYLES[reason].className
              )}
            >
              {reason}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">
            {property.property_name ?? property.address}
          </p>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{property.town}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-semibold text-sm">{formatPrice(property)}</p>
          <p className="text-xs text-muted-foreground">
            {property.size_sqft.toLocaleString()} sqft
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bed className="h-3 w-3" />
          <span>{property.bedrooms}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Bath className="h-3 w-3" />
          <span>{property.bathrooms}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Maximize2 className="h-3 w-3" />
          <span>{property.size_sqft.toLocaleString()} sqft</span>
        </div>
        <div className="ml-auto flex gap-1">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] h-4 px-1.5",
              property.listing_type === "rental"
                ? "border-blue-200 text-blue-700 bg-blue-50"
                : "border-green-200 text-green-700 bg-green-50"
            )}
          >
            {property.listing_type === "rental" ? "Rent" : "Sale"}
          </Badge>
          <Badge variant="outline" className="text-[10px] h-4 px-1.5">
            {isHdb ? "HDB" : "Private"}
          </Badge>
        </div>
      </div>

      {property.furnishing && (
        <p className="text-[11px] text-muted-foreground mt-1.5">
          {property.furnishing}
          {property.floor_level && ` · ${property.floor_level}`}
        </p>
      )}
    </button>
  );
}

// ─── PropertyList ─────────────────────────────────────────────────────────────

interface PropertyListProps {
  properties: PropertyDoc[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (property: PropertyDoc) => void;
}

export function PropertyList({
  properties,
  selectedId,
  isLoading,
  onSelect,
}: PropertyListProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("recommended");

  const recommendationMap = useMemo(
    () => computeRecommendations(properties),
    [properties]
  );

  const { recommended, regular } = useMemo(() => {
    const MAX_RECOMMENDED = 3;

    const candidates = properties
      .map((p) => ({ p, reasons: recommendationMap.get(p._id) ?? [] }))
      .filter(({ reasons }) => reasons.length > 0)
      .sort((a, b) => b.reasons.length - a.reasons.length)
      .slice(0, MAX_RECOMMENDED);

    const recommendedIds = new Set(candidates.map(({ p }) => p._id));

    const rec = candidates.map(({ p }) => p);
    const reg = properties.filter((p) => !recommendedIds.has(p._id));

    return { recommended: rec, regular: reg };
  }, [properties, recommendationMap]);

  const sortedAll = useMemo(
    () => sortProperties(properties, sortOrder),
    [properties, sortOrder]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-xs text-muted-foreground">Sort by</span>
          <SortSelect value={sortOrder} onChange={setSortOrder} />
        </div>
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          No properties match the current filters.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sort bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {properties.length} listing{properties.length !== 1 ? "s" : ""}
        </span>
        <SortSelect value={sortOrder} onChange={setSortOrder} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="p-3 space-y-2">
          {sortOrder === "recommended" ? (
            <>
              {/* Recommended section */}
              {recommended.length > 0 && (
                <>
                  <div className="flex items-center gap-1.5 px-0.5 pt-1 pb-0.5">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-400" />
                    <span className="text-xs font-semibold text-foreground">
                      Recommended
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({recommended.length})
                    </span>
                  </div>
                  {recommended.map((p) => (
                    <PropertyCard
                      key={p._id}
                      property={p}
                      isSelected={p._id === selectedId}
                      recommendationReasons={
                        recommendationMap.get(p._id) ?? []
                      }
                      onClick={() => onSelect(p)}
                    />
                  ))}
                  {regular.length > 0 && (
                    <div className="flex items-center gap-2 px-0.5 pt-2 pb-0.5">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-xs text-muted-foreground">
                        All listings ({regular.length})
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                </>
              )}

              {/* Regular listings */}
              {regular.map((p) => (
                <PropertyCard
                  key={p._id}
                  property={p}
                  isSelected={p._id === selectedId}
                  recommendationReasons={[]}
                  onClick={() => onSelect(p)}
                />
              ))}
            </>
          ) : (
            /* Sorted flat list */
            sortedAll.map((p) => (
              <PropertyCard
                key={p._id}
                property={p}
                isSelected={p._id === selectedId}
                recommendationReasons={recommendationMap.get(p._id) ?? []}
                onClick={() => onSelect(p)}
              />
            ))
          )}
        </div>
      </ScrollArea>
      </div>
    </div>
  );
}

// ─── SortSelect ───────────────────────────────────────────────────────────────

function SortSelect({
  value,
  onChange,
}: {
  value: SortOrder;
  onChange: (v: SortOrder) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortOrder)} items={SORT_OPTIONS}>
      <SelectTrigger size="sm" className="w-[160px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value} className="text-xs">
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
