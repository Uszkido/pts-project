# PTS Deployment Guide

This document outlines the steps to deploy the Phone Tracking System (PTS) to Vercel.

## 1. Vercel Authentication Fix
If you encounter a **"Method Not Allowed"** error when trying to log in via `vercel.com/oauth/device`, follow these steps:

1.  Open your browser and navigate to: **[https://vercel.com/device](https://vercel.com/device)**
2.  Enter the code displayed in your terminal (e.g., `MPZD-FDJK`).
3.  Click **Authorize**.
4.  Your terminal will automatically complete the login.

---

## 2. Deploying the Backend
The backend is a Node.js Express server configured for Vercel.

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Deploy to Vercel:
    ```bash
    vercel
    ```
3.  **Environment Variables**: Ensure you set the following in the Vercel Dashboard:
    - `DATABASE_URL`: Your Neon PostgreSQL connection string.
    - `JWT_SECRET`: A secure string for token signing.
    - `TELEGRAM_BOT_TOKEN`: Your bot token from BotFather.
    - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: For image uploads.
    - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: For email notifications.

---

## 3. Deploying the Frontend
The frontend is a Next.js application.

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Deploy to Vercel:
    ```bash
    vercel
    ```
3.  **Environment Variables**: Ensure you set:
    - `NEXT_PUBLIC_API_URL`: The URL of your deployed backend (e.g., `https://pts-backend.vercel.app`).

---

## 4. Troubleshooting
- **Prisma Issues**: The `postinstall` script in `backend/package.json` handles Prisma client generation. If you see schema errors, run `npx prisma generate` locally before deploying.
- **Build Errors**: Ensure all environment variables are correctly mapped in the Vercel Dashboard under **Settings > Environment Variables**.
