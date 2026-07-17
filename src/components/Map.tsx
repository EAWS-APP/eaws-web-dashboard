"use client";

import { useState, useEffect, useRef } from "react";
import { Sun, Moon, Search, Star, Route, X, MapPin } from "lucide-react";
import type { AgencyUnit, Incident } from "@/lib/models";

// Helper to calculate distance in KM (Haversine formula)
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
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

// Helper to simulate intermediate street grid points for routes
function generateRoutePoints(start: [number, number], end: [number, number]): [number, number][] {
  const mid1: [number, number] = [start[0], (start[1] + end[1]) / 2];
  const mid2: [number, number] = [end[0], (start[1] + end[1]) / 2];
  return [start, mid1, mid2, end];
}

// Helper to deduce street names based on location
function getRouteStreetName(start: [number, number], end: [number, number]): string {
  const avgLat = (start[0] + end[0]) / 2;
  const avgLng = (start[1] + end[1]) / 2;

  if (avgLat > 5.61) {
    return "via Spintex Road ➔ Boundary Road ➔ Lagos Ave";
  } else if (avgLat > 5.58) {
    return "via Liberation Road ➔ Giffard Road ➔ Bypass";
  } else if (avgLng < -0.20) {
    return "via Guggisberg Ave ➔ Kojo Thompson Road ➔ Castle Rd";
  } else {
    return "via Cantonments Road (Oxford St) ➔ Ring Road Bypass";
  }
}

// Dark Mode configuration preset for Google Maps
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#18181a" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#7b7b7f" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#18181a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#3c3c3f" }] },
  { featureType: "administrative.country", elementType: "labels.text.fill", stylers: [{ color: "#9e9e9e" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#b0b0b5" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#7b7b7f" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#111112" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#242426" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8f" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#2d2d30" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#323236" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3c3c3f" }] }
];

interface MapProps {
  center?: [number, number];
  zoom?: number;
  incidents?: Incident[];
  units?: AgencyUnit[];
  onAmbulanceMove?: (coords: [number, number]) => void;
}

export default function Map({ center = [5.6037, -0.1870], zoom = 12, incidents = [], units = [], onAmbulanceMove }: MapProps) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [searchQuery, setSearchQuery] = useState("");
  const [flyToCoords, setFlyToCoords] = useState<[number, number] | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // Map layer toggle: Roadmap vs Satellite
  const [mapType, setMapType] = useState<"roadmap" | "satellite">("roadmap");

  // Autocomplete selected place details card
  const [selectedPlace, setSelectedPlace] = useState<{
    name: string;
    address: string;
    rating: number;
    photoUrl: string;
    coords: [number, number];
  } | null>(null);

  // Dynamic custom route destination state
  const [customDestination, setCustomDestination] = useState<{
    coords: [number, number];
    title: string;
  } | null>(null);

  // Ambulance movement & follow states
  const [animatedUnitCoords, setAnimatedUnitCoords] = useState<Record<string, [number, number]>>({});
  const [autoFollow, setAutoFollow] = useState(true);

  // Google Maps instances state
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  // Keep references to map objects to perform cleanly update/cleanup
  const markersRef = useRef<any[]>([]);
  const polylinesRef = useRef<any[]>([]);
  const activeInfoWindowRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);

  // Load Google Maps JavaScript API
  useEffect(() => {
    if ((window as any).google) {
      setGoogleLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBsWnNq9bnzB8UATSXH0Hxiv6rDbQirD-Y&libraries=places`;
    script.async = true;
    script.onload = () => setGoogleLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!googleLoaded || !mapRef.current) return;
    const google = (window as any).google;
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: center[0], lng: center[1] },
      zoom: zoom,
      styles: theme === "dark" ? darkMapStyle : [],
      disableDefaultUI: true,
      zoomControl: false,
    });
    setMapInstance(map);
  }, [googleLoaded]);

  // Synchronize roadmap/satellite selection and style themes
  useEffect(() => {
    if (!mapInstance) return;
    const google = (window as any).google;
    if (!google) return;

    if (mapType === "satellite") {
      mapInstance.setOptions({
        styles: [], // Clear vector styling so satellite imagery is fully visible
        mapTypeId: google.maps.MapTypeId.SATELLITE
      });
    } else {
      mapInstance.setOptions({
        styles: theme === "dark" ? darkMapStyle : [],
        mapTypeId: google.maps.MapTypeId.ROADMAP
      });
    }
  }, [mapType, theme, mapInstance]);

  // Pan viewport to target coords from Search query
  useEffect(() => {
    if (!mapInstance || !flyToCoords) return;
    mapInstance.panTo({ lat: flyToCoords[0], lng: flyToCoords[1] });
    mapInstance.setZoom(14);
  }, [flyToCoords, mapInstance]);

  // Google Places Autocomplete Service API integration
  useEffect(() => {
    if (!googleLoaded || searchQuery.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    const google = (window as any).google;
    if (!google || !google.maps || !google.maps.places) return;

    const autocompleteService = new google.maps.places.AutocompleteService();
    const accraCenter = new google.maps.LatLng(5.6037, -0.1870);

    const delayDebounce = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        {
          input: searchQuery,
          locationBias: new google.maps.Circle({ center: accraCenter, radius: 25000 })
        },
        (predictions: any, status: any) => {
          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            setSuggestions(predictions.map((p: any) => ({
              name: p.structured_formatting.main_text,
              street: p.structured_formatting.secondary_text || "",
              placeId: p.place_id
            })));
          } else {
            setSuggestions([]);
          }
        }
      );
    }, 400);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, googleLoaded]);

  // Fetch full details and images on place selection
  const handleSelectLandmark = (placeId: string, name: string) => {
    const google = (window as any).google;
    if (!google || !mapInstance) return;

    const service = new google.maps.places.PlacesService(mapInstance);
    service.getDetails({ placeId }, (place: any, status: any) => {
      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setFlyToCoords([lat, lng]);
        setSearchQuery(name);
        setSuggestions([]);

        // Resolve Photo URL
        let photoUrl = "";
        if (place.photos && place.photos.length > 0) {
          photoUrl = place.photos[0].getUrl({ maxWidth: 450 });
        } else {
          photoUrl = "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=400&auto=format&fit=crop&q=80";
        }

        setSelectedPlace({
          name: place.name,
          address: place.formatted_address || "",
          rating: place.rating || 4.2,
          photoUrl,
          coords: [lat, lng]
        });

        // Set green search pin marker
        if (searchMarkerRef.current) {
          searchMarkerRef.current.setMap(null);
        }
        searchMarkerRef.current = new google.maps.Marker({
          position: { lat, lng },
          map: mapInstance,
          title: place.name,
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            fillColor: "#34c759", // green accent
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 7
          }
        });
      }
    });
  };

  // Fallback ambulance unit
  const activeUnits = units.length > 0 ? units : [
    {
      id: "mock-amb-01",
      name: "AMB-01 (STAGING)",
      agency_type: "ambulance",
      status: "en-route",
      latitude: 5.6322,
      longitude: -0.1585,
      created_at: new Date().toISOString()
    }
  ];

  // Active routing endpoint selection
  const activeDestinationCoords = customDestination 
    ? customDestination.coords 
    : (incidents[0] ? [incidents[0].latitude, incidents[0].longitude] as [number, number] : null);

  // Simulated movement along route points
  useEffect(() => {
    if (!activeDestinationCoords || activeUnits.length === 0) return;
    
    const firstUnit = activeUnits[0];
    const routePts = generateRoutePoints(
      [firstUnit.latitude, firstUnit.longitude],
      activeDestinationCoords
    );

    const steps: [number, number][] = [];
    for (let i = 0; i < routePts.length - 1; i++) {
      const p1 = routePts[i];
      const p2 = routePts[i + 1];
      const subdivisions = 12;
      for (let s = 0; s < subdivisions; s++) {
        const t = s / subdivisions;
        steps.push([
          p1[0] + (p2[0] - p1[0]) * t,
          p1[1] + (p2[1] - p1[1]) * t
        ]);
      }
    }
    steps.push(routePts[routePts.length - 1]);

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex >= steps.length) {
        stepIndex = 0;
      }
      const curPos = steps[stepIndex];
      setAnimatedUnitCoords((prev) => ({
        ...prev,
        [firstUnit.id]: curPos
      }));

      if (onAmbulanceMove) {
        onAmbulanceMove(curPos);
      }

      if (autoFollow) {
        setFlyToCoords(curPos);
      }

      stepIndex++;
    }, 2000);

    return () => clearInterval(interval);
  }, [activeDestinationCoords, activeUnits, autoFollow]);

  // Find nearest responder unit for each incident to simulate routing lines
  const routingLines = incidents
    .map((incident) => {
      if (activeUnits.length === 0) return null;
      
      let nearestUnit = activeUnits[0];
      const startLat = animatedUnitCoords[nearestUnit.id]?.[0] ?? nearestUnit.latitude;
      const startLng = animatedUnitCoords[nearestUnit.id]?.[1] ?? nearestUnit.longitude;

      let minDistance = calculateDistanceKm(
        startLat,
        startLng,
        incident.latitude,
        incident.longitude
      );

      for (let i = 1; i < activeUnits.length; i++) {
        const uLat = animatedUnitCoords[activeUnits[i].id]?.[0] ?? activeUnits[i].latitude;
        const uLng = animatedUnitCoords[activeUnits[i].id]?.[1] ?? activeUnits[i].longitude;
        const d = calculateDistanceKm(
          uLat,
          uLng,
          incident.latitude,
          incident.longitude
        );
        if (d < minDistance) {
          minDistance = d;
          nearestUnit = activeUnits[i];
        }
      }

      const finalLat = animatedUnitCoords[nearestUnit.id]?.[0] ?? nearestUnit.latitude;
      const finalLng = animatedUnitCoords[nearestUnit.id]?.[1] ?? nearestUnit.longitude;

      const destCoords = customDestination ? customDestination.coords : [incident.latitude, incident.longitude] as [number, number];
      const destTitle = customDestination ? customDestination.title : incident.title;

      const roadDistance = parseFloat((minDistance * 1.3).toFixed(1));
      const driveEta = Math.max(2, Math.round(roadDistance * 2.5));

      return {
        id: incident.id,
        incident: { ...incident, title: destTitle, latitude: destCoords[0], longitude: destCoords[1] },
        unit: nearestUnit,
        coords: generateRoutePoints(
          [finalLat, finalLng],
          destCoords
        ),
        distance: roadDistance,
        eta: driveEta,
        streets: getRouteStreetName(
          [finalLat, finalLng],
          destCoords
        ),
      };
    })
    .filter(Boolean) as {
    id: string;
    incident: Incident;
    unit: AgencyUnit;
    coords: [number, number][];
    distance: number;
    eta: number;
    streets: string;
  }[];

  // Draw overlay items on Google Map
  useEffect(() => {
    if (!mapInstance) return;
    const google = (window as any).google;
    if (!google) return;

    // Clear old elements
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (activeInfoWindowRef.current) {
      activeInfoWindowRef.current.close();
    }

    // 1. Draw Incidents (if not customized or route updated)
    incidents.forEach((incident) => {
      // If custom route is active, hide main incident pin to reduce visual noise
      if (customDestination) return;

      const pinColor = incident.status === "escalated" ? "#ef4444" : "#dc2626";
      const marker = new google.maps.Marker({
        position: { lat: incident.latitude, lng: incident.longitude },
        map: mapInstance,
        title: incident.title,
        icon: {
          path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
          fillColor: pinColor,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 1.5,
          anchor: new google.maps.Point(12, 22),
        },
      });

      const infoContent = `
        <div style="color: #1c1c1e; font-family: monospace; font-size: 11px; padding: 4px; line-height: 1.3;">
          <h4 style="margin: 0 0 4px 0; color: #dc2626; font-weight: 800;">${incident.title}</h4>
          <p style="margin: 0 0 6px 0; color: #55555c;">${incident.location_name}</p>
          <div style="background-color: #f2f2f7; border: 1px solid #d1d1d6; padding: 6px; border-radius: 4px;">
            <strong>Category:</strong> ${incident.category}<br/>
            <strong>Severity:</strong> ${incident.severity}
          </div>
        </div>
      `;

      const infowindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("click", () => {
        if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
        infowindow.open(mapInstance, marker);
        activeInfoWindowRef.current = infowindow;
      });

      markersRef.current.push(marker);
    });

    // 2. Draw activeUnits (Ambulances)
    activeUnits.forEach((unit) => {
      const uLat = animatedUnitCoords[unit.id]?.[0] ?? unit.latitude;
      const uLng = animatedUnitCoords[unit.id]?.[1] ?? unit.longitude;

      const marker = new google.maps.Marker({
        position: { lat: uLat, lng: uLng },
        map: mapInstance,
        title: unit.name,
        icon: {
          path: "M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z",
          fillColor: "#007aff",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: 1.2,
          anchor: new google.maps.Point(12, 12),
        },
      });

      const infoContent = `
        <div style="color: #1c1c1e; font-family: monospace; font-size: 11px; padding: 4px;">
          <h4 style="margin: 0 0 4px 0; color: #007aff; font-weight: bold;">${unit.name}</h4>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background-color: #e5f1ff; border: 1px solid #99ccff; color: #0056b3; font-size: 9px; font-weight: bold; text-transform: uppercase;">
            ${unit.status}
          </span>
        </div>
      `;

      const infowindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("click", () => {
        if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
        infowindow.open(mapInstance, marker);
        activeInfoWindowRef.current = infowindow;
      });

      markersRef.current.push(marker);
    });

    // 3. Draw Route Polylines & Strobes
    routingLines.forEach((line) => {
      const path = line.coords.map((c) => ({ lat: c[0], lng: c[1] }));

      const poly = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#007aff",
        strokeOpacity: 0.8,
        strokeWeight: 5,
        map: mapInstance,
      });

      const strobe = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: "#ef4444",
        strokeOpacity: 0.95,
        strokeWeight: 3.5,
        icons: [{
          icon: {
            path: "M 0,-1 0,1",
            strokeOpacity: 1,
            scale: 3,
          },
          offset: "0",
          repeat: "18px",
        }],
        map: mapInstance,
      });

      poly.addListener("click", (e: any) => {
        const infowindow = new google.maps.InfoWindow({
          content: `
            <div style="color: #1c1c1e; font-family: monospace; font-size: 10px; padding: 2px;">
              <strong>Route Diagnostics:</strong><br/>
              Target: ${line.incident.title}<br/>
              Via: <span style="color: #0056b3;">${line.streets}</span><br/>
              Distance: <strong>${line.distance} km</strong>
            </div>
          `,
          position: e.latLng,
        });
        if (activeInfoWindowRef.current) activeInfoWindowRef.current.close();
        infowindow.open(mapInstance);
        activeInfoWindowRef.current = infowindow;
      });

      polylinesRef.current.push(poly);
      polylinesRef.current.push(strobe);
    });

  }, [mapInstance, incidents, activeUnits, animatedUnitCoords, routingLines, customDestination]);

  // Clean up custom search marker when place is closed
  const handleClosePlaceCard = () => {
    setSelectedPlace(null);
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }
  };

  // Reset custom route back to main incident
  const handleResetRoute = () => {
    setCustomDestination(null);
  };

  return (
    <div className="w-full h-full relative z-0 flex overflow-hidden">
      {/* Tactical HUD overlays */}
      <div className="scanner-line pointer-events-none" />
      <div className="scanline absolute inset-0 z-30 opacity-40 pointer-events-none" />
      
      {/* Floating Location Search Widget */}
      <div className="absolute top-4 left-4 z-[1000] w-72 bg-neutral-900/90 backdrop-blur border border-neutral-800 rounded-lg p-1.5 shadow-lg select-none pointer-events-auto">
        <div className="relative flex items-center bg-neutral-950 rounded border border-neutral-800 px-2 py-1.5">
          <Search size={14} className="text-neutral-500 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Accra landmarks / streets..."
            className="w-full bg-transparent border-none text-xs text-white placeholder-neutral-500 focus:outline-none"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="text-neutral-500 hover:text-white shrink-0 ml-1">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Search Suggestion Dropdown */}
        {suggestions.length > 0 && (
          <div className="mt-1 bg-neutral-900 border border-neutral-800 rounded shadow-2xl max-h-48 overflow-y-auto divide-y divide-neutral-850">
            {suggestions.map((l) => (
              <div
                key={l.placeId}
                onClick={() => handleSelectLandmark(l.placeId, l.name)}
                className="p-2 text-[10px] hover:bg-neutral-800 cursor-pointer flex flex-col gap-0.5"
              >
                <span className="font-semibold text-white">{l.name}</span>
                <span className="text-neutral-500 font-mono text-[9px]">{l.street}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Slide-out Place Details Card */}
      {selectedPlace && (
        <div className="absolute top-16 left-4 z-[1000] w-72 bg-[#1C1C1E]/95 border border-[#3A3A3C] rounded-lg overflow-hidden shadow-2xl select-none pointer-events-auto flex flex-col font-mono text-[10px] transition-all duration-300">
          <div className="relative h-28 w-full bg-neutral-950">
            <img 
              src={selectedPlace.photoUrl} 
              alt={selectedPlace.name} 
              className="w-full h-full object-cover opacity-80"
            />
            <button 
              onClick={handleClosePlaceCard}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-black/80 transition-all"
            >
              <X size={12} />
            </button>
          </div>
          <div className="p-3 space-y-2.5">
            <div>
              <h3 className="font-extrabold text-white text-xs uppercase leading-tight">{selectedPlace.name}</h3>
              <p className="text-[8px] text-neutral-400 leading-normal mt-0.5">{selectedPlace.address}</p>
            </div>

            <div className="flex items-center gap-2 border-y border-neutral-800 py-1.5">
              <span className="flex items-center gap-0.5 text-amber-500 font-bold">
                <Star size={10} fill="currentColor" />
                {selectedPlace.rating.toFixed(1)}
              </span>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-400 uppercase text-[8px] flex items-center gap-0.5">
                <MapPin size={10} className="text-primary" />
                Verified GPS Node
              </span>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => setCustomDestination({ coords: selectedPlace.coords, title: selectedPlace.name })}
                className="flex-1 bg-primary hover:bg-primary/90 text-on-primary font-bold py-1.5 rounded flex items-center justify-center gap-1 uppercase transition-all"
              >
                <Route size={10} />
                Route to Place
              </button>
              {customDestination && (
                <button 
                  onClick={handleResetRoute}
                  className="px-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold rounded flex items-center justify-center uppercase transition-all"
                  title="Reset to Incident Route"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Auto-Follow Control */}
      <div className="absolute top-4 right-[250px] z-[1000] flex bg-neutral-900/90 backdrop-blur border border-neutral-800 rounded-lg p-2.5 shadow-lg select-none pointer-events-auto items-center gap-1.5 h-9">
        <label className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-white uppercase font-mono">
          <input
            type="checkbox"
            checked={autoFollow}
            onChange={(e) => setAutoFollow(e.target.checked)}
            className="rounded border-neutral-700 bg-neutral-950 text-primary focus:ring-0 w-3.5 h-3.5"
          />
          Auto-Follow Responders
        </label>
      </div>

      {/* Map Mode Layers Toggles */}
      <div className="absolute top-4 right-44 z-[1000] flex bg-neutral-900/90 backdrop-blur border border-neutral-800 rounded-lg p-0.5 shadow-lg select-none pointer-events-auto h-9 items-center">
        <button
          type="button"
          onClick={() => setMapType("roadmap")}
          className={`px-3 py-1.5 text-[9px] font-extrabold rounded-md uppercase font-mono transition-all ${
            mapType === "roadmap"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => setMapType("satellite")}
          className={`px-3 py-1.5 text-[9px] font-extrabold rounded-md uppercase font-mono transition-all ${
            mapType === "satellite"
              ? "bg-primary text-on-primary shadow-sm"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Satellite
        </button>
      </div>

      {/* Floating Theme Toggle Widget */}
      <div className="absolute top-4 right-4 z-[1000] flex bg-neutral-900/90 backdrop-blur border border-neutral-800 rounded-lg p-0.5 shadow-lg select-none pointer-events-auto">
        <button
          type="button"
          onClick={() => setTheme("dark")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            theme === "dark"
              ? "bg-neutral-800 text-white shadow-sm"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Sun size={14} />
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme("light")}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
            theme === "light"
              ? "bg-white text-neutral-900 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Sun size={14} />
          Light
        </button>
      </div>

      {/* Google Map Container Ref */}
      <div ref={mapRef} className="w-full h-full rounded-lg" style={{ minHeight: "350px" }} />
    </div>
  );
}
