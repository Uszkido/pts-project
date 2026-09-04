<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0D1117,35:1E293B,70:00F5FF,100:6E40C9&height=180&section=header&text=PTS%20%E2%80%94%20PHONE%20TRACKING%20SYSTEM&fontSize=34&fontColor=ffffff&animation=fadeIn&fontAlignY=36"/>

### 📱 DECENTRALIZED PHONE TRACKING & IMEI VERIFICATION PLATFORM ⚡

*Built by **[Usama Ado Shehu](https://github.com/Uszkido)** — **Vexel Innovations***

<p align="center">
  <a href="https://pts-vexel.vercel.app">
    <img src="https://img.shields.io/badge/Live%20Demo-pts--vexel.vercel.app-00C853?style=for-the-badge&logo=vercel"/>
  </a>
  <img src="https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white"/>
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white"/>
  <img src="https://img.shields.io/badge/Prisma-2D3748?style=for-the-badge&logo=prisma&logoColor=white"/>
</p>

</div>

---

# 📱 PTS — Phone Tracking System

> A decentralized national registry for verifiable device ownership, stolen phone tracking, and IMEI-bound digital certificates of ownership.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [User Roles](#user-roles)
- [Database Schema](#database-schema)
- [Key Workflows](#key-workflows)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Reference](#api-reference)
- [Security](#security)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

PTS gives every mobile device a verifiable digital identity. Vendors register devices at point of sale, ownership transfers are logged on an immutable chain of custody, and anyone — a buyer, a pawn shop, a police officer — can verify an IMEI in seconds to see if it's clean or stolen.

| Layer | Technology |
|---|---|
| **Backend API** | Node.js + Express |
| **Database** | PostgreSQL + Prisma ORM (Neon serverless) |
| **Mobile Agent** | React + TypeScript + Capacitor (Android/iOS) |
| **Auth** | JWT + bcrypt + OTP email verification |
| **Storage** | Cloudinary (images/documents) |
| **AI** | Groq SDK (AI command center) |

---

## Architecture

```
pts-project/
├── backend/                  # Express API server
│   ├── api/index.js          # Entry point & route loader
│   ├── src_backend/
│   │   ├── controllers/      # Business logic
│   │   ├── middleware/       # Auth, error handling
│   │   ├── routes/           # API route definitions
│   │   ├── services/         # Reusable service layer
│   │   └── utils/            # Logger, response helpers
│   └── prisma/
│       └── schema.prisma     # Database models
└── pts-sentinel-app/         # Mobile tracking agent
    └── src/
        ├── screens/          # Setup & Dashboard UI
        ├── components/       # Radar, BeaconFeed
        └── services/         # beaconService, notificationInterceptService
```

---

## User Roles

| Role | Capabilities |
|---|---|
| **CONSUMER** | View certificates for owned devices, flag device as stolen |
| **VENDOR** | Register devices at point of sale, issue certificates, initiate transfers |
| **POLICE** | Investigate flagged devices, review transaction histories, manage incident reports |
| **ADMIN** | Full system access, user management, analytics |
| **TELECOM** | Sync blacklisted IMEIs with network-level blocking |
| **INSURANCE** | Access risk scores and incident reports for insured devices |

---

## Database Schema

| Model | Purpose |
|---|---|
| **User** | All operators — `email`, `role`, `vendorTier`, facial/business verification data |
| **Device** | Core tracked asset — `imei` (unique 15-digit), `status` (CLEAN/STOLEN/LOST/INVESTIGATING), `riskScore` |
| **Certificate** | Proof of ownership — `qrHash` (unique, for physical scanning), `isActive` |
| **OwnershipTransfer** | Chain of custody — `sellerId`, `buyerId`, `escrowStatus` |
| **IncidentReport** | Theft/loss reports — type (LOST/STOLEN/SNATCHED/FRAUD), `policeReportNo`, `status` |
| **TransactionHistory** | Immutable audit log — SHA-256 sealed entries for every action |
| **DeveloperApiKey** | Third-party API access with quota and billing tracking |
| **ObservationReport** | Guardian Mesh sightings via BT/WiFi from sentinel agents |

---

## Key Workflows

### Public IMEI Verification
Anyone can look up a 15-digit IMEI. The system returns a **Public Trust Index** score. Devices marked `STOLEN` display a clear warning.

### Chain of Custody
1. A **Vendor** registers a new device (IMEI + photos + receipt).
2. Vendor initiates an ownership transfer to the buyer's email.
3. PTS issues a `Certificate` binding that buyer to the device IMEI.
4. Transfer is permanently logged in `TransactionHistory` with a SHA-256 seal.

### Stolen Device Reporting
1. Owner flags device via dashboard or USSD (`*123#`).
2. `IncidentReport` created; device status set to `STOLEN`.
3. Law enforcement notified; device added to telecom blacklist feed.
4. **PTS Sentinel** mobile agent continuously broadcasts GPS location to registry.

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- PostgreSQL database (or a [Neon](https://neon.tech) serverless instance)

### Backend

```bash
cd backend
npm install
cp .env.example .env        # Fill in your secrets
npx prisma generate
npx prisma migrate dev
npm run dev                 # Starts on port 5000
```

### Mobile App (pts-sentinel-app)

```bash
cd pts-sentinel-app
npm install
cp .env.example .env        # Set VITE_PTS_API_URL
npm run dev                 # Web preview
# For Android:
npm run build
npx cap sync android
npx cap open android
```

The API will be available at `http://localhost:5000`.

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in all values.

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | Neon/PostgreSQL connection string | ✅ |
| `DIRECT_URL` | Direct DB URL (for Prisma migrations) | ✅ |
| `JWT_SECRET` | Long random string for signing tokens | ✅ |
| `EMAIL_USER` | SMTP email for OTP delivery | ✅ |
| `EMAIL_PASS` | SMTP app password | ✅ |
| `CLOUDINARY_*` | Cloud storage for images/documents | Recommended |
| `GROQ_API_KEY` | AI Command Center features | Optional |
| `PAYSTACK_SECRET_KEY` | NGN payment processing | Optional |
| `TELEGRAM_BOT_TOKEN` | Telegram alert bot | Optional |
| `WHATSAPP_*` | WhatsApp Business API alerts | Optional |

For the mobile app, create `pts-sentinel-app/.env`:

```
VITE_PTS_API_URL=https://your-backend-url.com/api/v1
```

---

## API Reference

Base URL: `/api/v1`

### Auth
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register/start` | Start registration, sends OTP |
| POST | `/auth/register/verify` | Verify OTP, create account |
| POST | `/auth/login` | Login, returns JWT |
| POST | `/auth/reset-password` | Request password reset OTP |
| POST | `/auth/verify-reset-otp` | Confirm OTP, apply new password |

### Devices
| Method | Endpoint | Description |
|---|---|---|
| POST | `/devices` | Register a new device (Vendor) |
| GET | `/devices/:imei` | Get device details |
| PATCH | `/devices/:imei/status` | Update device status |

### Public
| Method | Endpoint | Description |
|---|---|---|
| GET | `/public/verify/:imei` | Public IMEI trust check |

### Guardian (Mobile Agent)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/guardian/beacon` | Submit GPS location beacon |

Full API documentation available via `/health` endpoint which lists all loaded routes.

---

## Security

- Passwords hashed with **bcrypt** (10 rounds).
- All protected routes require a valid **JWT** (`Authorization: Bearer <token>`).
- Role-based access control via the `authorize(...roles)` middleware.
- OTP-verified registration and password reset flow.
- Devices cannot be deleted — all changes flow through auditable Transfer or Reporting workflows.
- `TransactionHistory` entries are SHA-256 sealed after creation (`isSealed: true`).
- Rate limiting recommended for production (add `express-rate-limit` to auth routes).

> ⚠️ **Before deploying to production**, see the [Security Hardening](#security-hardening) section below.

### Security Hardening Checklist

- [ ] Set a strong, unique `JWT_SECRET` (min 32 chars, generated randomly)
- [ ] Remove the admin credential auto-creation from the `/health` endpoint
- [ ] Add `helmet` middleware: `npm install helmet` → `app.use(helmet())`
- [ ] Add rate limiting to `/api/v1/auth/*` routes
- [ ] Restrict CORS to your actual frontend origin(s)
- [ ] Set `NODE_ENV=production` in your hosting environment
- [ ] Enable HTTPS (handled by Vercel/Render/Railway automatically)
- [ ] Run `npm audit` and resolve any high/critical findings

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the full plan, including:

- **Device DNA Registry** — hardware serial binding for forensic identity
- **Guardian Mesh Network** — crowd-sourced BT/WiFi sighting reports
- **Anti-Theft Kill-Switch API** — remote brick/recovery via telecom integration
- **Blockchain Chain of Custody** — immutable on-chain ownership proofs
- **Escrow Payments** — Paystack-backed escrow for second-hand device purchases

---

## Contributing

Contributions are welcome! Please read [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) before opening a PR.

## Security Policy

Found a vulnerability? See [`SECURITY.md`](SECURITY.md) for responsible disclosure steps.

## License

[MIT License](LICENSE) — © Usama Ado Shehu / Vexel Innovations

---

<p align="center">Made with ❤️ in Nigeria by <a href="https://github.com/Uszkido">Usama Ado Shehu</a> — Vexel Innovations</p>
