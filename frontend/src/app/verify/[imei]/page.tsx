import VerificationClient from "./VerificationClient";

export function generateStaticParams() {
    // For static export, we need at least one entry for the build to pass.
    // At runtime, Capacitor/PWAs can usually handle other params dynamically
    // if configured with a fallback or if we are using hash routing.
    return [{ imei: 'placeholder' }];
}

export default function VerificationPage() {
    return <VerificationClient />;
}
