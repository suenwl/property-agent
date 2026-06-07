"use client";

import { useEffect, useRef, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelectFilter } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, SlidersHorizontal, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FilterState } from "@/types";

const CURRENT_YEAR = new Date().getFullYear();

interface YearRangeFilterProps {
  minYear: number | null;
  maxYear: number | null;
  onChange: (min: number | null, max: number | null) => void;
}

function YearRangeFilter({ minYear, maxYear, onChange }: YearRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const hasValue = minYear !== null || maxYear !== null;

  let label = "Completion year";
  if (minYear !== null && maxYear !== null) label = `${minYear}–${maxYear}`;
  else if (minYear !== null) label = `From ${minYear}`;
  else if (maxYear !== null) label = `Up to ${maxYear}`;

  function handleMinChange(raw: string) {
    const val = raw === "" ? null : Math.max(1900, Math.min(CURRENT_YEAR + 10, Number(raw)));
    onChange(val, maxYear);
  }

  function handleMaxChange(raw: string) {
    const val = raw === "" ? null : Math.max(1900, Math.min(CURRENT_YEAR + 10, Number(raw)));
    onChange(minYear, val);
  }

  return (
    <div ref={containerRef} className="relative w-[150px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-7 py-2 pr-2 pl-2.5 text-xs flex items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent whitespace-nowrap transition-colors outline-none select-none w-full cursor-default"
      >
        <span className={cn("truncate flex-1 text-left", !hasValue && "text-muted-foreground")}>
          {label}
        </span>
        {hasValue ? (
          <X
            className="size-4 shrink-0 text-muted-foreground pointer-events-auto cursor-default"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null, null);
            }}
          />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground pointer-events-none" />
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-popover text-popover-foreground rounded-lg shadow-md ring-1 ring-foreground/10 p-3 w-48">
          <p className="text-xs font-medium text-muted-foreground mb-2">Completion year</p>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">From</label>
              <input
                type="number"
                min={1900}
                max={CURRENT_YEAR + 10}
                placeholder="e.g. 2000"
                value={minYear ?? ""}
                onChange={(e) => handleMinChange(e.target.value)}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">To</label>
              <input
                type="number"
                min={1900}
                max={CURRENT_YEAR + 10}
                placeholder={`e.g. ${CURRENT_YEAR}`}
                value={maxYear ?? ""}
                onChange={(e) => handleMaxChange(e.target.value)}
                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const TOWNS = [
  "Ang Mo Kio", "Bedok", "Bishan", "Bukit Batok", "Bukit Merah",
  "Bukit Panjang", "Bukit Timah", "Clementi", "Geylang", "Hougang",
  "Jurong East", "Jurong West", "Kallang", "Marine Parade",
  "Pasir Ris", "Punggol", "Queenstown", "Sembawang", "Sengkang",
  "Serangoon", "Tampines", "Toa Payoh", "Woodlands", "Yishun",
  "Newton", "Novena", "Orchard", "Rochor",
].sort();

const HDB_FLAT_TYPES = [
  "2-Room Flexi", "3-Room", "4-Room", "5-Room", "Executive",
];

interface FiltersPanelProps {
  filters: FilterState;
  resultCount: number | null;
  onFilterChange: (filters: FilterState) => void;
  onClearFilters: () => void;
}

export function FiltersPanel({
  filters,
  resultCount,
  onFilterChange,
  onClearFilters,
}: FiltersPanelProps) {
  function update(partial: Partial<FilterState>) {
    onFilterChange({ ...filters, ...partial });
  }

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== null && !(Array.isArray(v) && v.length === 0)
  );

  return (
    <div className="border-b bg-background">
      <div className="px-4 py-2.5 flex items-center gap-2 flex-wrap">
        <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

        {/* Listing type */}
        <Select
          value={filters.listing_type ?? ""}
          onValueChange={(v) =>
            update({ listing_type: v === "" ? null : (v as FilterState["listing_type"]) })
          }
        >
          <SelectTrigger className="h-7 text-xs w-[110px]">
            <SelectValue placeholder="Listing type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="rental">Rental</SelectItem>
            <SelectItem value="sale">For Sale</SelectItem>
          </SelectContent>
        </Select>

        {/* Property category */}
        <Select
          value={filters.property_category ?? ""}
          onValueChange={(v) =>
            update({ property_category: v === "" ? null : (v as FilterState["property_category"]) })
          }
        >
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue placeholder="Property type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">HDB &amp; Private</SelectItem>
            <SelectItem value="hdb">HDB</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>

        {/* Bedrooms */}
        <Select
          value={filters.bedrooms_min != null ? String(filters.bedrooms_min) : ""}
          onValueChange={(v) =>
            update({ bedrooms_min: v === "" ? null : Number(v) })
          }
        >
          <SelectTrigger className="h-7 text-xs w-[120px]">
            <SelectValue placeholder="Bedrooms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any bedrooms</SelectItem>
            <SelectItem value="1">1+ bed</SelectItem>
            <SelectItem value="2">2+ beds</SelectItem>
            <SelectItem value="3">3+ beds</SelectItem>
            <SelectItem value="4">4+ beds</SelectItem>
            <SelectItem value="5">5+ beds</SelectItem>
          </SelectContent>
        </Select>

        {/* Max rent (only when listing_type is rental or null) */}
        {filters.listing_type !== "sale" && (
          <Select
            value={filters.price_per_month_max != null ? String(filters.price_per_month_max) : ""}
            onValueChange={(v) =>
              update({ price_per_month_max: v === "" ? null : Number(v) })
            }
          >
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue placeholder="Max rent/month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any rent</SelectItem>
              <SelectItem value="2000">Up to $2,000</SelectItem>
              <SelectItem value="3000">Up to $3,000</SelectItem>
              <SelectItem value="4000">Up to $4,000</SelectItem>
              <SelectItem value="5000">Up to $5,000</SelectItem>
              <SelectItem value="7000">Up to $7,000</SelectItem>
              <SelectItem value="10000">Up to $10,000</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Max sale price (only when listing_type is sale) */}
        {filters.listing_type === "sale" && (
          <Select
            value={filters.price_max != null ? String(filters.price_max) : ""}
            onValueChange={(v) =>
              update({ price_max: v === "" ? null : Number(v) })
            }
          >
            <SelectTrigger className="h-7 text-xs w-[140px]">
              <SelectValue placeholder="Max sale price" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any price</SelectItem>
              <SelectItem value="500000">Up to $500K</SelectItem>
              <SelectItem value="800000">Up to $800K</SelectItem>
              <SelectItem value="1000000">Up to $1M</SelectItem>
              <SelectItem value="1500000">Up to $1.5M</SelectItem>
              <SelectItem value="2000000">Up to $2M</SelectItem>
              <SelectItem value="3000000">Up to $3M</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Town — multi-select */}
        <MultiSelectFilter
          options={TOWNS.map((t) => ({ value: t, label: t }))}
          value={filters.town ?? []}
          onChange={(v) => update({ town: v.length === 0 ? null : v })}
          placeholder="Town / Area"
          allLabel="All areas"
          countLabel="towns"
          className="w-[130px]"
        />

        {/* Furnishing — multi-select */}
        <MultiSelectFilter
          options={[
            { value: "Unfurnished", label: "Unfurnished" },
            { value: "Partially Furnished", label: "Partial" },
            { value: "Fully Furnished", label: "Fully furnished" },
          ]}
          value={filters.furnishing ?? []}
          onChange={(v) =>
            update({
              furnishing:
                v.length === 0
                  ? null
                  : (v as FilterState["furnishing"]),
            })
          }
          placeholder="Furnishing"
          allLabel="Any furnishing"
          countLabel="types"
          className="w-[140px]"
        />

        {/* HDB flat type */}
        {filters.property_category === "hdb" && (
          <Select
            value={filters.flat_type ?? ""}
            onValueChange={(v) =>
              update({ flat_type: v === "" ? null : v })
            }
          >
            <SelectTrigger className="h-7 text-xs w-[130px]">
              <SelectValue placeholder="Flat type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any flat type</SelectItem>
              {HDB_FLAT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Pets allowed */}
        {filters.listing_type !== "sale" && (
          <Select
            value={filters.pets_allowed != null ? String(filters.pets_allowed) : ""}
            onValueChange={(v) =>
              update({ pets_allowed: v === "" ? null : v === "true" })
            }
          >
            <SelectTrigger className="h-7 text-xs w-[110px]">
              <SelectValue placeholder="Pets allowed" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Pets: any</SelectItem>
              <SelectItem value="true">Pets OK</SelectItem>
              <SelectItem value="false">No pets</SelectItem>
            </SelectContent>
          </Select>
        )}

        {/* Completion year range */}
        <YearRangeFilter
          minYear={filters.built_year_min}
          maxYear={filters.built_year_max}
          onChange={(min, max) => update({ built_year_min: min, built_year_max: max })}
        />

        {/* Clear + result count */}
        <div className="ml-auto flex items-center gap-2 flex-shrink-0">
          {resultCount !== null && (
            <Badge variant="secondary" className="text-xs h-6">
              {resultCount.toLocaleString()} result{resultCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={onClearFilters}
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
