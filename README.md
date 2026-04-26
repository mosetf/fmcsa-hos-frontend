# FMCSA HOS Frontend

Next.js frontend for trip input, backend submission, route review, and FMCSA log presentation.

## Current Scope

The app currently provides:
- trip request form for current location, pickup, dropoff, cycle hours used, and departure time
- inline backend error handling and visible loading state
- decoded route map rendering from the compact planner response
- operational summary cards, duty-status sequence review, and daily log snapshot

## Environment

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Expected variable:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```
