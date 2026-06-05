"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Bed,
  Bath,
  Maximize2,
  Calendar,
  Building2,
  PawPrint,
} from "lucide-react";
import type { PropertyDoc } from "@/types";

interface PropertyModalProps {
  property: PropertyDoc | null;
  onClose: () => void;
}

function formatPrice(property: PropertyDoc): string {
  if (property.listing_type === "rental" && property.price_per_month) {
    return `$${property.price_per_month.toLocaleString()}/mo`;
  }
  if (property.listing_type === "sale" && property.price) {
    return `$${property.price.toLocaleString()}`;
  }
  return "Price on request";
}

function formatPsf(property: PropertyDoc): string | null {
  if (property.listing_type === "rental" && property.psf_per_month) {
    return `$${property.psf_per_month.toFixed(2)}/sqft/mo`;
  }
  if (property.listing_type === "sale" && property.price_per_sqft) {
    return `$${property.price_per_sqft.toLocaleString()}/sqft`;
  }
  return null;
}

export function PropertyModal({ property, onClose }: PropertyModalProps) {
  if (!property) return null;

  const isRental = property.listing_type === "rental";
  const isHdb = property.property_category === "hdb";
  const psf = formatPsf(property);

  return (
    <Dialog open={!!property} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-2 pr-4">
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base leading-snug">
                {property.property_name ?? property.address}
              </DialogTitle>
              <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{property.address}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={isRental ? "default" : "secondary"}>
            {isRental ? "Rental" : "For Sale"}
          </Badge>
          <Badge variant="outline">{isHdb ? "HDB" : "Private"}</Badge>
          {property.flat_type && (
            <Badge variant="outline">{property.flat_type}</Badge>
          )}
          {property.unit_type && (
            <Badge variant="outline">{property.unit_type}</Badge>
          )}
          <Badge variant="outline">{property.town}</Badge>
        </div>

        {/* Price */}
        <div>
          <span className="text-2xl font-bold">{formatPrice(property)}</span>
          {psf && (
            <span className="text-sm text-muted-foreground ml-2">{psf}</span>
          )}
        </div>

        <Separator />

        {/* Key facts */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Bed className="h-4 w-4 text-muted-foreground" />
            <span>{property.bedrooms} Bedroom{property.bedrooms !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <Bath className="h-4 w-4 text-muted-foreground" />
            <span>{property.bathrooms} Bathroom{property.bathrooms !== 1 ? "s" : ""}</span>
          </div>
          <div className="flex items-center gap-2">
            <Maximize2 className="h-4 w-4 text-muted-foreground" />
            <span>{property.size_sqft.toLocaleString()} sqft</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>{property.floor_level}</span>
          </div>
        </div>

        <Separator />

        {/* Details */}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Furnishing</dt>
            <dd className="font-medium">{property.furnishing}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Tenure</dt>
            <dd className="font-medium">{property.tenure}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Built year</dt>
            <dd className="font-medium">{property.built_year}</dd>
          </div>
          {property.hdb_estate && (
            <div>
              <dt className="text-muted-foreground text-xs">Estate</dt>
              <dd className="font-medium">{property.hdb_estate}</dd>
            </div>
          )}
          {isRental && property.available_from && (
            <div>
              <dt className="text-muted-foreground text-xs">Available from</dt>
              <dd className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {property.available_from}
              </dd>
            </div>
          )}
          {isRental && property.min_lease_months && (
            <div>
              <dt className="text-muted-foreground text-xs">Min lease</dt>
              <dd className="font-medium">{property.min_lease_months} months</dd>
            </div>
          )}
          {isRental && property.pets_allowed !== undefined && (
            <div>
              <dt className="text-muted-foreground text-xs">Pets</dt>
              <dd className="font-medium flex items-center gap-1">
                <PawPrint className="h-3.5 w-3.5" />
                {property.pets_allowed ? "Allowed" : "Not allowed"}
              </dd>
            </div>
          )}
          {!isRental && property.remaining_lease_years && (
            <div>
              <dt className="text-muted-foreground text-xs">Remaining lease</dt>
              <dd className="font-medium">{property.remaining_lease_years} years</dd>
            </div>
          )}
          {!isRental && property.hdb_grant_eligible && (
            <div>
              <dt className="text-muted-foreground text-xs">HDB grant</dt>
              <dd className="font-medium">Eligible</dd>
            </div>
          )}
        </dl>

        {/* Facilities (private rental) */}
        {property.facilities && property.facilities.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-xs text-muted-foreground mb-2">Facilities</p>
              <div className="flex flex-wrap gap-1.5">
                {property.facilities.map((f) => (
                  <Badge key={f} variant="secondary" className="text-xs">
                    {f}
                  </Badge>
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
