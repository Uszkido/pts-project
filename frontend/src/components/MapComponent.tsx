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
    const apiKey = process.env.NEXT_PUBLIC_MAPTILER_API_KEY;

    useEffect(() => {
        if (map.current) return; // stops map from intializing more than once
        if (!mapContainer.current) return;

        map.current = new maplibregl.Map({
            container: mapContainer.current,
            style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
            center: [longitude, latitude],
            zoom: zoom,
            interactive: interactive
        });

        map.current.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Add markers
        markers.forEach(marker => {
            new maplibregl.Marker({ color: marker.color || "#ef4444" })
                .setLngLat([marker.lng, marker.lat])
                .setPopup(marker.label ? new maplibregl.Popup().setHTML(`<b>${marker.label}</b>`) : undefined)
                .addTo(map.current!);
        });

    }, [apiKey, latitude, longitude, zoom, interactive, markers]);

    return (
        <div className={`relative ${className}`}>
            <div ref={mapContainer} className="absolute inset-0" />
        </div>
    );
}
