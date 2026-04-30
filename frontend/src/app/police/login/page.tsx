'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PoliceLoginRedirect() {
    const router = useRouter();
    useEffect(() => { router.replace('/login'); }, [router]);
    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <p className="text-slate-500 text-sm animate-pulse">Redirecting to PTS login...</p>
        </div>
    );
}
