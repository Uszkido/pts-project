# How to Run PTS Locally

Follow these steps to run the Phone Tracking System (PTS) on your local machine.

## Prerequisites
- **Node.js**: (v18 or higher recommended)
- **Git**: (Optional, if you want to clone the repository)

## 1. Backend Setup
1. Open a terminal (PowerShell or Command Prompt).
2. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   *Note: If you encounter policy errors on Windows, use `npm.cmd install`.*
4. Generate the Prisma client:
   ```bash
   npx prisma generate
   ```
   *Note: Use `npx.cmd prisma generate` if needed.*
5. Start the development server:
   ```bash
   npm run dev
   ```
   The backend will be running on [http://localhost:5000](http://localhost:5000).

## 2. Frontend Setup
1. Open a **new** terminal window.
2. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
   *Note: Use `npm.cmd install` if needed.*
4. Start the development server:
   ```bash
   npm run dev
   ```
   The frontend will be running on [http://localhost:3000](http://localhost:3000).

## 3. Verify Operation
- Visit [http://localhost:3000](http://localhost:3000) in your browser.
- You should see "Verify Device Integrity" and a green badge saying "Live Database Connected".
- Check the backend health at [http://localhost:5000/health](http://localhost:5000/health).

## Troubleshooting
- If the database connection fails, ensure you have an active internet connection as it connects to a remote Neon PostgreSQL database.
- If you see `Execution_Policies` errors on Windows, always prepend `.cmd` to `npm` or `npx` (e.g., `npm.cmd run dev`).
