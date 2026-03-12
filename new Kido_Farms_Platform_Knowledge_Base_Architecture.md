# 🌿 Kido Farms | Platform Knowledge Base & Architecture
**Comprehensive Technical Authority & AI Grounding Document**  
**Project Owner**: Kido Farms Team  
**Version**: 5.0 (Bio-Digital Infrastructure)  
**Status**: Gold Master Archive

---

## 1. 🌍 Core Mission & System Identity
**Kido Farms** is an advanced "Sovereign Food System" and agri-tech commerce platform. It surpasses a basic B2C marketplace by digitizing and connecting the entire agricultural supply chain. 

The ecosystem spans from the soil (**Heritage DNA**, **Harvest Tracking**) to logistics (**Last-Mile Nodes**), P2P and B2B Commerce (**Group Buys**, **Chef-Direct**), community-driven financing (**Agri-Crowdfunding/Farm Sponsorships**), and global export operations (**Global-Bridge**). Its goal is to deliver transparency, empower local farmers to export globally, reduce waste via energy marketplaces, and ensure high-fidelity food lineage.

---

## 2. 🧱 The Technological Pillars (Stack Architecture)
The platform is built on a modern, decoupled web architecture engineered for real-time agricultural data, marketplace concurrency, and smooth user experiences across multiple complex roles.

*   **⚡ Frontend (UI/UX)**: 
    *   **Framework**: Next.js 15+ (App Router).
    *   **Optimization**: Server-Side Rendering (SSR) for real-time dashboards and dynamic state management.
    *   **Styling**: Custom Tailwind CSS. Deep Dark/Premium theme (`#06120e` base, `#C5A059` gold accents, `#1a3c34` green hints). Modern typography using the **Outfit** Google Font.
*   **⚙️ Backend (API Layer)**: 
    *   **Engine**: Node.js (Express).
    *   **Logic**: RESTful API design. All sensitive operations are heavily guarded by JWT authentication, intricate role checks, and OTP verification flows.
*   **💾 Database (Ledger Tier)**: 
    *   **Engine**: PostgreSQL.
    *   **Interface**: **Drizzle ORM** for highly performant, type-safe database interactions and relational complex queries.
*   **☁️ Deployment (CI/CD)**: 
    *   **Hosting**: Vercel (Frontend & Serverless logic).
    *   **Environment**: Environment variables segregate logic (development/production).

---

## 3. 🛡️ The "Evolutionary Echelons" (Strategic Roadmap)
Kido Farms is structured into progressive feature tiers, expanding the baseline platform into a fully sovereign agricultural ecosystem.

### **Kido 1.0 & 2.0: Foundation & Community Commerce**
*   **Multi-Tier Architecture**: 15 distinct user roles (Consumers, Farmers, Vendors, Affiliates, Distributors, Sub-Admins, etc.).
*   **Wallets (Internal FinTech)**: Closed-circuit P2P economy and escrow functionality.
*   **Group Buys**: Neighborhood-shared purchasing capabilities for bulk agricultural produce.
*   **Vendor Stories**: Media-rich vertical feeds (akin to social media) allowing farmers and vendors to post updates.

### **Kido 3.0: Engagement, Logistics & Data**
*   **Farm-Sponsor**: Agri-Crowdfunding. Users sponsor harvests for discounts, equity, or fixed returns.
*   **Last-Mile Node**: Intelligent shipment routing and logistics distributor tracking.
*   **Price Oracle**: AI-driven market prediction indexing low, high, and current regional crop prices.

### **Kido 4.0: Infrastructure & Security**
*   **Yield-Shield**: Parametric micro-insurance for farmers utilizing APIs based on weather and trigger conditions.
*   **Cold-Vault Nodes**: Smart storage and warehouse inventory tracking (temperature, humidity, batch status).
*   **Heritage DNA**: Digital passports for produce containing a mock DNA Hash, soil health scores, and QR-based video proof of harvest/pesticide-free status.
*   **Chef-Direct**: B2B Portal targeting wholesale buyers, businesses, and hotels.

### **Kido 5.0 (Bio-Digital): The Sovereign Food System**
*   **Global-Bridge**: Streamlining international export documentation, ISO/Organic certifications, and destination tracking.
*   **Waste-to-Wealth (Energy Node)**: A sovereign marketplace for trading agricultural waste (biomass, husk, compost) into credits.
*   **Mastery Academy**: Skill gamification. Farmers earn points and level up to unlock better financing, premium seeds, or specialized infrastructure access.

---

## 4. 🗄️ Database Schema & Object Models (Drizzle)
For AI Grounding: The following core definitions exist within [backend/src/db/schema.js](file:///c:/Users/COMPUTER%2013/.gemini/antigravity/scratch/kido-farms-ecommerce/backend/src/db/schema.js).

| Category | Key Entities | Specific Roles/Attributes |
| :--- | :--- | :--- |
| **Identity & Access** | `users`, `vendors`, `farmers`, `affiliates`, `teamMembers` | Features 15+ enum roles. `farmers` track `masteryLevel`, `isExportCertified`. `vendors` manage `businessName` and APIs. |
| **Core Commerce** | `products`, `orders`, `orderItems`, `wallets`, `groupBuys` | `groupBuys` manages community pooling. `wallets` handle robust `trustScore` and `creditLimit`. |
| **Agri-Tech tracking**| `harvests`, `farmMonitoringData`, `sensors` | Tracks `satelliteLock`, environmental factors, growth percentage (0-100), and `IoT` data telemetry. |
| **Sovereign Layer** | `heritagePassports`, `energyMarketplace`, `priceOracle`, `globalBridge` | `heritagePassports`: soil health, DNA hashing. `priceOracle`: market prediction. `energyMarketplace`: waste trading. |
| **Administration** | `settings`, `activityLogs`, `impactMetrics`, `landingSections` | Dynamic platform configuration, metric tracking. Replaces static code with backend-controllable UI arrays. |

---

## 5. 🔄 Core System Workflows

### **Workflow 1: Soil-to-Market Traceability (Heritage DNA Workflow)**
1.  **Planting**: A seed is registered; the `harvests` table logs region, estimated completion, and assigns a `satelliteLock`.
2.  **Telemetry**: Simulated IoT devices update the `sensors` table (tracking soil moisture, anomalies).
3.  **Harvest/Passport Issuance**: Upon completion, a `heritagePassport` is generated yielding a `dnaHash` and QR code.
4.  **Verification**: The end-consumer scans the QR to witness the un-editable supply-chain lifecycle, guaranteeing pesticide-free status.

### **Workflow 2: Agri-Crowdfunding (Yield Sponsorship)**
1.  **Farmer Request**: A verified farmer (`masteryLevel` checked) creates a funding request targeting an upcoming `harvest`.
2.  **Sponsorship**: Investors/consumers fund the harvest via the `farmSponsorships` table using funds from their Kido `wallets`.
3.  **Maturity & Payout**: The crop matures. System automatically calculates predefined `rewardType` (discount, equity ROI) and executes payouts to the sponsor's wallet.

### **Workflow 3: Waste-to-Wealth (Sovereign Energy Marketplace)**
1.  **Deposit**: User/Farmer logs biowaste (Bio-mass, husks) onto the system via the `energyMarketplace`.
2.  **Conversion**: The algorithm converts the raw kilo-tonnage into platform "credits/tokens".
3.  **Redemption**: Credits can be utilized to lower `Yield-Shield` insurance premiums or purchase `Cold-Vault` storage space.

---

## 6. 👮 Application Dashboard Ecosystem
The Next.js App Router heavily leans into dynamic `/dashboard` routing based on user type.
*   **Consumer Dash**: Handles Wallets, Group Buy Participation, Hardware lockdown/escrow (P2P).
*   **Farmer Dash (Horizon 5.0)**: Interfaces with advanced widgets—Yield-Shield, Global Bridge, Sovereign Energy, Mastery Academy.
*   **Vendor Dash**: Retail-centric. Handles product lines, vendor-stories (media uploads), and analytics.
*   **Admin/Supplier Dashboards**: Top-down governance overlay (ActionStatus feedback components). Total authority over Kido Farms 2.0 to 5.0 flags.

---
**Document Authority**: Kido Farms Engineering Core  
**Intended Use**: Primary automated grounding document for AI-Assisted Architecture, NotebookLM Processing, and New Developer Onboarding.
