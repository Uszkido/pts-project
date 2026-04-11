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
            const cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                subdomains: 'abcd',
                maxZoom: 20
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

            const esriMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '&copy; Esri', maxZoom: 20
            });

            const cartoPositron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; CARTO', maxZoom: 20
            });

            const openTopo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenTopoMap', maxZoom: 17
            });

            const nexrad = L.tileLayer('https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png', {
                opacity: 0.6, zIndex: 10
            });

            // Add the default layer - Dark Mode for PTS Surveillance Aesthetic
            cartoDark.addTo(mapInstance.current);

            // Add layer control if interactive
            if (interactive) {
                const baseMaps = {
                    "Surveillance Dark View": cartoDark,
                    "ESRI World Imagery": esriMap,
                    "CartoDB Positron": cartoPositron,
                    "OpenTopoMap": openTopo,
                    "Google Hybrid": googleHybrid,
                    "Google Satellite": googleSat,
                    "Google Streets": googleStreets,
                    "Google Terrain": googleTerrain
                };
                const overlayMaps = {
                    "Live Weather Radar (NEXRAD)": nexrad
                };
                L.control.layers(baseMaps, overlayMaps).addTo(mapInstance.current);
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
                        const isAlert = marker.color === "#ef4444";
                        const pulseHtml = isAlert
                            ? `<div class="absolute inset-0 rounded-full animate-ping" style="background-color: ${marker.color}; opacity: 0.75; transform: scale(2);"></div>`
                            : '';

                        const customIcon = L.divIcon({
                            className: 'custom-colored-pin relative',
                            html: `<div class="relative flex items-center justify-center w-full h-full">
                                     ${pulseHtml}
                                     <div class="relative z-10" style="background-color: ${marker.color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #1e293b; box-shadow: 0 0 10px ${marker.color};"></div>
                                   </div>`,
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
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
