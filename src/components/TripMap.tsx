import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => L.latLng(p[0], p[1])));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [points, map]);
  return null;
}

export function TripMap({
  origin,
  destination,
  path,
  mode = "train",
  height = 280,
}: {
  origin?: LatLng | null;
  destination?: LatLng | null;
  path?: LatLng[] | null;
  mode?: "train" | "ferry";
  height?: number;
}) {
  const stops = [origin, destination].filter(Boolean) as LatLng[];
  const routeLine = (path && path.length >= 2 ? path : null);
  const fitPoints: LatLng[] = routeLine ?? stops;
  const center: LatLng = fitPoints[0] ?? [40, 0];
  const color = mode === "ferry" ? "oklch(0.72 0.15 230)" : "oklch(0.78 0.16 155)";
  const isStraight = !routeLine && stops.length === 2;

  return (
    <div className="overflow-hidden rounded-2xl border border-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
          subdomains="abcd"
        />
        {routeLine && (
          <Polyline
            positions={routeLine}
            pathOptions={{ color, weight: 4, opacity: 0.95, dashArray: mode === "ferry" ? "8 6" : undefined }}
          />
        )}
        {isStraight && (
          <Polyline
            positions={stops}
            pathOptions={{ color, weight: 3, opacity: 0.5, dashArray: "4 6" }}
          />
        )}
        {stops.map((p, i) => (
          <CircleMarker
            key={i}
            center={p}
            radius={7}
            pathOptions={{ color, fillColor: color, fillOpacity: 1, weight: 2 }}
          />
        ))}
        <FitBounds points={fitPoints} />
      </MapContainer>
    </div>
  );
}
