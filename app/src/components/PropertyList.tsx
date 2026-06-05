"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Maximize2, MapPin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PropertyDoc } from "@/types";

interface PropertyListProps {
  properties: PropertyDoc[];
  selectedId: string | null;
  isLoading: boolean;
  onSelect: (property: PropertyDoc) => void;
}

function formatPrice(p: PropertyDoc): string {
  if (p.listing_type === "rental" && p.price_per_month) {
    return `$${p.price_per_month.toLocaleString()}/mo`;
  }
  if (p.listing_type === "sale" && p.price) {
    return `$${(p.price / 1000).toFixed(0)}K`;
  }
  return "—";
}

function PropertyCard({
  property,
  isSelected,
  onClick,
}: {
  property: PropertyDoc;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isHdb = property.property_category === "hdb";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-lg border p-3 transition-colors hover:bg-muted/50",
        isSelected && "border-primary bg-primary/5"
      )}
    >
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

export function PropertyList({
  properties,
  selectedId,
  isLoading,
  onSelect,
}: PropertyListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No properties match the current filters.
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {properties.map((p) => (
          <PropertyCard
            key={p._id}
            property={p}
            isSelected={p._id === selectedId}
            onClick={() => onSelect(p)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
