import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ExternalLink,
  Copy,
  Check,
  X,
  Navigation,
  Layers,
  Search,
  Loader2
} from 'lucide-react';

interface OpenStreetMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  location: string;
  lat?: number;
  lng?: number;
}

export const OpenStreetMapModal: React.FC<OpenStreetMapModalProps> = ({
  isOpen,
  onClose,
  title,
  location,
  lat,
  lng
}) => {
  const [currentLat, setCurrentLat] = useState<number | undefined>(lat);
  const [currentLng, setCurrentLng] = useState<number | undefined>(lng);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(16);

  useEffect(() => {
    if (!isOpen) return;

    setCurrentLat(lat);
    setCurrentLng(lng);

    // If coordinates are missing but location string exists, geocode using OSM Nominatim
    if ((lat === undefined || lng === undefined) && location.trim()) {
      setIsLoading(true);
      const query = encodeURIComponent(location);
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
        headers: {
          'Accept-Language': 'de',
          'User-Agent': 'VereinsManagerLokal/1.0'
        }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && data.length > 0) {
            setCurrentLat(parseFloat(data[0].lat));
            setCurrentLng(parseFloat(data[0].lon));
          }
        })
        .catch((err) => {
          console.warn('OSM Nominatim Geocoding error:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, location, lat, lng]);

  if (!isOpen) return null;

  const hasCoords = currentLat !== undefined && currentLng !== undefined;

  // Calculate bounding box for OpenStreetMap embed iframe
  const delta = 0.005;
  const bbox = hasCoords
    ? `${currentLng! - delta},${currentLat! - delta},${currentLng! + delta},${currentLat! + delta}`
    : '13.3999,52.5150,13.4099,52.5250';

  const osmEmbedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${currentLat}%2C${currentLng}`
    : `https://www.openstreetmap.org/export/embed.html?layer=mapnik`;

  const osmWebUrl = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${currentLat}&mlon=${currentLng}#map=${zoomLevel}/${currentLat}/${currentLng}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(location)}`;

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${currentLat},${currentLng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;

  const appleMapsUrl = hasCoords
    ? `https://maps.apple.com/?ll=${currentLat},${currentLng}&q=${encodeURIComponent(title || location)}`
    : `https://maps.apple.com/?q=${encodeURIComponent(location)}`;

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(location);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        id="osm-modal-container"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span>Veranstaltungsort & Anfahrt</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  OpenStreetMap
                </span>
              </h3>
              <p className="text-xs text-slate-500 line-clamp-1">{title || 'Terminort'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Location Info Banner */}
        <div className="px-6 py-3 bg-emerald-50/70 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-emerald-900 font-medium">
            <Navigation className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{location || 'Keine genaue Adresse angegeben'}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyAddress}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-200 text-xs font-semibold text-emerald-800 hover:bg-emerald-100/50 shadow-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Kopiert!' : 'Adresse kopieren'}</span>
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="relative flex-1 min-h-[380px] bg-slate-100">
          {isLoading && (
            <div className="absolute inset-0 z-10 bg-white/70 backdrop-blur-xs flex flex-col items-center justify-center text-slate-600">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mb-2" />
              <p className="text-sm font-medium">Ort wird über OpenStreetMap geokodiert...</p>
            </div>
          )}

          <iframe
            title="OpenStreetMap Standortkarte"
            className="w-full h-full min-h-[380px] border-0"
            src={osmEmbedUrl}
            loading="lazy"
          />

          {/* Floating Controls Overlay */}
          <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-xs rounded-xl shadow-md border border-slate-200 p-2 flex items-center gap-2 text-xs text-slate-700">
            <Layers className="w-3.5 h-3.5 text-emerald-600" />
            <span>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline hover:text-emerald-700">OpenStreetMap</a>-Mitwirkende</span>
            {hasCoords && (
              <span className="text-slate-400 font-mono text-[11px]">
                ({currentLat?.toFixed(4)}, {currentLng?.toFixed(4)})
              </span>
            )}
          </div>
        </div>

        {/* Modal Footer / Navigation Links */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Interaktive OpenStreetMap-Karte mit freier Lizenz und Open-Source-Geodaten.
          </div>
          <div className="flex items-center gap-2">
            <a
              href={osmWebUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-xs transition-colors"
            >
              <span>Auf OpenStreetMap.org</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              <span>Google Maps</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <a
              href={appleMapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              <span>Apple Karten</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300 transition-colors"
            >
              Schließen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
