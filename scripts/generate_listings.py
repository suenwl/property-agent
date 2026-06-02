"""
Generate realistic Singapore property listings and save them to a JSON file.

Listing types:
  - rental_private  : Private residential rental (condo, apartment, etc.)
  - rental_hdb      : HDB flat rental
  - sale_hdb        : HDB flat for sale

Coordinates are sampled uniformly at random from within the actual GeoJSON
polygon of each planning area (Master Plan 2025), so listings are spread
naturally across the full extent of each town rather than being clustered
around an approximate centre point.

Each listing is a flat JSON object ready to be indexed into Elasticsearch.
"""

import json
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import shape, Point

# ---------------------------------------------------------------------------
# Planning-area metadata keyed by PLN_AREA_N (upper-case, as in the GeoJSON)
# ---------------------------------------------------------------------------

# Non-residential planning areas to skip even if they appear in the GeoJSON.
# These are either commercial CBDs, nature reserves, water catchments, military
# zones, ports, or offshore islands with no housing stock.
NON_RESIDENTIAL_AREAS = {
    # CA_IND = Y (confirmed commercial/civic areas)
    "DOWNTOWN CORE", "MUSEUM", "STRAITS VIEW",
    "MARINA EAST", "MARINA SOUTH", "OUTRAM",
    "ROCHORE", "SINGAPORE RIVER",
    # Nature / industrial / military / offshore
    "CENTRAL WATER CATCHMENT", "WESTERN WATER CATCHMENT",
    "MANDAI", "LIM CHU KANG", "SIMPANG", "SELETAR",
    "PIONEER", "TUAS", "BOON LAY",
    "CHANGI", "CHANGI BAY",
    "SOUTHERN ISLANDS", "WESTERN ISLANDS", "NORTH-EASTERN ISLANDS",
    "TENGAH",           # under construction, no current listings
    "PAYA LEBAR",       # airbase / commercial transition zone
}

# Per-area metadata: streets, HDB estates, private condos.
# Keys must match PLN_AREA_N values from the GeoJSON (upper-case).
AREA_METADATA: dict[str, dict] = {
    "ANG MO KIO": {
        "streets": ["Ang Mo Kio Avenue 1", "Ang Mo Kio Avenue 3",
                    "Ang Mo Kio Avenue 6", "Ang Mo Kio Street 21"],
        "hdb_estates": ["Ang Mo Kio Central", "Teck Ghee"],
        "private_condos": ["The Calrose", "AMO Residence", "Symphony Suites"],
    },
    "BEDOK": {
        "streets": ["Bedok North Avenue 1", "Bedok North Street 3",
                    "Bedok South Avenue 2", "Bedok Reservoir Road"],
        "hdb_estates": ["Bedok North", "Bedok South", "Kembangan-Chai Chee"],
        "private_condos": ["Eastwood Regency", "The Glades", "Seventy Saint Patrick's"],
    },
    "BISHAN": {
        "streets": ["Bishan Street 11", "Bishan Street 13",
                    "Bishan Street 22", "Bishan Street 23"],
        "hdb_estates": ["Bishan North", "Bishan South"],
        "private_condos": ["Sky Habitat", "Clover By The Park", "The Panorama"],
    },
    "BUKIT BATOK": {
        "streets": ["Bukit Batok West Avenue 5", "Bukit Batok Street 21",
                    "Bukit Batok East Avenue 3", "Hillview Avenue"],
        "hdb_estates": ["Bukit Batok Central", "Bukit Gombak"],
        "private_condos": ["Le Quest", "Foresque Residences", "The Hillier"],
    },
    "BUKIT MERAH": {
        "streets": ["Telok Blangah Road", "Henderson Road",
                    "Bukit Merah View", "Redhill Close"],
        "hdb_estates": ["Bukit Merah Central", "Telok Blangah", "Redhill"],
        "private_condos": ["Alex Residences", "The Crest", "Echelon"],
    },
    "BUKIT PANJANG": {
        "streets": ["Bukit Panjang Road", "Petir Road",
                    "Fajar Road", "Senja Road"],
        "hdb_estates": ["Bukit Panjang Central", "Senja-Cashew"],
        "private_condos": ["Hazel Park Terrace", "Hillion Residences", "The Tennery"],
    },
    "BUKIT TIMAH": {
        "streets": ["Bukit Timah Road", "Dunearn Road",
                    "Farrer Road", "Sunset Way"],
        "hdb_estates": [],
        "private_condos": ["The Linq @ Beauty World", "Royalgreen",
                           "Mayfair Modern", "Daintree Residence"],
    },
    "CHOA CHU KANG": {
        "streets": ["Choa Chu Kang Avenue 1", "Choa Chu Kang Avenue 3",
                    "Choa Chu Kang Loop", "Yew Tee Road"],
        "hdb_estates": ["Choa Chu Kang Central", "Yew Tee"],
        "private_condos": ["Keat Hong Mirage", "The Visionaire", "Parc Life"],
    },
    "CLEMENTI": {
        "streets": ["Clementi Avenue 1", "Clementi Avenue 3",
                    "Clementi Road", "West Coast Road"],
        "hdb_estates": ["Clementi Central", "West Coast"],
        "private_condos": ["Clement Canopy", "The Trilinq", "Whistler Grand"],
    },
    "GEYLANG": {
        "streets": ["Geylang Road", "Aljunied Road",
                    "Sims Avenue", "Eunos Road"],
        "hdb_estates": ["Aljunied", "Geylang Bahru"],
        "private_condos": ["Urban Vista", "Sims Urban Oasis", "The Citron"],
    },
    "HOUGANG": {
        "streets": ["Hougang Avenue 4", "Hougang Avenue 8",
                    "Hougang Street 21", "Hougang Street 51"],
        "hdb_estates": ["Hougang Central", "Hougang North"],
        "private_condos": ["Kovan Residences", "Rio Vista", "Archipelago"],
    },
    "JURONG EAST": {
        "streets": ["Jurong East Street 13", "Jurong East Avenue 1",
                    "Boon Lay Way", "International Road"],
        "hdb_estates": ["Jurong East Central", "Yuhua"],
        "private_condos": ["J Gateway", "Parc Olympia", "The Jade"],
    },
    "JURONG WEST": {
        "streets": ["Jurong West Street 41", "Jurong West Street 52",
                    "Jurong West Avenue 1", "Jurong West Central 1"],
        "hdb_estates": ["Jurong West Central", "Taman Jurong"],
        "private_condos": ["Lakeville", "The Lakeshore", "Lake Life"],
    },
    "KALLANG": {
        "streets": ["Crawford Street", "Geylang Road",
                    "Kallang Bahru", "Whampoa Drive"],
        "hdb_estates": ["Whampoa", "Boon Keng", "Kallang"],
        "private_condos": ["Kallang Riverside", "The Skywoods", "Macly Suites"],
    },
    "MARINE PARADE": {
        "streets": ["Marine Parade Road", "East Coast Road",
                    "Still Road", "Joo Chiat Road"],
        "hdb_estates": ["Marine Parade Central"],
        "private_condos": ["The Continuum", "Amber Park", "Seaside Residences"],
    },
    "NOVENA": {
        "streets": ["Thomson Road", "Novena Rise",
                    "Irrawaddy Road", "Moulmein Road"],
        "hdb_estates": [],
        "private_condos": ["Derbyshire Heights", "Novena Regency", "Zenith"],
    },
    "PASIR RIS": {
        "streets": ["Pasir Ris Drive 1", "Pasir Ris Drive 3",
                    "Pasir Ris Street 11", "Pasir Ris Street 51"],
        "hdb_estates": ["Pasir Ris Central", "Pasir Ris West"],
        "private_condos": ["Costa Ris", "Livia", "The Palette"],
    },
    "PUNGGOL": {
        "streets": ["Punggol Field", "Punggol Place",
                    "Edgedale Plains", "Sumang Lane"],
        "hdb_estates": ["Punggol Central", "Matilda", "Northshore"],
        "private_condos": ["Watertown", "Rivercove Residences", "Parc Canberra"],
    },
    "QUEENSTOWN": {
        "streets": ["Margaret Drive", "Commonwealth Avenue West",
                    "Stirling Road", "Tanglin Halt Road"],
        "hdb_estates": ["Queenstown Central", "Commonwealth"],
        "private_condos": ["Queens Peak", "Alex Residences", "Commonwealth Towers"],
    },
    "SEMBAWANG": {
        "streets": ["Sembawang Road", "Sembawang Crescent",
                    "Sembawang Drive", "Canberra Road"],
        "hdb_estates": ["Sembawang Central", "Canberra"],
        "private_condos": ["The Brownstone", "Parc Canberra", "Eight Courtyards"],
    },
    "SENGKANG": {
        "streets": ["Sengkang East Way", "Compassvale Road",
                    "Fernvale Road", "Rivervale Crescent"],
        "hdb_estates": ["Rivervale", "Compassvale", "Fernvale"],
        "private_condos": ["High Park Residences", "Parc Botannia", "The Vales"],
    },
    "SERANGOON": {
        "streets": ["Serangoon Avenue 1", "Serangoon Avenue 3",
                    "Upper Serangoon Road", "Lorong Ah Soo"],
        "hdb_estates": ["Serangoon Central", "Lorong Ah Soo"],
        "private_condos": ["Kovan Melody", "The Springbloom", "Chiltern Park"],
    },
    "TAMPINES": {
        "streets": ["Tampines Street 11", "Tampines Street 22",
                    "Tampines Street 33", "Tampines Avenue 1"],
        "hdb_estates": ["Tampines North", "Tampines Central", "Tampines West"],
        "private_condos": ["Tampines Trilliant", "The Santorini", "Waterview"],
    },
    "TANGLIN": {
        "streets": ["Tanglin Road", "Stevens Road",
                    "Napier Road", "Grange Road"],
        "hdb_estates": [],
        "private_condos": ["The Crest", "Gramercy Park", "Leedon Residence"],
    },
    "TOA PAYOH": {
        "streets": ["Toa Payoh Lorong 1", "Toa Payoh Lorong 4",
                    "Toa Payoh Lorong 7", "Toa Payoh Rise"],
        "hdb_estates": ["Toa Payoh Central", "Bidadari"],
        "private_condos": ["The Tre Ver", "Gem Residences", "Oleander Towers"],
    },
    "WOODLANDS": {
        "streets": ["Woodlands Avenue 1", "Woodlands Drive 14",
                    "Woodlands Drive 52", "Woodlands Street 31"],
        "hdb_estates": ["Woodlands North", "Woodlands South"],
        "private_condos": ["Casablanca", "Parc Rosewood", "Woodhaven"],
    },
    "YISHUN": {
        "streets": ["Yishun Avenue 1", "Yishun Avenue 4",
                    "Yishun Ring Road", "Yishun Street 11"],
        "hdb_estates": ["Yishun Central", "Yishun North"],
        "private_condos": ["The Criterion", "Eight Courtyards", "Orchid Park Condominium"],
    },
}

# Towns near the city centre that command a price premium
CENTRAL_TOWNS = {
    "QUEENSTOWN", "TOA PAYOH", "BISHAN", "NOVENA",
    "MARINE PARADE", "BUKIT TIMAH", "KALLANG",
    "BUKIT MERAH", "TANGLIN", "GEYLANG",
}

# ---------------------------------------------------------------------------
# Load and filter GeoJSON planning area polygons
# ---------------------------------------------------------------------------

def load_residential_areas(geojson_path: str | Path) -> list[dict]:
    """
    Parse the GeoJSON file and return a list of residential planning areas.

    Each item contains:
      - "name"     : title-cased town name (matches AREA_METADATA keys)
      - "polygon"  : a Shapely geometry object for the planning area boundary
      - metadata fields from AREA_METADATA (streets, hdb_estates, private_condos)

    Areas not present in AREA_METADATA or listed in NON_RESIDENTIAL_AREAS
    are skipped.
    """
    with open(geojson_path, encoding="utf-8") as f:
        gj = json.load(f)

    areas = []
    for feature in gj["features"]:
        props = feature["properties"]
        raw_name: str = props["PLN_AREA_N"].strip().upper()

        # Skip non-residential zones
        if raw_name in NON_RESIDENTIAL_AREAS:
            continue

        # Skip if we have no metadata for this area
        if raw_name not in AREA_METADATA:
            continue

        polygon = shape(feature["geometry"])
        meta    = AREA_METADATA[raw_name]

        areas.append({
            "name":          raw_name.title(),   # e.g. "Ang Mo Kio"
            "name_upper":    raw_name,
            "polygon":       polygon,
            "streets":       meta["streets"],
            "hdb_estates":   meta["hdb_estates"],
            "private_condos": meta["private_condos"],
        })

    return areas


def random_point_in_polygon(polygon) -> tuple[float, float]:
    """
    Sample a uniformly random point from within a (possibly complex) polygon
    using rejection sampling against the bounding box.
    """
    min_x, min_y, max_x, max_y = polygon.bounds
    while True:
        lng = random.uniform(min_x, max_x)
        lat = random.uniform(min_y, max_y)
        if polygon.contains(Point(lng, lat)):
            return round(lat, 6), round(lng, 6)


# ---------------------------------------------------------------------------
# HDB flat types and private unit types
# ---------------------------------------------------------------------------

HDB_FLAT_TYPES = [
    {"flat_type": "2-Room Flexi", "bedrooms": 1, "sqft_range": (430,  500)},
    {"flat_type": "3-Room",       "bedrooms": 2, "sqft_range": (624,  753)},
    {"flat_type": "4-Room",       "bedrooms": 3, "sqft_range": (861, 1012)},
    {"flat_type": "5-Room",       "bedrooms": 4, "sqft_range": (1119, 1345)},
    {"flat_type": "Executive",    "bedrooms": 4, "sqft_range": (1399, 1722)},
]

PRIVATE_UNIT_TYPES = [
    {"unit_type": "Studio",    "bedrooms": 0, "sqft_range": (398,  527)},
    {"unit_type": "1 Bedroom", "bedrooms": 1, "sqft_range": (484,  700)},
    {"unit_type": "2 Bedroom", "bedrooms": 2, "sqft_range": (700, 1012)},
    {"unit_type": "3 Bedroom", "bedrooms": 3, "sqft_range": (1012, 1399)},
    {"unit_type": "4 Bedroom", "bedrooms": 4, "sqft_range": (1399, 2000)},
    {"unit_type": "Penthouse", "bedrooms": 4, "sqft_range": (2000, 3500)},
]

FURNISHING_OPTIONS   = ["Unfurnished", "Partially Furnished", "Fully Furnished"]
TENURE_OPTIONS       = ["99-Year Leasehold", "999-Year Leasehold", "Freehold"]
FLOOR_LEVEL_OPTIONS  = ["Low (1-5)", "Mid (6-15)", "High (16-25)", "Very High (26+)"]

# ---------------------------------------------------------------------------
# Pricing helpers
# ---------------------------------------------------------------------------

def _jitter(value: float, pct: float = 0.08) -> float:
    return value * (1 + random.uniform(-pct, pct))


def hdb_rental_price(flat_type: dict, area_name_upper: str) -> int:
    base_by_rooms = {
        "2-Room Flexi": 1600,
        "3-Room":       2000,
        "4-Room":       2500,
        "5-Room":       3000,
        "Executive":    3500,
    }
    multiplier = 1.20 if area_name_upper in CENTRAL_TOWNS else 1.0
    base = base_by_rooms[flat_type["flat_type"]] * multiplier
    return int(round(_jitter(base, 0.15) / 100) * 100)


def private_rental_price(unit_type: dict, area_name_upper: str) -> int:
    base_by_type = {
        "Studio":    2800,
        "1 Bedroom": 3200,
        "2 Bedroom": 4200,
        "3 Bedroom": 5800,
        "4 Bedroom": 8000,
        "Penthouse": 14000,
    }
    multiplier = 1.25 if area_name_upper in CENTRAL_TOWNS else 1.0
    base = base_by_type[unit_type["unit_type"]] * multiplier
    return int(round(_jitter(base, 0.18) / 100) * 100)


def hdb_sale_price(flat_type: dict, area_name_upper: str, built_year: int) -> int:
    base_by_rooms = {
        "2-Room Flexi": 300_000,
        "3-Room":       380_000,
        "4-Room":       520_000,
        "5-Room":       680_000,
        "Executive":    820_000,
    }
    location_mult = 1.30 if area_name_upper in CENTRAL_TOWNS else 1.0
    age      = 2025 - built_year
    age_mult = max(0.75, 1.0 - age * 0.004)
    base     = base_by_rooms[flat_type["flat_type"]] * location_mult * age_mult
    return int(round(_jitter(base, 0.12) / 1000) * 1000)


# ---------------------------------------------------------------------------
# Address helpers
# ---------------------------------------------------------------------------

def _random_block() -> str:
    return str(random.randint(1, 999))


def _random_unit() -> str:
    return f"#{random.randint(1, 30):02d}-{random.randint(1, 30):02d}"


def _random_postal() -> str:
    return f"{random.randint(100000, 829999):06d}"


def make_hdb_address(area: dict) -> str:
    return (
        f"Block {_random_block()} {random.choice(area['streets'])}, "
        f"Singapore {_random_postal()}"
    )


def make_private_address(area: dict, condo_name: str) -> str:
    return (
        f"{_random_unit()} {condo_name}, "
        f"{random.choice(area['streets'])}, "
        f"Singapore {_random_postal()}"
    )


# ---------------------------------------------------------------------------
# Listing generators
# ---------------------------------------------------------------------------

def _base_listing(listing_id: str, area: dict, built_year: int) -> dict:
    """Common fields shared by every listing type."""
    lat, lng = random_point_in_polygon(area["polygon"])
    return {
        "listing_id": listing_id,
        "town":       area["name"],
        "location":   {"lat": lat, "lon": lng},
        "built_year": built_year,
        "indexed_at": datetime.now(timezone.utc).isoformat(),
    }


def generate_rental_hdb(area: dict) -> dict | None:
    if not area["hdb_estates"]:
        return None

    flat_type  = random.choice(HDB_FLAT_TYPES)
    built_year = random.randint(1975, 2023)
    sqft       = random.randint(*flat_type["sqft_range"])
    price_pm   = hdb_rental_price(flat_type, area["name_upper"])
    listing_id = f"RENT-HDB-{uuid.uuid4().hex[:10].upper()}"

    listing = _base_listing(listing_id, area, built_year)
    listing.update({
        "listing_type":      "rental",
        "property_category": "hdb",
        "flat_type":         flat_type["flat_type"],
        "hdb_estate":        random.choice(area["hdb_estates"]),
        "address":           make_hdb_address(area),
        "bedrooms":          flat_type["bedrooms"],
        "bathrooms":         max(1, flat_type["bedrooms"] - 1),
        "size_sqft":         sqft,
        "price_per_month":   price_pm,
        "psf_per_month":     round(price_pm / sqft, 2),
        "furnishing":        random.choice(FURNISHING_OPTIONS),
        "floor_level":       random.choice(FLOOR_LEVEL_OPTIONS),
        "available_from":    f"2025-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
        "min_lease_months":  random.choice([12, 24]),
        "pets_allowed":      random.choice([True, False]),
        "tenure":            "99-Year Leasehold",
    })
    return listing


def generate_rental_private(area: dict) -> dict | None:
    if not area["private_condos"]:
        return None

    unit_type  = random.choice(PRIVATE_UNIT_TYPES)
    condo_name = random.choice(area["private_condos"])
    built_year = random.randint(1990, 2024)
    sqft       = random.randint(*unit_type["sqft_range"])
    price_pm   = private_rental_price(unit_type, area["name_upper"])
    listing_id = f"RENT-PVT-{uuid.uuid4().hex[:10].upper()}"

    listing = _base_listing(listing_id, area, built_year)
    listing.update({
        "listing_type":      "rental",
        "property_category": "private",
        "property_name":     condo_name,
        "unit_type":         unit_type["unit_type"],
        "address":           make_private_address(area, condo_name),
        "bedrooms":          unit_type["bedrooms"],
        "bathrooms":         max(1, unit_type["bedrooms"]),
        "size_sqft":         sqft,
        "price_per_month":   price_pm,
        "psf_per_month":     round(price_pm / sqft, 2),
        "furnishing":        random.choice(FURNISHING_OPTIONS),
        "floor_level":       random.choice(FLOOR_LEVEL_OPTIONS),
        "available_from":    f"2025-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
        "min_lease_months":  random.choice([12, 24]),
        "pets_allowed":      random.choice([True, False]),
        "tenure":            random.choice(TENURE_OPTIONS),
        "facilities":        random.sample(
            ["Swimming Pool", "Gym", "BBQ Pit", "Tennis Court", "Playground",
             "Clubhouse", "24-hr Security", "Jacuzzi", "Sauna", "Function Room"],
            k=random.randint(3, 7),
        ),
    })
    return listing


def generate_sale_hdb(area: dict) -> dict | None:
    if not area["hdb_estates"]:
        return None

    flat_type  = random.choice(HDB_FLAT_TYPES)
    built_year = random.randint(1975, 2020)
    sqft       = random.randint(*flat_type["sqft_range"])
    price      = hdb_sale_price(flat_type, area["name_upper"], built_year)
    listing_id = f"SALE-HDB-{uuid.uuid4().hex[:10].upper()}"

    listing = _base_listing(listing_id, area, built_year)
    listing.update({
        "listing_type":          "sale",
        "property_category":     "hdb",
        "flat_type":             flat_type["flat_type"],
        "hdb_estate":            random.choice(area["hdb_estates"]),
        "address":               make_hdb_address(area),
        "bedrooms":              flat_type["bedrooms"],
        "bathrooms":             max(1, flat_type["bedrooms"] - 1),
        "size_sqft":             sqft,
        "price":                 price,
        "price_per_sqft":        round(price / sqft, 2),
        "remaining_lease_years": max(1, 99 - (2025 - built_year)),
        "furnishing":            random.choice(FURNISHING_OPTIONS),
        "floor_level":           random.choice(FLOOR_LEVEL_OPTIONS),
        "tenure":                "99-Year Leasehold",
        "ethnic_quota_met":      random.choice([True, False]),
        "hdb_grant_eligible":    True,
    })
    return listing


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def generate_listings(
    n_per_type_per_area: int = 3,
    output_file: str = "singapore_property_listings.json",
    geojson_path: str | Path | None = None,
) -> None:
    """
    Generate listings and save them to *output_file*.

    Each residential planning area produces up to n_per_type_per_area listings
    for each of the three listing types (rental_hdb, rental_private, sale_hdb).
    Coordinates are sampled uniformly from within the actual polygon boundary.
    """
    if geojson_path is None:
        # Default: sibling data/ folder relative to this script
        geojson_path = (
            Path(__file__).parent.parent
            / "data"
            / "MasterPlan2025PlanningAreaBoundaryNoSea.geojson"
        )

    areas = load_residential_areas(geojson_path)
    print(f"ℹ️  Loaded {len(areas)} residential planning areas from GeoJSON.")

    listings: list[dict] = []
    for area in areas:
        for _ in range(n_per_type_per_area):
            for generator in (generate_rental_hdb, generate_rental_private, generate_sale_hdb):
                listing = generator(area)
                if listing:
                    listings.append(listing)

    random.shuffle(listings)

    output_path = Path(__file__).parent / output_file
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(listings, f, ensure_ascii=False, indent=2)

    counts: dict[str, int] = {}
    for listing in listings:
        key = f"{listing['listing_type']}_{listing['property_category']}"
        counts[key] = counts.get(key, 0) + 1

    print(f"✅ Generated {len(listings)} listings → {output_path}")
    for key, count in sorted(counts.items()):
        print(f"   {key:<25} {count:>4} listings")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate Singapore property listings.")
    parser.add_argument(
        "-n", "--count",
        type=int, default=3, metavar="N",
        help="Number of listings per type per planning area (default: 3).",
    )
    parser.add_argument(
        "-o", "--output",
        type=str, default="singapore_property_listings.json", metavar="FILE",
        help="Output filename (saved in the same folder as this script).",
    )
    parser.add_argument(
        "-g", "--geojson",
        type=str, default=None, metavar="PATH",
        help="Path to the GeoJSON planning area boundary file.",
    )
    args = parser.parse_args()

    random.seed(42)
    generate_listings(
        n_per_type_per_area=args.count,
        output_file=args.output,
        geojson_path=args.geojson,
    )
