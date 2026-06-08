// Lightweight reverse geocoder using OpenStreetMap Nominatim.
// Returns a short, human-friendly place label (neighborhood / city) for a coord.

type LatLng = [number, number];

const cache = new Map<string, string>();

function key(p: LatLng) {
  return `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
}

type NominatimAddress = {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  village?: string;
  town?: string;
  city?: string;
  municipality?: string;
  county?: string;
  state?: string;
  country?: string;
};

function pickLabel(a: NominatimAddress): string | null {
  const area =
    a.neighbourhood || a.suburb || a.quarter || a.city_district || null;
  const city = a.city || a.town || a.village || a.municipality || a.county || null;
  if (area && city && area !== city) return `${area}, ${city}`;
  return area || city || a.state || a.country || null;
}

export async function reverseGeocode(point: LatLng): Promise<string | null> {
  const k = key(point);
  if (cache.has(k)) return cache.get(k)!;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${point[0]}&lon=${point[1]}&zoom=14&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { address?: NominatimAddress };
    const label = json.address ? pickLabel(json.address) : null;
    if (label) cache.set(k, label);
    return label;
  } catch {
    return null;
  }
}
