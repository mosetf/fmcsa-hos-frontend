# FMCSA HOS Frontend

Next.js frontend for trip input, backend submission, route preview, and FMCSA log presentation.

## Current Scope

Phase 5 is implemented here:
- versioned backend API submission
- inline backend error handling
- visible loading state
- compact response preview for route, segments, and log sheets

Phases 6 and 7 will add:
- decoded route map rendering
- FMCSA daily log sheet visualization

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

The form submits to:

```text
POST /api/v1/plan-trip/?detail=compact
```
