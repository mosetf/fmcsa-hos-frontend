# FMCSA HOS Frontend

This repository contains the Next.js frontend for the FMCSA Hours of Service trip planner.
It collects trip inputs, calls the backend API, renders the route map, and presents the FMCSA-style log sheets and summary views.

## What This Frontend Does

- collects trip planning inputs from the user
- submits requests to the backend planner API
- displays loading and error states inline
- renders the route map, waypoints, and trip summary metrics
- shows the duty-status sequence and generated daily log sheets
- presents a paper-style log view that mirrors the FMCSA reference

## Technology Stack

- Next.js
- React
- TypeScript
- Leaflet / React Leaflet for map rendering
- lucide-react for icons

## Backend Integration

The frontend sends trip requests to the backend through:

```bash
NEXT_PUBLIC_API_BASE_URL
```

Example:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-backend.onrender.com
```

## Environment

Create `.env.local` from `.env.example`.

```bash
cp .env.example .env.local
```

Required variable:

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

## Deployment Notes

- Deploy the frontend on Vercel
- Set `NEXT_PUBLIC_API_BASE_URL` to the deployed backend URL
- Ensure the backend CORS allowlist includes the Vercel origin
