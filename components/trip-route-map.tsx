"use client";

import { useEffect, useMemo } from "react";

import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLngExpression, LatLngTuple } from "leaflet";

import type { RouteWaypoint } from "@/lib/api";
import { decodePolyline } from "@/lib/polyline";

type TripRouteMapProps = {
  polylineEncoded: string;
  waypoints: RouteWaypoint[];
};

/** Render the planned trip route and key stops on a client-only Leaflet map. */
export function TripRouteMap({ polylineEncoded, waypoints }: TripRouteMapProps) {
  const polyline = useMemo(() => decodePolyline(polylineEncoded), [polylineEncoded]);

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
        <FitBounds polyline={polyline} waypoints={waypoints} />
      </MapContainer>
    </div>
  );
}

/** Keep the route and all markers inside the initial map frame. */
function FitBounds({
  polyline,
  waypoints,
}: {
  polyline: [number, number][];
  waypoints: RouteWaypoint[];
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = [
      ...polyline,
      ...waypoints.map((waypoint) => [waypoint.lat, waypoint.lng] as [number, number]),
    ];

    if (bounds.length > 0) {
      map.fitBounds(bounds, {
        padding: [28, 28],
      });
    }
  }, [map, polyline, waypoints]);

  return null;
}

const markerColorByType: Record<string, string> = {
  current: "#d97706",
  pickup: "#047857",
  dropoff: "#dc2626",
  fuel: "#ea580c",
  rest: "#2563eb",
};
