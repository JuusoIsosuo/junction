import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
    if (map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      center: [25.7482, 62.2415], // Finland
      zoom: 5,
    });

    map.current.addControl(new mapboxgl.NavigationControl());
  }, []);

  return (
    <div
      ref={mapContainer}
      style={{
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}

export default App;