'use client';

import React, { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapComponentProps {
    latitude?: number;
    longitude?: number;
    zoom?: number;
    interactive?: boolean;
    markers?: Array<{
        lat: number;
        lng: number;
        label?: string;
        color?: string;
    }>;
    className?: string;
}

export default function MapComponent({
    latitude = 9.0820, // Center of Nigeria
    longitude = 8.6753,
    zoom = 6,
    interactive = true,
    markers = [],
    className = "h-full w-full rounded-2xl"
}: MapComponentProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);
    const markerLayer = useRef<any>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || mapInstance.current) return;

        const initMap = async () => {
            const L = (await import('leaflet')).default;

            // Fix for default marker icons
            // @ts-ignore
            delete L.Icon.Default.prototype._getIconUrl;
            L.Icon.Default.mergeOptions({
                iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
                iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
                shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
            });

            if (!mapContainer.current) return;

            // Initialize Map
            mapInstance.current = L.map(mapContainer.current, {
                center: [latitude, longitude],
                zoom: zoom,
                zoomControl: interactive,
                dragging: interactive,
                scrollWheelZoom: interactive,
                attributionControl: true
            });

            // Add Base Layers
            const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            });

            const googleStreets = L.tileLayer('http://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps'
            });

            const googleHybrid = L.tileLayer('http://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps'
            });

            const googleSat = L.tileLayer('http://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps'
            });

            const googleTerrain = L.tileLayer('http://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
                maxZoom: 20,
                subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
                attribution: '&copy; Google Maps'
            });

            // Add the default layer
            googleStreets.addTo(mapInstance.current);

            // Add layer control if interactive
            if (interactive) {
                const baseMaps = {
                    "Google Streets": googleStreets,
                    "Google Satellite": googleSat,
                    "Google Hybrid": googleHybrid,
                    "Google Terrain": googleTerrain,
                    "OpenStreetMap": osm
                };
                L.control.layers(baseMaps).addTo(mapInstance.current);
            }

            // Initialize Marker Layer
            markerLayer.current = L.layerGroup().addTo(mapInstance.current);

            // Force a resize fix
            setTimeout(() => {
                if (mapInstance.current) mapInstance.current.invalidateSize();
            }, 200);
        };

        initMap();

        return () => {
            if (mapInstance.current) {
                mapInstance.current.remove();
                mapInstance.current = null;
            }
        };
    }, []);

    // Update markers dynamically
    useEffect(() => {
        if (!mapInstance.current || !markerLayer.current) return;

        const updateMarkers = async () => {
            const L = (await import('leaflet')).default;
            markerLayer.current.clearLayers();
            markers.forEach(marker => {
                if (marker.lat && marker.lng) {
                    let m;
                    if (marker.color) {
                        const customIcon = L.divIcon({
                            className: 'custom-colored-pin',
                            html: `<div style="background-color: ${marker.color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.5);"></div>`,
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        });
                        m = L.marker([marker.lat, marker.lng], { icon: customIcon });
                    } else {
                        m = L.marker([marker.lat, marker.lng]);
                    }

                    if (marker.label) {
                        m.bindPopup(`<b>${marker.label}</b>`);
                    }
                    m.addTo(markerLayer.current!);
                }
            });
        };

        updateMarkers();
    }, [markers]);

    return (
        <div className={`relative z-10 ${className}`} style={{ minHeight: '400px', background: '#0f172a' }}>
            <div ref={mapContainer} className="h-full w-full" />
        </div>
    );
}
