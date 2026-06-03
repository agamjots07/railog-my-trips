import { useEffect } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import { MODE_COLOR, type TripMode } from "@/lib/modes";

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
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
  mode?: TripMode;
  height?: number;
}) {
  const stops = [origin, destination].filter(Boolean) as LatLng[];
  const routeLine = path && path.length >= 2 ? path : null;
  const fitPoints: LatLng[] = routeLine ?? stops;
  const center: LatLng = fitPoints[0] ?? [40, 0];
  const color = MODE_COLOR[mode] ?? MODE_COLOR.train;
  const isStraight = !routeLine && stops.length === 2;
  const dashed = mode === "ferry" || mode === "jetski";

  return (
    <div className="overflow-hidden rounded-2xl border border-border" style={{ height }}>
      <MapContainer
        center={center}
        zoom={4}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Esri World Imagery — satellite basemap, no API key */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics"
          maxZoom={19}
        />
        {/* Labels overlay for context */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          opacity={0.85}
        />
        {routeLine && (
          <Polyline
            positions={routeLine}
            pathOptions={{
              color,
              weight: 4,
              opacity: 0.95,
              dashArray: dashed ? "8 6" : undefined,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        )}
        {isStraight && (
          <Polyline
            positions={stops}
            pathOptions={{ color, weight: 3, opacity: 0.55, dashArray: "4 6" }}
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
