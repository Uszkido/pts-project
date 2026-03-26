'use client';

import dynamic from 'next/dynamic';
import React from 'react';

// Use dynamic import to disable Server-Side Rendering (SSR) 
// because the Sentinel HUD relies heavily on window, localStorage, and browser Geolocation APIs
const SentinelWebNoSSR = dynamic(
    () => import('@/components/sentinel/SentinelWeb'),
    { ssr: false }
);

export default function SentinelPage() {
    return (
        <div style={{ height: '100vh', width: '100vw', backgroundColor: '#000', overflow: 'hidden' }}>
            <SentinelWebNoSSR />
        </div>
    );
}
