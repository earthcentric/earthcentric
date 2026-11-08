import "server-only";

export interface LocationResult {
  latitude: number;
  longitude: number;
  displayName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  providerLocationId: string | null;
  provider: "Nominatim";
}

export interface RoadRoute {
  distanceKm: number;
  durationMinutes: number;
  provider: "OSRM";
}

interface NominatimResult {
  place_id: number | string;
  lat: string;
  lon: string;
  display_name: string;
  address?: Record<string, string>;
}

const locationCache = new Map<string, { expiresAt: number; value: LocationResult }>();
const routeCache = new Map<string, { expiresAt: number; value: RoadRoute }>();
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const globalLocationState = globalThis as typeof globalThis & {
  earthcentricNominatimNextRequestAt?: number;
};

function parseLocation(result: NominatimResult): LocationResult | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const address = result.address || {};
  return {
    latitude,
    longitude,
    displayName: result.display_name,
    street: [
      address.house_number,
      address.road || address.pedestrian || address.footway,
    ].filter(Boolean).join(" "),
    city: address.city || address.town || address.village || address.suburb || "",
    state: address.state || "",
    postalCode: address.postcode || "",
    country: address.country || "India",
    providerLocationId: String(result.place_id),
    provider: "Nominatim",
  };
}

async function waitForNominatimSlot(): Promise<void> {
  const now = Date.now();
  const nextAt = globalLocationState.earthcentricNominatimNextRequestAt || now;
  const waitMs = Math.max(0, nextAt - now);
  globalLocationState.earthcentricNominatimNextRequestAt =
    Math.max(now, nextAt) + NOMINATIM_MIN_INTERVAL_MS;
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
}

async function fetchNominatim(url: URL): Promise<NominatimResult[]> {
  await waitForNominatimSlot();
  const baseUrl = process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org";
  const endpoint = new URL(url.pathname + url.search, baseUrl);
  const response = await fetch(endpoint, {
    headers: {
      "User-Agent": `EarthCentric/1.0 (${process.env.NOMINATIM_CONTACT_URL || "https://earthcentric.in"})`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Geocoding provider returned HTTP ${response.status}.`);
  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) throw new Error("Geocoding provider returned an invalid response.");
  return payload as NominatimResult[];
}

export async function geocodeAddress(query: string): Promise<LocationResult | null> {
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  if (normalizedQuery.length < 5 || normalizedQuery.length > 200) {
    throw new Error("Enter an address between 5 and 200 characters.");
  }

  const cacheKey = `search:${normalizedQuery.toLowerCase()}`;
  const cached = locationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL("/search", "https://nominatim.openstreetmap.org");
  url.searchParams.set("q", normalizedQuery);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "in");
  const result = (await fetchNominatim(url))[0];
  if (!result) return null;
  const location = parseLocation(result);
  if (location) locationCache.set(cacheKey, { expiresAt: Date.now() + CACHE_DURATION_MS, value: location });
  return location;
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<LocationResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new Error("The selected map coordinates are invalid.");
  }

  const cacheKey = `reverse:${latitude.toFixed(5)},${longitude.toFixed(5)}`;
  const cached = locationCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const url = new URL("/reverse", "https://nominatim.openstreetmap.org");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  const result = (await fetchNominatim(url))[0];
  if (!result) return null;
  const location = parseLocation(result);
  if (location) locationCache.set(cacheKey, { expiresAt: Date.now() + CACHE_DURATION_MS, value: location });
  return location;
}

export async function getRoadRoute(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): Promise<RoadRoute | null> {
  const coordinates = [from, to];
  if (coordinates.some(({ latitude, longitude }) =>
    !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180
  )) {
    throw new Error("Route coordinates are invalid.");
  }

  const cacheKey = `route:${from.latitude.toFixed(5)},${from.longitude.toFixed(5)}:${to.latitude.toFixed(5)},${to.longitude.toFixed(5)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const base = (process.env.OSRM_BASE_URL || "https://router.project-osrm.org/route/v1/driving").replace(/\/+$/, "");
  const url = new URL(
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`,
    `${base}/`
  );
  url.searchParams.set("overview", "false");
  url.searchParams.set("steps", "false");
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!response.ok) throw new Error(`Routing provider returned HTTP ${response.status}.`);
  const payload = await response.json() as {
    code?: string;
    routes?: Array<{ distance?: number; duration?: number }>;
  };
  const route = payload.routes?.[0];
  if (payload.code !== "Ok" || !route || !Number.isFinite(route.distance) || !Number.isFinite(route.duration)) {
    return null;
  }
  const result: RoadRoute = {
    distanceKm: Number(route.distance) / 1000,
    durationMinutes: Number(route.duration) / 60,
    provider: "OSRM",
  };
  routeCache.set(cacheKey, { expiresAt: Date.now() + CACHE_DURATION_MS, value: result });
  return result;
}
