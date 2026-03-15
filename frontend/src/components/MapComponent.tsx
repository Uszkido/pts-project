'use client';

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
const fixLeafletIcons = () => {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
};

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
    const mapInstance = useRef<L.Map | null>(null);
    const markerLayer = useRef<L.LayerGroup | null>(null);

    useEffect(() => {
        if (typeof window === 'undefined' || !mapContainer.current || mapInstance.current) return;

        fixLeafletIcons();

        // Initialize Map
        mapInstance.current = L.map(mapContainer.current, {
            center: [latitude, longitude],
            zoom: zoom,
            zoomControl: interactive,
            dragging: interactive,
            scrollWheelZoom: interactive,
            attributionControl: true
        });

        // Add OSM Tile Layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance.current);

        // Initialize Marker Layer
        markerLayer.current = L.layerGroup().addTo(mapInstance.current);

        // Force a resize fix for some layouts
        setTimeout(() => {
            if (mapInstance.current) mapInstance.current.invalidateSize();
        }, 100);

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

        // Clear existing markers
        markerLayer.current.clearLayers();

        // Add new markers
        markers.forEach(marker => {
            if (marker.lat && marker.lng) {
                // Create a custom colored marker or default
                const m = L.marker([marker.lat, marker.lng]);
                if (marker.label) {
                    m.bindPopup(`<b>${marker.label}</b>`);
                }
                m.addTo(markerLayer.current!);
            }
        });
    }, [markers]);

    return (
        <div className={`relative z-10 ${className}`} style={{ minHeight: '400px', background: '#0f172a' }}>
            <div ref={mapContainer} className="h-full w-full" />
        </div>
    );
}
