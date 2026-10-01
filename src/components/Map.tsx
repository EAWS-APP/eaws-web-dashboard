"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Sun, Moon, Search, Star, Route, X, MapPin, Navigation, Crosshair, Layers } from "lucide-react";
import type { AgencyUnit, Incident } from "@/lib/models";

// Helper to calculate distance in KM (Haversine formula)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

// Preset verified Accra locations for tactical search
const ACCRA_LOCATIONS = [
  { name: "Ridge Hospital (Greater Accra Regional)", address: "Castle Rd, Ridge, Accra", rating: 4.6, lat: 5.5601, lng: -0.1983, photoUrl: "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=300" },
  { name: "Korle Bu Teaching Hospital", address: "Guggisberg Ave, Korle Bu, Accra", rating: 4.8, lat: 5.5385, lng: -0.2285, photoUrl: "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=300" },
  { name: "37 Military Hospital", address: "Liberation Rd, 37, Accra", rating: 4.7, lat: 5.5866, lng: -0.1802, photoUrl: "https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=300" },
  { name: "Makola Market", address: "Kojo Thompson Rd, Central Business District, Accra", rating: 4.2, lat: 5.5482, lng: -0.2078, photoUrl: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=300" },
  { name: "Kotoka International Airport (Terminal 3)", address: "Airport Bypass Rd, Accra", rating: 4.7, lat: 5.6052, lng: -0.1717, photoUrl: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=300" },
  { name: "Circle Interchange (Kwame Nkrumah)", address: "Kwame Nkrumah Ave, Accra", rating: 4.1, lat: 5.5599, lng: -0.2155, photoUrl: "https://images.unsplash.com/photo-1477959858617-67f30bc75b82?w=300" },
  { name: "University of Ghana Medical Centre (UGMC)", address: "Legon Bypass, Legon, Accra", rating: 4.9, lat: 5.6496, lng: -0.1873, photoUrl: "https://images.unsplash.com/photo-1516549655169-df83a0774514?w=300" },
  { name: "Accra Mall", address: "Tetteh Quarshie Interchange, Spintex Rd, Accra", rating: 4.5, lat: 5.6226, lng: -0.1742, photoUrl: "https://images.unsplash.com/photo-1567449303078-57ad995bd301?w=300" },
  { name: "Osu Castle & Marine Drive", address: "Castle Rd, Osu, Accra", rating: 4.4, lat: 5.5458, lng: -0.1825, photoUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=300" },
  { name: "East Legon Police Station", address: "Lagos Ave, East Legon, Accra", rating: 4.3, lat: 5.6375, lng: -0.1585, photoUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=300" },
  { name: "Tema Station Central Bus Terminal", address: "Kinbu Rd, Central Business District, Accra", rating: 4.0, lat: 5.5452, lng: -0.2018, photoUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=300" },
  { name: "National Fire Service HQ", address: "Ring Rd East, Cantonments, Accra", rating: 4.6, lat: 5.5714, lng: -0.1852, photoUrl: "https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?w=300" },
];

interface MapProps {
  center?: [number, number];
  zoom?: number;
  incidents?: Incident[];
  units?: AgencyUnit[];
  onAmbulanceMove?: (coords: [number, number]) => void;
  onSelectIncident?: (incidentId: string) => void;
}

export default function Map({
  center = [5.6037, -0.1870],
  zoom = 12,
  incidents = [],
  units = [],
  onAmbulanceMove,
  onSelectIncident,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const LRef = useRef<any>(null);

  const [mapType, setMapType] = useState<"dark" | "satellite">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<typeof ACCRA_LOCATIONS>([]);
  const [selectedPlace, setSelectedPlace] = useState<typeof ACCRA_LOCATIONS[0] | null>(null);

  // Markers and layers refs
  const incidentLayerRef = useRef<any>(null);
  const unitLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      const L = (await import("leaflet")).default;
      if (!isMounted) return;
      LRef.current = L;

      // Fix default marker icon assets
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: center,
          zoom: zoom,
          zoomControl: false,
          attributionControl: false,
        });

        // Add CartoDB Dark Matter tile layer
        const darkTiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
          maxZoom: 19,
          subdomains: "abcd",
        });
        darkTiles.addTo(map);
        tileLayerRef.current = darkTiles;

        // Create feature groups for clean updates
        incidentLayerRef.current = L.featureGroup().addTo(map);
        unitLayerRef.current = L.featureGroup().addTo(map);
        routeLayerRef.current = L.featureGroup().addTo(map);

        mapInstanceRef.current = map;
      }
    }

    void initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Toggle Dark vs Satellite Tiles
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === "satellite") {
      tileLayerRef.current = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 19 }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
        { maxZoom: 19, subdomains: "abcd" }
      ).addTo(map);
    }
  }, [mapType]);

  // Handle Search Queries
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSuggestions([]);
      return;
    }
    const q = searchQuery.toLowerCase();
    const matches = ACCRA_LOCATIONS.filter(
      (loc) => loc.name.toLowerCase().includes(q) || loc.address.toLowerCase().includes(q)
    );
    setSuggestions(matches);
  }, [searchQuery]);

  // Render Incidents onto Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    const layer = incidentLayerRef.current;
    if (!map || !L || !layer) return;

    layer.clearLayers();

    incidents.forEach((inc) => {
      const lat = inc.latitude || (inc as any).lat;
      const lng = inc.longitude || (inc as any).lng;
      if (!lat || !lng) return;

      const isCritical = inc.severity?.toLowerCase() === "critical";
      const isHigh = ["warning", "high"].includes(inc.severity?.toLowerCase());
      const glowColor = isCritical ? "#ef4444" : isHigh ? "#f59e0b" : "#3b82f6";
      const badgeColor = isCritical ? "bg-red-500" : isHigh ? "bg-amber-500" : "bg-blue-500";
      const iconSymbol =
        inc.category?.toLowerCase() === "medical"
          ? "🏥"
          : inc.category?.toLowerCase() === "fire"
          ? "🔥"
          : inc.category?.toLowerCase() === "crime"
          ? "🚔"
          : "🚨";

      const html = `
        <div class="relative flex items-center justify-center cursor-pointer group" style="transform: translate(-50%, -50%);">
          <span class="absolute w-8 h-8 rounded-full animate-ping opacity-75" style="background-color: ${glowColor}40;"></span>
          <span class="absolute w-6 h-6 rounded-full" style="background-color: ${glowColor}30;"></span>
          <div class="relative w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg border-2 border-white/80 font-bold ${badgeColor} text-white">
            ${iconSymbol}
          </div>
          <div class="absolute -bottom-5 bg-black/90 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow whitespace-nowrap border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
            ${inc.id}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: "custom-incident-pin",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(layer);

      const popupHtml = `
        <div class="p-3 text-zinc-100 bg-[#121215] rounded-xl border border-white/10 min-w-[220px]">
          <div class="flex items-center justify-between gap-2 mb-1.5">
            <span class="font-mono text-xs font-black text-white">${inc.id}</span>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase" style="background: ${glowColor}20; color: ${glowColor}; border: 1px solid ${glowColor}40;">
              ${inc.severity}
            </span>
          </div>
          <h4 class="text-xs font-bold text-white mb-1">${inc.title || "Emergency Incident"}</h4>
          <p class="text-[11px] text-zinc-400 mb-2">${inc.description || inc.location_name || "Accra Metro"}</p>
          <div class="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
            <span>${inc.user_name || "Citizen Reporter"}</span>
            <span class="text-emerald-400 font-bold">${inc.status.replaceAll("_", " ")}</span>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: "emergency-popup",
        closeButton: false,
      });

      marker.on("click", () => {
        if (onSelectIncident) onSelectIncident(inc.id);
      });
    });
  }, [incidents, onSelectIncident]);

  // Render Agency Units onto Leaflet Map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    const layer = unitLayerRef.current;
    if (!map || !L || !layer) return;

    layer.clearLayers();

    units.forEach((unit) => {
      const lat = unit.latitude || (unit as any).lat || 5.6037;
      const lng = unit.longitude || (unit as any).lng || -0.1870;
      const agencyType = unit.agency_type || (unit as any).type;

      const unitColor = agencyType === "fire" ? "#f97316" : agencyType === "police" ? "#3b82f6" : "#10b981";
      const unitIcon = agencyType === "fire" ? "🚒" : agencyType === "police" ? "🚓" : "🚑";

      const html = `
        <div class="relative flex items-center justify-center cursor-pointer" style="transform: translate(-50%, -50%);">
          <div class="w-8 h-8 rounded-2xl flex items-center justify-center text-sm shadow-xl border-2 border-white/90 bg-[#16161a] text-white" style="box-shadow: 0 0 15px ${unitColor}80;">
            ${unitIcon}
          </div>
          <span class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border border-black animate-pulse"></span>
        </div>
      `;

      const customIcon = L.divIcon({
        html,
        className: "custom-unit-pin",
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(layer);

      marker.bindPopup(`
        <div class="p-2.5 bg-[#121215] text-zinc-100 rounded-xl border border-white/10 font-mono text-xs">
          <p class="font-bold text-white text-sm mb-0.5">${unit.name || (unit as any).call_sign || unit.id}</p>
          <p class="text-[10px] text-zinc-400 uppercase">${agencyType || "Emergency"} Unit</p>
          <p class="text-[10px] text-emerald-400 mt-1 font-bold">STATUS: ${unit.status.toUpperCase()}</p>
        </div>
      `, { closeButton: false });
    });
  }, [units]);

  // Select place from search
  function handleSelectPlace(place: typeof ACCRA_LOCATIONS[0]) {
    setSelectedPlace(place);
    setSearchQuery(place.name);
    setSuggestions([]);

    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L) return;

    map.flyTo([place.lat, place.lng], 15, { duration: 1.2 });

    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }

    const html = `
      <div class="relative flex items-center justify-center" style="transform: translate(-50%, -100%);">
        <div class="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-2xl border-2 border-white">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        </div>
      </div>
    `;

    const icon = L.divIcon({
      html,
      className: "search-marker",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    searchMarkerRef.current = L.marker([place.lat, place.lng], { icon }).addTo(map);
  }

  function handleRecenter() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo(center, zoom, { duration: 1 });
    }
  }

  function handleZoomIn() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  }

  function handleZoomOut() {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  }

  return (
    <div className="relative w-full h-full bg-[#08080a] overflow-hidden select-none">
      {/* Map Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Tactical Search Pill */}
      <div className="absolute top-4 left-4 z-20 w-80">
        <div className="apple-glass rounded-2xl p-1.5 flex items-center gap-2 shadow-2xl">
          <Search size={15} className="text-zinc-400 ml-2.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Accra hospital, station, landmark..."
            className="w-full bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none py-1.5 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setSuggestions([]);
                setSelectedPlace(null);
                if (searchMarkerRef.current && mapInstanceRef.current) {
                  mapInstanceRef.current.removeLayer(searchMarkerRef.current);
                  searchMarkerRef.current = null;
                }
              }}
              className="p-1 text-zinc-400 hover:text-white rounded-lg"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {suggestions.length > 0 && (
          <div className="apple-card mt-2 rounded-2xl bg-[#121215]/95 backdrop-blur-xl border border-white/10 shadow-2xl max-h-64 overflow-y-auto p-1 divide-y divide-white/5">
            {suggestions.map((loc) => (
              <button
                key={loc.name}
                onClick={() => handleSelectPlace(loc)}
                className="w-full text-left p-2.5 rounded-xl hover:bg-white/[0.08] transition-colors flex items-start gap-2.5 group"
              >
                <MapPin size={14} className="text-red-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white group-hover:text-red-300 truncate">{loc.name}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{loc.address}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Place Card */}
      {selectedPlace && (
        <div className="absolute bottom-6 left-6 z-20 w-80 apple-card rounded-2xl p-4 bg-[#121215]/95 backdrop-blur-xl border border-white/15 shadow-2xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <span className="text-[9px] font-bold text-red-400 uppercase tracking-widest font-mono">Location Intel</span>
              <h4 className="text-sm font-bold text-white leading-snug">{selectedPlace.name}</h4>
            </div>
            <button onClick={() => setSelectedPlace(null)} className="text-zinc-500 hover:text-white p-1">
              <X size={14} />
            </button>
          </div>
          <p className="text-xs text-zinc-400 mb-3">{selectedPlace.address}</p>
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
            <span className="font-mono text-zinc-400">Coords: {selectedPlace.lat.toFixed(4)}, {selectedPlace.lng.toFixed(4)}</span>
            <button
              onClick={() => handleSelectPlace(selectedPlace)}
              className="apple-btn px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold text-xs shadow"
            >
              Focus
            </button>
          </div>
        </div>
      )}

      {/* Map Layer Controls & Quick Actions */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-2">
        <div className="apple-glass rounded-2xl p-1.5 flex flex-col gap-1 shadow-2xl">
          <button
            onClick={() => setMapType((prev) => (prev === "dark" ? "satellite" : "dark"))}
            title={mapType === "dark" ? "Switch to Satellite" : "Switch to Dark Tactical"}
            className="apple-btn w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Layers size={16} />
          </button>
          <button
            onClick={handleRecenter}
            title="Recenter Accra Metro"
            className="apple-btn w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Crosshair size={16} />
          </button>
          <div className="h-px bg-white/10 my-0.5" />
          <button
            onClick={handleZoomIn}
            title="Zoom In"
            className="apple-btn w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            +
          </button>
          <button
            onClick={handleZoomOut}
            title="Zoom Out"
            className="apple-btn w-9 h-9 rounded-xl flex items-center justify-center font-bold text-base text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            −
          </button>
        </div>
      </div>
    </div>
  );
}
