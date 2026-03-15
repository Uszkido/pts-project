'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

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
    latitude = 6.5244, // Default to Lagos, Nigeria
    longitude = 3.3792,
    zoom = 12,
    interactive = true,
    markers = [],
    className = "h-full w-full rounded-2xl"
}: MapComponentProps) {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<maplibregl.Map | null>(null);
    const markerRefs = useRef<maplibregl.Marker[]>([]);

    useEffect(() => {
        if (map.current) return;
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: {
                version: 8,
                sources: {
                    'osm': {
                        type: 'raster',
                        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                        tileSize: 256,
                        attribution: '&copy; OpenStreetMap Contributors'
                    }
                },
                layers: [
                    {
                        id: 'osm',
                        type: 'raster',
                        source: 'osm',
                        minzoom: 0,
                        maxzoom: 19
                    }
                ]
            },
            center: [longitude, latitude],
            zoom: zoom,
            interactive: interactive
        });

        map.current.on('load', () => {
            console.log('Map engine initialized with OSM raster layer');
        });

        map.current.on('error', (e) => {
            console.error('Telemetric Map Error:', e.error);
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    }, [latitude, longitude, zoom, interactive]);

    useEffect(() => {
        if (!map.current) return;

        // Clear existing markers
        markerRefs.current.forEach(m => m.remove());
        markerRefs.current = [];

        // Add new markers
        markers.forEach(marker => {
            const m = new maplibregl.Marker({ color: marker.color || "#ef4444" })
                .setLngLat([marker.lng, marker.lat])
                .setPopup(marker.label ? new maplibregl.Popup().setHTML(`<b>${marker.label}</b>`) : undefined)
                .addTo(map.current!);
            markerRefs.current.push(m);
        });
    }, [markers]);

    return (
        <div className={`relative ${className}`}>
            <div ref={mapContainer} className="absolute inset-0" />
        </div>
    );
}
