export type PlanTripRequest = {
  current_location: string;
  pickup_location: string;
  dropoff_location: string;
  cycle_used_hours: number;
  departure_datetime: string;
};

export type RouteWaypoint = {
  lat: number;
  lng: number;
  label: string;
  type: string;
};

export type TripSegment = {
  type: string;
  label: string;
  start: string;
  end: string;
  distance_miles: number;
  location: string | null;
};

export type LogSheet = {
  date: string;
  grid: Array<{
    status: string;
    segments: Array<{
      start_hour: number;
      end_hour: number;
      label: string;
      distance_miles: number;
      location: string | null;
    }>;
  }>;
  totals: Record<string, number>;
  total_miles: number;
  total_check: number;
  remarks: Array<{
    time: string;
    status: string;
    label: string;
    location: string | null;
  }>;
};

export type PlanTripResponse = {
  route: {
    legs: Array<{
      from: string;
      to: string;
      distance_miles: number;
      duration_hours: number;
    }>;
    total_distance_miles: number;
    total_duration_hours: number;
    waypoints: RouteWaypoint[];
    polyline_encoded: string;
    polyline_point_count?: number;
    full_polyline?: number[][];
  };
  trip_segments: TripSegment[];
  log_sheets: LogSheet[];
};

/** Return the normalized API base URL used by the frontend planner calls. */
export function getApiBaseUrl(): string {
  const fallback = "http://127.0.0.1:8000";
  return (process.env.NEXT_PUBLIC_API_BASE_URL || fallback).replace(/\/$/, "");
}

/** Build the versioned plan-trip URL for the requested response detail level. */
export function buildPlanTripUrl(detail: "compact" | "full"): string {
  const url = new URL("/api/v1/plan-trip/", getApiBaseUrl());
  url.searchParams.set("detail", detail);
  return url.toString();
}
