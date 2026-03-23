'use client';

import { useGuardianMesh } from '@/lib/useGuardianMesh';

/**
 * A silent, hidden client component that injects the 
 * ECHELON II Guardian Scanner across the entire mobile application.
 */
export default function GuardianMeshProvider() {
    // This hook automatically begins background-sweeping for BLE 
    // signatures as long as the user has permitted Bluetooth access.
    useGuardianMesh(true);

    // Renders absolutely nothing to the screen
    return null;
}
