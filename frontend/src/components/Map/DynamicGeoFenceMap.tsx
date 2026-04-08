"use client";
import dynamic from 'next/dynamic';

// We MUST dynamically import the map with no SSR because Leaflet uses the window object heavily.
const GeoFenceMap = dynamic(() => import('./GeoFenceMap'), {
    ssr: false,
    loading: () => (
        <div className="h-[600px] w-full flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-xl">
            <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-slate-400 font-mono text-sm animate-pulse">Initializing Satellite Uplink...</p>
        </div>
    )
});

export default GeoFenceMap;
