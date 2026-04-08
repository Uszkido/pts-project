"use client";

import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default Leaflet markers in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface GeoFenceMapProps {
    onSavePolygon?: (name: string, coordinates: { latitude: number, longitude: number }[]) => void;
    activeFences?: { id: string, name: string, polygon: { latitude: number, longitude: number }[] }[];
}

const LocationMarker = ({ points, setPoints }: { points: any[], setPoints: (p: any) => void }) => {
    useMapEvents({
        click(e) {
            setPoints([...points, { latitude: e.latlng.lat, longitude: e.latlng.lng }]);
        },
    });
    return null;
};

export default function GeoFenceMap({ onSavePolygon, activeFences = [] }: GeoFenceMapProps) {
    const [points, setPoints] = useState<{ latitude: number, longitude: number }[]>([]);
    const [fenceName, setFenceName] = useState("");

    // Convert our database format to Leaflet [lat, lng] format
    const drawingPositions = points.map(p => [p.latitude, p.longitude] as [number, number]);

    return (
        <div className="flex flex-col space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-white">Tactical Map Deployer</h3>
                    <p className="text-sm text-slate-400">Click on the map multiple times to trace a custom perimeter. Click Deploy when finished.</p>
                </div>
                <div className="flex space-x-2">
                    <input
                        type="text"
                        placeholder="Perimeter Name (e.g. Kano Border)"
                        value={fenceName}
                        onChange={e => setFenceName(e.target.value)}
                        className="bg-slate-800 border border-slate-700 text-white px-4 py-2 rounded-lg outline-none focus:border-red-500 w-64"
                    />
                    <button
                        onClick={() => { setPoints([]); }}
                        className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition"
                    >
                        Clear
                    </button>
                    <button
                        onClick={() => {
                            if (!fenceName) return alert('Name the perimeter first');
                            if (points.length < 3) return alert('Click to add at least 3 points to form a polygon');
                            if (onSavePolygon) onSavePolygon(fenceName, points);
                            setPoints([]);
                            setFenceName("");
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-bold"
                    >
                        Deploy Fence
                    </button>
                </div>
            </div>

            <div className="h-[600px] w-full rounded-xl overflow-hidden border border-slate-800 relative z-0">
                <MapContainer center={[9.0820, 8.6753]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        className="map-tiles"
                    />

                    <LocationMarker points={points} setPoints={setPoints} />

                    {/* Display currently drawing polygon */}
                    {drawingPositions.length > 0 && (
                        <>
                            <Polygon positions={drawingPositions} pathOptions={{ color: '#ff1100', fillColor: '#ff1100', fillOpacity: 0.2, weight: 2, dashArray: '5, 5' }} />
                            {drawingPositions.map((pos, idx) => (
                                <Marker key={idx} position={pos} />
                            ))}
                        </>
                    )}

                    {/* Display active fences from database */}
                    {activeFences.map(fence => (
                        <Polygon
                            key={fence.id}
                            positions={fence.polygon.map(p => [p.latitude, p.longitude] as [number, number])}
                            pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 2 }}
                        >
                            <Popup>
                                <div className="text-slate-900 font-bold px-2 py-1">{fence.name}</div>
                                <div className="text-xs text-slate-500 px-2 pb-1">Active Interpol Perimeter</div>
                            </Popup>
                        </Polygon>
                    ))}
                </MapContainer>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .map-tiles { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }
                .leaflet-container { background: #0f172a; }
            `}} />
        </div>
    );
}
