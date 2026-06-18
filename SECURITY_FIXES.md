# PTS Security Fixes — Action Plan

This document lists every security issue found in the codebase and exactly how to fix each one.

---

## 🔴 CRITICAL — Fix Before Going to Production

### 1. Hardcoded admin credentials in `/health` endpoint

**File:** `backend/api/index.js`

**Problem:** The `/health` endpoint (publicly accessible, no auth required) creates/resets admin accounts with hardcoded credentials (`admin@pts.ng` / `admin_pts_2026`) on every health check request. Any attacker who calls `/health` can infer your admin email and knows the default password was the one used at creation.

**Fix:** Remove the admin credential block entirely from `/health`. Use the provided `backend-api-index.js` replacement file. For initial admin setup, use a one-time CLI script:

```bash
# Run once to create your admin account securely
node backend/scripts/utils/create_admin.mjs
```

---

### 2. Fallback JWT secret in source code

**File:** `backend/src_backend/middleware/auth.js` and `backend/src_backend/controllers/authController.js`

**Problem:**
```js
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';
```
If `JWT_SECRET` is ever missing from the environment, the server silently falls back to a public fallback string. Any attacker who reads your source code (or guesses the fallback) can forge valid tokens.

**Fix:** Use the provided `backend-auth-middleware.js` which exits the process if `JWT_SECRET` is missing, and enforces minimum length in production. Also fix `authController.js`:

```js
// Replace this:
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_pts_dev_key';

// With this:
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');
```

---

### 3. Open CORS (accepts any origin)

**File:** `backend/api/index.js`

**Problem:**
```js
app.use(cors()); // Accepts requests from any domain
```

**Fix:** (Already applied in `backend-api-index.js`) Add an `ALLOWED_ORIGINS` environment variable and restrict in production:
```env
ALLOWED_ORIGINS=https://pts-vexel.vercel.app,https://pts-frontend-ten.vercel.app
```

---

## 🟠 HIGH — Fix Soon

### 4. No rate limiting on auth endpoints

**Problem:** `/api/v1/auth/login` and `/api/v1/auth/register/start` have no rate limiting, making them vulnerable to brute-force and OTP enumeration attacks.

**Fix:**
```bash
npm install express-rate-limit
```

Add to `backend/src_backend/routes/auth.js`:
```js
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', authLimiter, authController.login);
router.post('/register/start', authLimiter, authController.registerStart);
router.post('/reset-password', authLimiter, authController.resetPassword);
```

---

### 5. Missing security headers

**Problem:** No HTTP security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.).

**Fix:**
```bash
npm install helmet
```

Add near the top of `backend/api/index.js`, before routes:
```js
const helmet = require('helmet');
app.use(helmet());
```

---

### 6. Oversized payload limit

**Problem:** `express.json({ limit: '50mb' })` allows huge payloads, a potential DoS vector.

**Fix:** Already reduced to `10mb` in `backend-api-index.js`. For most routes, `1mb` is sufficient — only the upload route needs more, and that should be handled by multer directly.

---

## 🟡 MEDIUM — Good Practice

### 7. IMEI validation — Luhn check missing

**File:** `pts-sentinel-app/src/screens/SetupScreen.tsx`

**Problem:** Only checks length (`< 14`). A user can enter any 15-digit number and proceed. IMEI numbers have a checksum (Luhn algorithm).

**Fix:** Use the provided `SetupScreen.tsx` which includes a full Luhn check. Also use `type="tel"` instead of `type="number"` for the IMEI input (number inputs strip leading zeros and behave poorly on mobile).

---

### 8. Auth token stored in localStorage

**File:** `pts-sentinel-app/src/services/beaconService.ts`

**Problem:** JWTs stored in `localStorage` are accessible to any JavaScript on the page (XSS risk).

**Fix for mobile (Capacitor):** Use `@capacitor/preferences` instead:
```ts
import { Preferences } from '@capacitor/preferences';

// Store:
await Preferences.set({ key: 'pts_sentinel_token', value: token });

// Retrieve:
const { value: token } = await Preferences.get({ key: 'pts_sentinel_token' });
```

For the web version, this is acceptable given the Capacitor sandbox, but document it.

---

### 9. No input validation on backend routes

**Problem:** Controllers do not validate incoming request bodies. A missing `imei` field or unexpected type could cause unhandled errors.

**Fix:** Add `express-validator` to key routes:
```bash
npm install express-validator
```

Example for device registration:
```js
const { body, validationResult } = require('express-validator');

router.post('/', [
    body('imei').isLength({ min: 15, max: 15 }).isNumeric(),
    body('brand').isString().notEmpty(),
    body('model').isString().notEmpty(),
], (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
}, deviceController.registerDevice);
```

---

## 🟢 LOW / BEST PRACTICE

### 10. JWT expiry is 24 hours

**File:** `backend/src_backend/controllers/authController.js`

Consider shortening to `8h` for higher-security roles (ADMIN, POLICE), or implementing refresh tokens.

### 11. Add `npm audit` to CI

**File:** `.github/workflows/sentinel-ci.yml`

Add this step:
```yaml
- name: Audit dependencies
  run: npm audit --audit-level=high
  working-directory: backend
```

### 12. Log sensitive data

**Problem:** `logger.info(`User logged in: ${user.email}`)` is fine, but ensure logs never include passwords, tokens, or full request bodies.

---

## Files to Replace

| Original File | Replacement File | What Changed |
|---|---|---|
| `backend/api/index.js` | `backend-api-index.js` | Removed hardcoded admin creds, tightened CORS, reduced payload limit |
| `backend/src_backend/middleware/auth.js` | `backend-auth-middleware.js` | No JWT_SECRET fallback, token expiry message, cleaner code |
| `pts-sentinel-app/src/screens/SetupScreen.tsx` | `SetupScreen.tsx` | Luhn IMEI check, correct input type, accessibility attrs |
| `pts-sentinel-app/src/services/beaconService.ts` | `beaconService.ts` | TypeScript types, cleaner intervals, null checks |
| _(missing)_ | `pts-sentinel-app.env.example` | Add to `pts-sentinel-app/` root |
