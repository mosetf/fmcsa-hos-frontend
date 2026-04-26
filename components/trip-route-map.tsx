"use client";

import { useEffect, useMemo } from "react";

import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngTuple } from "leaflet";

import type { RouteWaypoint, TripSegment } from "@/lib/api";
import { decodePolyline } from "@/lib/polyline";

type TripRouteMapProps = {
  polylineEncoded: string;
  waypoints: RouteWaypoint[];
  tripSegments: TripSegment[];
};

type StopMarker = {
  lat: number;
  lng: number;
  label: string;
  type: "fuel" | "rest";
};

/** Render the planned trip route and key stops on a client-only Leaflet map. */
export function TripRouteMap({ polylineEncoded, waypoints, tripSegments }: TripRouteMapProps) {
  const polyline = useMemo(() => decodePolyline(polylineEncoded), [polylineEncoded]);
  const stopMarkers = useMemo(() => buildStopMarkers(polyline, tripSegments), [polyline, tripSegments]);

  if (polyline.length === 0) {
    return (
      <div className="flex min-h-[20rem] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
        Route geometry is unavailable for this trip.
      </div>
    );
  }

  const center = polyline[0];

  return (
    <div className="overflow-hidden border-y border-slate-200 bg-white">
      <MapContainer
        center={center}
        zoom={6}
        scrollWheelZoom={false}
        className="h-[24rem] w-full md:h-[28rem]"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={polyline as LatLngExpression[]} pathOptions={{ color: "#047857", weight: 5, opacity: 0.9 }} />
        {stopMarkers.map((marker, index) => (
          <CircleMarker
            key={`${marker.type}-${marker.label}-${index}`}
            center={[marker.lat, marker.lng] as LatLngTuple}
            radius={marker.type === "fuel" ? 7 : 6}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: markerColorByType[marker.type],
              fillOpacity: 0.96,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              {marker.label}
            </Tooltip>
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{marker.label}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">
                  {marker.type === "fuel" ? "Fuel stop" : "Rest break"}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {waypoints.map((waypoint) => (
          <CircleMarker
            key={`${waypoint.type}-${waypoint.label}`}
            center={[waypoint.lat, waypoint.lng] as LatLngTuple}
            radius={8}
            pathOptions={{
              color: "#111111",
              weight: 2,
              fillColor: markerColorByType[waypoint.type] || "#2563eb",
              fillOpacity: 0.95,
            }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              {waypoint.label}
            </Tooltip>
            <Popup>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{waypoint.label}</p>
                <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{waypoint.type}</p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        <FitBounds polyline={polyline} waypoints={waypoints} stopMarkers={stopMarkers} />
      </MapContainer>
    </div>
  );
}

function buildStopMarkers(polyline: [number, number][], tripSegments: TripSegment[]): StopMarker[] {
  const routeMiles = tripSegments
    .filter((segment) => segment.type === "DRIVING")
    .reduce((sum, segment) => sum + segment.distance_miles, 0);

  if (polyline.length < 2 || routeMiles <= 0) return [];

  let drivenMiles = 0;
  const markers: StopMarker[] = [];

  for (const segment of tripSegments) {
    if (segment.type === "DRIVING") {
      drivenMiles += segment.distance_miles;
      continue;
    }

    const type = stopMarkerType(segment.label);
    if (!type) continue;

    const point = pointAtRatio(polyline, drivenMiles / routeMiles);
    markers.push({
      lat: point[0],
      lng: point[1],
      label: segment.label,
      type,
    });
  }

  return markers;
}

function stopMarkerType(label: string): StopMarker["type"] | null {
  const normalized = label.toLowerCase();
  if (normalized.includes("fuel")) return "fuel";
  if (normalized.includes("break") || normalized.includes("reset")) return "rest";
  return null;
}

function pointAtRatio(polyline: [number, number][], ratio: number): [number, number] {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const targetIndex = Math.round(clampedRatio * (polyline.length - 1));
  return polyline[targetIndex] || polyline[0];
}

/** Keep the route and all markers inside the initial map frame. */
function FitBounds({
  polyline,
  waypoints,
  stopMarkers,
}: {
  polyline: [number, number][];
  waypoints: RouteWaypoint[];
  stopMarkers: StopMarker[];
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = [
      ...polyline,
      ...waypoints.map((waypoint) => [waypoint.lat, waypoint.lng] as [number, number]),
      ...stopMarkers.map((marker) => [marker.lat, marker.lng] as [number, number]),
    ];

    if (bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [28, 28],
      });
    }
  }, [map, polyline, waypoints, stopMarkers]);

  return null;
}

const markerColorByType: Record<string, string> = {
  current: "#d97706",
  pickup: "#047857",
  dropoff: "#dc2626",
  fuel: "#ea580c",
  rest: "#2563eb",
};
