/**
 * PTS CRIMINAL INTELLIGENCE DATASET (Nigeria 2026)
 * Knowledge base for investigative AI analysis of device theft and fraud patterns.
 */
module.exports = {
    CRIME_CATEGORIES: [
        {
            type: "Direct Theft",
            methods: ["Snatching (Okada/Keke)", "Pickpocketing in transit (Danfo/BRT)", "Home burglary", "Store break-ins", "'Yan Daba' daylight raids"],
            impact: "Immediate loss of physical asset and potential data breach."
        },
        {
            type: "Social Engineering (Fraud)",
            methods: ["Fake Bank Alert (Flash NGN)", "SIM Swap via NIN/BVN phishing", "OTP theft through 'Customer Care' calls", "Fake Job Ushering scams"],
            impact: "Financial drain and unauthorized device ownership transfer."
        },
        {
            type: "Hardware Harvesting",
            methods: ["Dismantling for screens / batteries", "IMEI Cloning / Logic board swaps", "Chop-shop operations (Foundry)"],
            impact: "Destruction of device traceability unless 'Hardware DNA' is logged."
        },
        {
            type: "Phone Kidnapping",
            methods: ["Ransom requests for returned device", "Extortion using sensitive photos found on phone"],
            impact: "Psychological trauma and continued financial loss."
        }
    ],

    SYNDICATE_OPERATIONS: {
        RESALE_HUBS: [
            { location: "Computer Village (Lagos)", description: "High turnover of 'second-hand' premium devices. Suspected 'fences' operate in small stalls, often using 'movie tricks' (sleight of hand) to swap original for fake during negotiation." },
            { location: "Obosi Market (Anambra)", description: "Eastward hub for dismantled and harvested components." },
            { location: "Farm Center (Kano)", description: "GSM hub prone to large-scale coordinated raids by armed thugs ('Yan Daba)." },
            { location: "GSM Village (Abuja)", description: "Transit hub for high-end government and corporate devices." }
        ],
        SMUGGLING_ROUTES: {
            WEST: "Lagos-Cotonou (Benin): Primary exit for high-end stolen iPhones.",
            NORTH: "Kano-Maradi (Niger): Exit route for Android devices to the Sahel.",
            EAST: "Maiduguri-Cameroon: Cross-border smuggling via porous borders."
        },
        MODUS_OPERANDI: [
            "Immediate SIM removal to prevent tracking",
            "Rapid state-line crossing within 12 hours of theft (Interstate transit)",
            "Wiping device firmware via specialty boxes (Octoplus, Z3X, Chimera)",
            "Listing on P2P marketplaces (Jiji, Facebook) at 40-60% market value",
            "Packaging 'China phones' (counterfeits) as originals for unsuspecting buyers"
        ]
    },

    HOTSPOT_METRICS: {
        HIGH_RISK_ZONES: [
            "Public transport terminals (Oshodi, Nyanya, Sabo)",
            "Nightlife districts (Victoria Island, Wuse II) with low lighting",
            "Unverified roadside physical stalls near major tech markets"
        ],
        PEAK_TIMES: "18:00 - 22:00 (Rush hour/Commute), 01:00 - 05:00 (Residential burglary / Night raids)"
    },

    ENFORCEMENT_CHANNELS: {
        NPF: "Nigeria Police Force - Standard reporting; SAR (Special Anti-Robbery) historical context.",
        EFCC: "Economic and Financial Crimes Commission - Reporting for high-value tech fraud and 'Yahoo Yahoo' syndicates.",
        INTERPOL: "Used for cross-border tracking of premium devices across West African borders.",
        PTS_SENTINEL: "Direct forensic link to registry for immediate device lockdown and tracking."
    }
};

