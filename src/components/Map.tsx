"use client";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import type { AgencyUnit, Incident } from "@/lib/models";

// Fix for default marker icons in Leaflet with Next.js
const customIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// A custom pulsing red marker for emergencies
const emergencyIcon = new L.DivIcon({
  className: "emergency-marker",
  html: `<div class="relative flex h-8 w-8 items-center justify-center">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
          <span class="relative inline-flex h-4 w-4 rounded-full bg-red-600 border-2 border-white"></span>
        </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

interface MapProps {
  center?: [number, number];
  zoom?: number;
  incidents?: Incident[];
  units?: AgencyUnit[];
}

export default function Map({ center = [5.6037, -0.1870], zoom = 12, incidents = [], units = [] }: MapProps) {
  // Center is Accra, Ghana by default
  
  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        {incidents.map((incident) => (
          <Marker key={incident.id} position={[incident.latitude, incident.longitude]} icon={emergencyIcon}>
            <Popup className="emergency-popup">
              <div className="p-1">
                <h3 className="font-bold text-red-600 mb-1">{incident.title}</h3>
                <p className="text-sm text-gray-700">{incident.location_name}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {incident.category} · {incident.severity}
                </p>
                <button className="mt-2 w-full bg-red-600 text-white py-1 rounded text-sm font-medium hover:bg-red-700 transition">
                  Dispatch Action
                </button>
              </div>
            </Popup>
          </Marker>
        ))}

        {units.map((unit) => (
          <Marker key={unit.id} position={[unit.latitude, unit.longitude]} icon={customIcon}>
            <Popup>
              <div className="p-1">
                <h3 className="font-bold text-blue-600 mb-1">{unit.name}</h3>
                <p className="text-sm text-gray-700">{unit.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
