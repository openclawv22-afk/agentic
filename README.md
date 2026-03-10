# RentMove Design Services

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create database and apply schema:
   ```bash
   psql "$DATABASE_URL" -f db/schema.sql
   ```
3. Configure environment:
   ```bash
   cp .env.example .env
   ```
4. Start server:
   ```bash
   npm start
   ```
5. Open frontend:
   - `http://localhost:3000/index.html`

## Windows one-shot quickstart (PowerShell)
Your screenshot shows PowerShell was run outside the repo folder, so `./scripts/windows-quickstart.ps1` could not be found.

### Option A (recommended): run from the repo folder
```powershell
cd C:\path\to\agentic
powershell -ExecutionPolicy Bypass -NoProfile -File .\scripts\windows-quickstart.ps1
```

### Option B (easiest): run the root launcher
```powershell
cd C:\path\to\agentic
.\windows-quickstart.cmd
```

What it does:
- checks `node`, `npm`, and `psql`
- creates `.env` from `.env.example` if missing
- prompts for `DATABASE_URL` and `JWT_SECRET` when placeholders are detected
- runs `npm install`
- applies `db/schema.sql`
- opens `http://localhost:3000/index.html` and starts the app server

## Implemented API
- `POST /api/inquiries`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `GET /api/auth/google/start` (placeholder until OAuth is configured)
- `GET /api/me`
- `GET /api/bookings`
- `GET /api/properties`
- `GET /api/transactions`
