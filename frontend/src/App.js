import { useState, useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { MapPin, Navigation, StopCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix Leaflet default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Component to recenter map when location changes
function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom());
    }
  }, [position, map]);
  return null;
}

const Home = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationHistory, setLocationHistory] = useState([]);
  const intervalRef = useRef(null);
  const watchIdRef = useRef(null);

  // Fetch location history
  const fetchLocationHistory = async () => {
    try {
      const response = await axios.get(`${API}/locations`);
      setLocationHistory(response.data);
    } catch (error) {
      console.error("Failed to fetch location history:", error);
    }
  };

  // Send location to backend
  const shareLocation = async (latitude, longitude, accuracy) => {
    try {
      await axios.post(`${API}/location/share`, {
        latitude,
        longitude,
        accuracy,
      });
      toast.success("Location shared to Telegram!");
      await fetchLocationHistory();
    } catch (error) {
      console.error("Failed to share location:", error);
      toast.error("Failed to share location");
    }
  };

  // Start tracking location
  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setIsTracking(true);
    toast.success("Location tracking started");

    // Watch position continuously
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCurrentLocation({ latitude, longitude, accuracy });
      },
      (error) => {
        console.error("Error getting location:", error);
        toast.error("Failed to get location");
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );

    // Send location every 5 seconds
    intervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          shareLocation(latitude, longitude, accuracy);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        }
      );
    }, 5000);
  };

  // Stop tracking location
  const stopTracking = () => {
    setIsTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    toast.info("Location tracking stopped");
  };

  // Clear location history
  const clearHistory = async () => {
    try {
      await axios.delete(`${API}/locations`);
      setLocationHistory([]);
      toast.success("Location history cleared");
    } catch (error) {
      console.error("Failed to clear history:", error);
      toast.error("Failed to clear history");
    }
  };

  useEffect(() => {
    fetchLocationHistory();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  const defaultPosition = [28.6139, 77.209]; // Delhi, India as default
  const mapPosition = currentLocation
    ? [currentLocation.latitude, currentLocation.longitude]
    : defaultPosition;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-teal-50 to-cyan-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-3">
            Live Location Share
          </h1>
          <p className="text-lg text-gray-600">
            Share your location to Telegram every 5 seconds
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map Section */}
          <div className="lg:col-span-2">
            <Card data-testid="map-card" className="overflow-hidden shadow-lg">
              <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-500">
                <CardTitle className="text-white flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Live Map
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[400px] sm:h-[500px] w-full">
                  <MapContainer
                    center={mapPosition}
                    zoom={13}
                    style={{ height: "100%", width: "100%" }}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {currentLocation && (
                      <Marker position={mapPosition}>
                        <Popup>
                          Current Location<br />
                          Lat: {currentLocation.latitude.toFixed(6)}<br />
                          Lng: {currentLocation.longitude.toFixed(6)}
                        </Popup>
                      </Marker>
                    )}
                    <RecenterMap position={currentLocation ? mapPosition : null} />
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {/* Current Location Info */}
            {currentLocation && (
              <Card data-testid="location-info-card" className="mt-6 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-teal-700">
                    <Navigation className="w-5 h-5" />
                    Current Location
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Latitude</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currentLocation.latitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Longitude</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currentLocation.longitude.toFixed(6)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Accuracy</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {currentLocation.accuracy ? `${currentLocation.accuracy.toFixed(0)}m` : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Controls & History Section */}
          <div className="space-y-6">
            {/* Controls */}
            <Card data-testid="controls-card" className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Controls</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!isTracking ? (
                  <Button
                    data-testid="start-tracking-btn"
                    onClick={startTracking}
                    className="w-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white font-semibold py-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <Navigation className="w-5 h-5 mr-2" />
                    Start Tracking
                  </Button>
                ) : (
                  <Button
                    data-testid="stop-tracking-btn"
                    onClick={stopTracking}
                    className="w-full bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-semibold py-6 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg"
                  >
                    <StopCircle className="w-5 h-5 mr-2" />
                    Stop Tracking
                  </Button>
                )}
                <Button
                  data-testid="clear-history-btn"
                  onClick={clearHistory}
                  variant="outline"
                  className="w-full py-6 rounded-xl border-2 border-gray-300 hover:border-red-400 hover:bg-red-50 transition-all duration-200"
                >
                  <Trash2 className="w-5 h-5 mr-2" />
                  Clear History
                </Button>
              </CardContent>
            </Card>

            {/* Status */}
            <Card data-testid="status-card" className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      isTracking ? "bg-green-500 animate-pulse" : "bg-gray-300"
                    }`}
                  />
                  <span className="font-medium text-gray-900">
                    {isTracking ? "Tracking Active" : "Tracking Inactive"}
                  </span>
                </div>
                {isTracking && (
                  <p className="text-sm text-gray-600 mt-2">
                    Sharing location every 5 seconds
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Location History */}
            <Card data-testid="history-card" className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-gray-900">Recent Locations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {locationHistory.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No locations shared yet
                    </p>
                  ) : (
                    locationHistory.slice(0, 10).map((loc, index) => (
                      <div
                        key={loc.id}
                        data-testid={`history-item-${index}`}
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-teal-600">
                            #{locationHistory.length - index}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(loc.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-gray-700 mt-1">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;