import React, { useState, useEffect } from 'react';

const SLIDES = [
    {
        title: "Verify Instantly",
        description: "Snap a photo of the device IMEI or manually enter it to check its nationwide status. Protect yourself from buying stolen phones.",
        icon: (
            <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
        ),
        color: "from-blue-500/20 to-indigo-500/20",
        borderColor: "border-blue-500/30"
    },
    {
        title: "Facial Liveness",
        description: "Our AI engines use Exadel CompreFace to match your live selfie with your provided ID card. 100% automated identity assurance.",
        icon: (
            <svg className="w-12 h-12 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        ),
        color: "from-emerald-500/20 to-teal-500/20",
        borderColor: "border-emerald-500/30"
    },
    {
        title: "Document Auto-Scan",
        description: "No more typing out long NINs. Just point your camera at your national ID, and our Regula AI engine extracts everything for you.",
        icon: (
            <svg className="w-12 h-12 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
        ),
        color: "from-purple-500/20 to-pink-500/20",
        borderColor: "border-purple-500/30"
    }
];

export default function BananaSlides() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    useEffect(() => {
        if (isHovered) return;

        const timer = setInterval(() => {
            setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
        }, 5000);

        return () => clearInterval(timer);
    }, [isHovered]);

    return (
        <div
            className="w-full max-w-sm mx-auto mt-12 overflow-hidden rounded-3xl relative group"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <div className={`absolute inset-0 bg-gradient-to-br transition-colors duration-1000 ${SLIDES[currentSlide].color} blur-2xl opacity-50`}></div>

            <div className={`relative bg-slate-900/80 backdrop-blur-xl border transition-colors duration-1000 ${SLIDES[currentSlide].borderColor} p-8 rounded-3xl h-64 flex flex-col items-center justify-center text-center shadow-2xl`}>

                {/* Slides Track */}
                <div className="w-full relative h-full flex overflow-hidden">
                    {SLIDES.map((slide, index) => (
                        <div
                            key={index}
                            className={`absolute inset-0 flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] w-full h-full ${index === currentSlide ? 'opacity-100 translate-x-0 scale-100' : index < currentSlide ? 'opacity-0 -translate-x-full scale-95' : 'opacity-0 translate-x-full scale-95'}`}
                        >
                            <div className="mb-4 transform transition-transform duration-500 group-hover:scale-110">
                                {slide.icon}
                            </div>
                            <h3 className="text-xl font-black text-white mb-2">{slide.title}</h3>
                            <p className="text-xs text-slate-400 font-medium leading-relaxed max-w-[280px]">{slide.description}</p>
                        </div>
                    ))}
                </div>

                {/* Progress Indicators */}
                <div className="absolute bottom-4 flex gap-2">
                    {SLIDES.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`h-1.5 rounded-full transition-all duration-500 overflow-hidden relative ${index === currentSlide ? 'w-8 bg-slate-700' : 'w-2 bg-slate-800'}`}
                        >
                            {index === currentSlide && !isHovered && (
                                <div className="absolute top-0 left-0 h-full bg-white transition-all ease-linear" style={{ animation: 'progress 5s linear infinite' }}></div>
                            )}
                            {index === currentSlide && isHovered && (
                                <div className="absolute top-0 left-0 h-full w-full bg-white"></div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Global Keyframes for Progress Bar */}
            <style jsx>{`
                @keyframes progress {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
            `}</style>
        </div>
    );
}
