#!/usr/bin/env python3
import json
import re
from pathlib import Path

ROOT = Path('/Users/joachim/projects/travelagency')
TOURS_DIR = ROOT / 'assets' / 'tours'
DATA_JSON = ROOT / 'data' / 'trips.json'
INDEX_HTML = ROOT / 'index.html'

COUNTRIES = {
    'vietnam': {
        'name': 'Vietnam',
        'season': 'Best Oct-Apr',
        'price_adj': 0,
        'dur_adj': 0,
        'places': ['Hanoi', 'Hoi An', 'Ha Long Bay']
    },
    'thailand': {
        'name': 'Thailand',
        'season': 'Best Nov-Mar',
        'price_adj': 120,
        'dur_adj': 1,
        'places': ['Bangkok', 'Chiang Mai', 'Phuket']
    },
    'cambodia': {
        'name': 'Cambodia',
        'season': 'Best Nov-Feb',
        'price_adj': -80,
        'dur_adj': 0,
        'places': ['Siem Reap', 'Phnom Penh', 'Tonle Sap']
    },
    'laos': {
        'name': 'Laos',
        'season': 'Best Nov-Feb',
        'price_adj': -140,
        'dur_adj': 0,
        'places': ['Luang Prabang', 'Vang Vieng', 'Mekong River']
    }
}

STYLES = {
    'adventure': {'name': 'Adventure', 'duration': 10, 'price': 980, 'rating': 4.8},
    'beach': {'name': 'Beach', 'duration': 9, 'price': 1040, 'rating': 4.8},
    'budget': {'name': 'Budget', 'duration': 8, 'price': 690, 'rating': 4.6},
    'culture': {'name': 'Culture', 'duration': 9, 'price': 860, 'rating': 4.8},
    'family': {'name': 'Family', 'duration': 11, 'price': 1180, 'rating': 4.9},
    'food': {'name': 'Food', 'duration': 8, 'price': 790, 'rating': 4.8},
    'luxury': {'name': 'Luxury', 'duration': 12, 'price': 1980, 'rating': 5.0}
}

STYLE_PHRASES = {
    'adventure': 'active days, scenic routes, and practical local support',
    'beach': 'relaxed coast time balanced with easy local discovery',
    'budget': 'value-focused planning with smart routing and clear inclusions',
    'culture': 'heritage depth, local life, and meaningful guided visits',
    'family': 'family-friendly pacing and dependable on-trip logistics',
    'food': 'market visits, tastings, and regional culinary experiences',
    'luxury': 'premium stays, private service, and signature moments'
}

VARIANT_PHRASES = {
    ('ha', 'giang', 'loop'): 'a mountain-loop focus through Ha Giang',
    ('island', 'escape'): 'an island-focused rhythm with extra beach downtime'
}


def title_case_slug(slug: str) -> str:
    return ' '.join([w.capitalize() for w in re.split(r'[-_]+', slug) if w])


def variant_focus(variant_slug: str) -> str:
    tokens = tuple([t for t in re.split(r'[-_]+', variant_slug.lower()) if t])
    for key_tokens, phrase in VARIANT_PHRASES.items():
        if all(t in tokens for t in key_tokens):
            return phrase
    if variant_slug == 'classic':
        return 'a balanced first-trip route'
    return f"a route shaped around {title_case_slug(variant_slug)}"


def parse_image(path: Path):
    # Expected pattern: country-style-variant.webp
    stem = path.stem
    parts = stem.split('-')
    if len(parts) < 3:
        return None
    country = parts[0]
    style = parts[1]
    variant = '-'.join(parts[2:])
    if country not in COUNTRIES or style not in STYLES:
        return None
    expected_prefix = f"{country}-{style}-"
    if not stem.startswith(expected_prefix):
        return None
    return country, style, variant


def build_trip(path: Path, country_slug: str, style_slug: str, variant_slug: str, existing_priority: int | None = None):
    country = COUNTRIES[country_slug]
    style = STYLES[style_slug]
    p1, p2, p3 = country['places']

    variant_title = title_case_slug(variant_slug)
    focus = variant_focus(variant_slug)

    duration = style['duration'] + country['dur_adj']
    price = max(420, style['price'] + country['price_adj'])
    if variant_slug != 'classic':
        duration += 1
        price += 90

    style_name = style['name']
    country_name = country['name']

    title = f"{country_name} {style_name} Journey"
    if variant_slug != 'classic':
        title = f"{country_name} {style_name} - {variant_title}"

    short_description = (
        f"A {country_name} {style_name.lower()} itinerary focused on {focus}, "
        f"with {STYLE_PHRASES[style_slug]}."
    )

    highlights = [
        f"Signature stop in {p1}",
        f"Route highlight around {p2}",
        f"Smooth transfer planning via {p3}"
    ]

    variant_id = variant_slug.replace('_', '-').lower()
    image_rel = str(path.relative_to(ROOT)).replace('\\', '/')

    priority = existing_priority if isinstance(existing_priority, int) else 50

    return {
        'id': f"trip-{country_slug}-{style_slug}-{variant_id}",
        'title': title,
        'shortDescription': short_description,
        'destinationCountry': country_name,
        'styles': [style_name],
        # Human-writable field: preserve existing values from data/trips.json.
        # New tours default to 50.
        'priority': priority,
        'durationDays': duration,
        'priceFrom': price,
        'image': image_rel,
        'fallbackImage': image_rel,
        'highlights': highlights,
        'seasonality': country['season'],
        'rating': style['rating']
    }


def main():
    existing_priorities_by_id: dict[str, int] = {}
    existing_priorities_by_image: dict[str, int] = {}
    if DATA_JSON.exists():
        try:
            existing_trips = json.loads(DATA_JSON.read_text(encoding='utf-8'))
            for trip in existing_trips:
                priority = trip.get('priority')
                if isinstance(priority, int):
                    trip_id = trip.get('id')
                    image = trip.get('image')
                    if isinstance(trip_id, str):
                        existing_priorities_by_id[trip_id] = priority
                    if isinstance(image, str):
                        existing_priorities_by_image[image] = priority
        except Exception:
            # If existing JSON is malformed, fall back to defaults.
            pass

    entries = []
    for path in sorted(TOURS_DIR.rglob('*.webp')):
        parsed = parse_image(path)
        if not parsed:
            continue
        country, style, variant = parsed
        variant_id = variant.replace('_', '-').lower()
        trip_id = f"trip-{country}-{style}-{variant_id}"
        image_rel = str(path.relative_to(ROOT)).replace('\\', '/')
        existing_priority = existing_priorities_by_id.get(trip_id, existing_priorities_by_image.get(image_rel))
        entries.append(build_trip(path, country, style, variant, existing_priority))

    if not entries:
        raise SystemExit('No valid tour images found with country-style-variant.webp format.')

    json_text = json.dumps(entries, ensure_ascii=True, indent=2)
    DATA_JSON.write_text(json_text + '\n', encoding='utf-8')

    html = INDEX_HTML.read_text(encoding='utf-8')
    pattern = r'(<script id="tripsFallback" type="application/json">\s*)(\[.*?\])(\s*</script>)'
    m = re.search(pattern, html, flags=re.S)
    if not m:
        raise SystemExit('tripsFallback block not found in index.html')
    updated = html[:m.start()] + m.group(1) + json_text + m.group(3) + html[m.end():]
    INDEX_HTML.write_text(updated, encoding='utf-8')

    print(f'Generated {len(entries)} tours from image variants.')


if __name__ == '__main__':
    main()
