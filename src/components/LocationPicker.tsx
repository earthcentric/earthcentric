"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";

export interface SelectedLocation {
  latitude: number;
  longitude: number;
  displayName: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  providerLocationId: string | null;
  provider: "Nominatim" | null;
}

interface LocationPickerProps {
  latitude?: number | null;
  longitude?: number | null;
  onSelect: (location: SelectedLocation) => void;
  className?: string;
}

const TILE_URL =
  process.env.NEXT_PUBLIC_OSM_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export function LocationPicker({ latitude, longitude, onSelect, className = "" }: LocationPickerProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const onSelectRef = useRef(onSelect);
  const initialLocation = useRef({ latitude, longitude });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [providerConsent, setProviderConsent] = useState(false);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!providerConsent) return;
    let disposed = false;
    let map: import("leaflet").Map | null = null;
    let marker: import("leaflet").CircleMarker | null = null;

    void import("leaflet").then((L) => {
      if (disposed || !mapElement.current) return;
      const { latitude: initialLatitude, longitude: initialLongitude } = initialLocation.current;
      const start = initialLatitude !== null && initialLatitude !== undefined &&
        initialLongitude !== null && initialLongitude !== undefined
        ? [initialLatitude, initialLongitude] as [number, number]
        : [20.5937, 78.9629] as [number, number];
      map = L.map(mapElement.current, { scrollWheelZoom: false }).setView(start, initialLatitude ? 14 : 5);
      L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      mapRef.current = map;

      const placeMarker = (lat: number, lon: number) => {
        marker?.remove();
        marker = L.circleMarker([lat, lon], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#2d5a40",
          fillOpacity: 1,
        }).addTo(map!);
        markerRef.current = marker;
      };

      if (initialLatitude !== null && initialLatitude !== undefined &&
          initialLongitude !== null && initialLongitude !== undefined) {
        placeMarker(initialLatitude, initialLongitude);
      }

      map.on("click", async (event) => {
        const lat = Number(event.latlng.lat.toFixed(6));
        const lon = Number(event.latlng.lng.toFixed(6));
        placeMarker(lat, lon);
        if (!providerConsent) {
          onSelectRef.current({
            latitude: lat,
            longitude: lon,
            displayName: "",
            street: "",
            city: "",
            state: "",
            postalCode: "",
            country: "India",
            providerLocationId: null,
            provider: null,
          });
          return;
        }
        try {
          const response = await fetch("/api/location/geocode", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mode: "reverse", latitude: lat, longitude: lon }),
          });
          if (response.ok) {
            const result = await response.json() as SelectedLocation;
            onSelectRef.current(result);
          } else {
            onSelectRef.current({
              latitude: lat,
              longitude: lon,
              displayName: "",
              street: "",
              city: "",
              state: "",
              postalCode: "",
              country: "India",
              providerLocationId: null,
              provider: null,
            });
          }
        } catch {
          onSelectRef.current({
            latitude: lat,
            longitude: lon,
            displayName: "",
            street: "",
            city: "",
            state: "",
            postalCode: "",
            country: "India",
            providerLocationId: null,
            provider: null,
          });
        }
      });

      window.setTimeout(() => map?.invalidateSize(), 100);
    }).catch((loadError: unknown) => {
      console.error("Could not load Leaflet:", loadError);
      setError("The map could not be loaded. You can still enter the address manually.");
    });

    return () => {
      disposed = true;
      map?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [providerConsent]);

  useEffect(() => {
    if (latitude == null || longitude == null || !mapRef.current) return;
    void import("leaflet").then((L) => {
      const map = mapRef.current;
      if (!map) return;
      map.setView([latitude, longitude], 14);
      markerRef.current?.remove();
      markerRef.current = L.circleMarker([latitude, longitude], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#2d5a40",
        fillOpacity: 1,
      }).addTo(map);
    });
  }, [latitude, longitude]);

  const handleSearch = async () => {
    if (!providerConsent) {
      setError("Please consent before sending this address to the configured geocoding provider.");
      return;
    }
    if (query.trim().length < 5) {
      setError("Enter at least 5 characters to search for a place.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/location/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const result = await response.json() as SelectedLocation | { error?: string };
      if (!response.ok || !("latitude" in result)) {
        setError("error" in result ? result.error || "No location found." : "No location found.");
        return;
      }
      const map = mapRef.current;
      if (map) {
        map.setView([result.latitude, result.longitude], 15);
        const L = await import("leaflet");
        markerRef.current?.remove();
        markerRef.current = L.circleMarker([result.latitude, result.longitude], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#2d5a40",
          fillOpacity: 1,
        }).addTo(map);
      }
      onSelectRef.current(result);
    } catch (searchError) {
      console.error("Geocoding request failed:", searchError);
      setError("Address search is unavailable. You can continue with manual entry.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleSearch();
            }
          }}
          placeholder="Search a place or address"
          className="min-w-0 flex-1 rounded-lg border border-[#C8D8C0] bg-white px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSearch()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#1F3A2E] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
          Search
        </button>
      </div>
      <label className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <input
          type="checkbox"
          checked={providerConsent}
          onChange={(event) => setProviderConsent(event.target.checked)}
          className="mt-0.5"
        />
        <span>
          I consent to sending the address or selected map coordinates to the configured geocoding provider to look up this location. Map tiles are provided by the configured tile service.
        </span>
      </label>
      {error && <p className="text-xs text-amber-700">{error}</p>}
      <div className="relative overflow-hidden rounded-xl border border-[#C8D8C0]">
        <div ref={mapElement} className="h-64 w-full" aria-label="Select a location on the map" />
        <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md bg-white/90 px-2 py-1 text-[10px] text-slate-600 shadow">
          <MapPin className="mr-1 inline h-3 w-3" />Click map to place a pin
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Map data &copy; OpenStreetMap contributors. Address search is an explicit request; no continuous autocomplete is used.
      </p>
    </div>
  );
}
