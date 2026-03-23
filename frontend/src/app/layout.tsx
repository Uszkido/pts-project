import type { Metadata } from "next";
import "./globals.css";
import GuardianMeshProvider from '@/components/GuardianMeshProvider';

export const metadata: Metadata = {
  title: "PTS Sentinel | National Device Integrity Registry",
  description: "The decentralized digital authority for phone ownership in Nigeria.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200;300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <GuardianMeshProvider />
        {children}
        {/* Service Worker for Offline/PWA features */}
        <script dangerouslySetInnerHTML={{
          __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(registration) {
                console.log('PTS ServiceWorker registration successful with scope: ', registration.scope);
              }, function(err) {
                console.log('PTS ServiceWorker registration failed: ', err);
              });
            });
          }
        `}} />
      </body>
    </html>
  );
}

// Build sync 03/15/2026