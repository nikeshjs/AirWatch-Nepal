import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Layers, Info, Satellite, Activity, Crosshair } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getAllCitiesSummary } from '../services/api';

/* ── Constants ── */
const STATUS_COLORS = {
    Good: { text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', dot: '#22c55e' },
    Moderate: { text: '#ca8a04', bg: '#fefce8', border: '#fde68a', dot: '#eab308' },
    Unhealthy: { text: '#dc2626', bg: '#fff1f2', border: '#fecdd3', dot: '#ef4444' },
    'Very Unhealthy': { text: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', dot: '#7c3aed' },
    Hazardous: { text: '#7f1d1d', bg: '#fef2f2', border: '#fca5a5', dot: '#b91c1c' },
};

const NEPAL_CENTER = [28.3949, 84.1240];

const TILE_URLS = {
    Standard: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    Satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    Terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    Voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

const LABEL_URL = 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png';

function statusColor(status) {
    return STATUS_COLORS[status] || STATUS_COLORS.Moderate;
}

/* ── Main Component ── */
export default function MapViewPage() {
    const mapRef = useRef(null);       // leaflet map instance
    const mapElRef = useRef(null);     // DOM element
    const tileRef = useRef(null);      // current base tile layer
    const labelRef = useRef(null);     // label overlay layer
    const markersRef = useRef([]);     // array of L.marker
    const [cities, setCities] = useState([]);
    const [selected, setSelected] = useState(null);
    const [activeLayer, setActiveLayer] = useState('Satellite');
    const [loading, setLoading] = useState(true);

    /* ── Initialise Leaflet map (once) ── */
    useEffect(() => {
        if (mapRef.current) return; // already created

        const map = L.map(mapElRef.current, {
            center: NEPAL_CENTER,
            zoom: 7,
            zoomControl: false,
        });

        L.control.zoom({ position: 'bottomleft' }).addTo(map);

        // Base tile
        const tile = L.tileLayer(TILE_URLS.Satellite, {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);

        // Labels overlay for satellite
        const labels = L.tileLayer(LABEL_URL, { pane: 'shadowPane', opacity: 0.8 }).addTo(map);

        tileRef.current = tile;
        labelRef.current = labels;
        mapRef.current = map;

        // Force resize after mount
        setTimeout(() => map.invalidateSize(), 200);
        setTimeout(() => map.invalidateSize(), 800);

        const onResize = () => map.invalidateSize();
        window.addEventListener('resize', onResize);

        return () => {
            window.removeEventListener('resize', onResize);
            map.remove();
            mapRef.current = null;
        };
    }, []);

    /* ── Change tile layer ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (tileRef.current) map.removeLayer(tileRef.current);
        if (labelRef.current) map.removeLayer(labelRef.current);

        const tile = L.tileLayer(TILE_URLS[activeLayer], {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 18,
        }).addTo(map);
        tileRef.current = tile;

        // Add label overlay only for Satellite
        if (activeLayer === 'Satellite') {
            const labels = L.tileLayer(LABEL_URL, { pane: 'shadowPane', opacity: 0.8 }).addTo(map);
            labelRef.current = labels;
        } else {
            labelRef.current = null;
        }
    }, [activeLayer]);

    /* ── Fetch city data ── */
    useEffect(() => {
        getAllCitiesSummary()
            .then(data => {
                setCities(data);
                if (data.length) setSelected(data[0]);
            })
            .catch(() => {
                const seed = [
                    { city: 'Kathmandu', pm25: 58.2, aqi: 153, status: 'Unhealthy', latitude: 27.7172, longitude: 85.3240 },
                    { city: 'Pokhara', pm25: 20.1, aqi: 68, status: 'Moderate', latitude: 28.2096, longitude: 83.9856 },
                    { city: 'Chitwan', pm25: 35.6, aqi: 100, status: 'Moderate', latitude: 27.5291, longitude: 84.3542 },
                    { city: 'Birgunj', pm25: 72.4, aqi: 188, status: 'Unhealthy', latitude: 27.0104, longitude: 84.8777 },
                    { city: 'Lalitpur', pm25: 46.8, aqi: 129, status: 'Moderate', latitude: 27.6644, longitude: 85.3188 },
                    { city: 'Bhaktapur', pm25: 64.3, aqi: 167, status: 'Unhealthy', latitude: 27.6710, longitude: 85.4298 },
                ];
                setCities(seed);
                setSelected(seed[0]);
            })
            .finally(() => setLoading(false));
    }, []);

    /* ── Place markers on map ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !cities.length) return;

        // Clear old markers
        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        cities.forEach(city => {
            const col = STATUS_COLORS[city.status]?.dot || '#94a3b8';
            const isSel = selected?.city === city.city;
            const size = isSel ? 18 : 14;

            const icon = L.divIcon({
                className: 'mv-custom-marker',
                html: `
                    <div style="position:relative;display:flex;align-items:center;justify-content:center;">
                        ${isSel ? `<div style="position:absolute;width:32px;height:32px;border:2.5px solid ${col};border-radius:50%;animation:mv-ping 1.4s ease-out infinite;opacity:0.6;"></div>` : ''}
                        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${col};border:2.5px solid #fff;box-shadow:0 2px 8px ${col}88;"></div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            const marker = L.marker([city.latitude, city.longitude], { icon })
                .on('click', () => setSelected(city))
                .addTo(map);

            markersRef.current.push(marker);
        });
    }, [cities, selected]);

    /* ── Fly to selected city ── */
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !selected) return;
        map.flyTo([selected.latitude, selected.longitude], 11, { duration: 1.5 });
    }, [selected]);

    const sel = selected;
    const c = sel ? statusColor(sel.status) : STATUS_COLORS.Moderate;

    return (
        <div className="mv-root">
            <div className="mv-layout">

                {/* ── Map ── */}
                <div className="mv-map-wrap">
                    <div ref={mapElRef} className="mv-map-el" />

                    {/* Layer buttons */}
                    <div className="mv-layer-btns">
                        {Object.keys(TILE_URLS).map(l => (
                            <button
                                key={l}
                                onClick={() => setActiveLayer(l)}
                                className={`mv-layer-btn${activeLayer === l ? ' active' : ''}`}
                            >
                                {l}
                            </button>
                        ))}
                    </div>

                    {/* Layer badge */}
                    <div className="mv-layer-badge">
                        <Layers size={12} />
                        <span>Map: {activeLayer}</span>
                    </div>

                    {/* Legend */}
                    <div className="mv-legend">
                        {[
                            { label: 'Good', color: '#22c55e' },
                            { label: 'Moderate', color: '#eab308' },
                            { label: 'Unhealthy', color: '#ef4444' },
                        ].map(item => (
                            <div key={item.label} className="mv-legend-item">
                                <span className="mv-legend-dot" style={{ background: item.color }} />
                                <span>{item.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Reset view */}
                    <div className="mv-ctrl-wrap">
                        <button className="mv-ctrl-btn" onClick={() => cities[0] && setSelected(cities[0])}>
                            <Crosshair size={14} />
                            Reset View
                        </button>
                    </div>
                </div>

                {/* ── Sidebar ── */}
                <aside className="mv-sidebar">
                    <div className="mv-sidebar-inner">
                        <div className="mv-sidebar-header">
                            <div className="mv-sidebar-eyebrow">
                                <Satellite size={14} color="#0891b2" />
                                <span>Location Insight</span>
                            </div>
                            <h2 className="mv-sidebar-city">{sel?.city ?? '—'}</h2>
                            <p className="mv-sidebar-desc">Real-time satellite-derived air quality parameters</p>
                        </div>

                        {/* AQI card */}
                        <AnimatePresence mode="wait">
                            {sel && (
                                <motion.div
                                    key={sel.city}
                                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    className="mv-aqi-card"
                                    style={{ background: c.bg, borderColor: c.border }}
                                >
                                    <div className="mv-aqi-top">
                                        <div>
                                            <p className="mv-aqi-label">Current PM2.5</p>
                                            <div className="mv-aqi-num">
                                                {sel.pm25}
                                                <span className="mv-aqi-unit"> µg/m³</span>
                                            </div>
                                        </div>
                                        <div style={{ padding: 10, borderRadius: 12, background: '#fff' }}>
                                            <Activity size={20} color={c.text} />
                                        </div>
                                    </div>
                                    <div className="mv-aqi-bottom">
                                        <span className="mv-aqi-status" style={{ color: c.text, background: '#fff', border: `1px solid ${c.border}` }}>
                                            {sel.status}
                                        </span>
                                        <div className="mv-aqi-index">
                                            <span style={{ fontSize: 10, color: '#94a3b8' }}>AQI INDEX</span>
                                            <div style={{ fontWeight: 900, color: '#0f172a' }}>{sel.aqi}</div>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* City list */}
                        <div className="mv-city-list">
                            <h3 className="mv-city-list-title">
                                <MapPin size={13} />
                                All Monitoring Stations
                            </h3>
                            {loading
                                ? Array.from({ length: 5 }, (_, i) => <div key={i} className="mv-city-skeleton" />)
                                : cities.map(city => {
                                    const cc = statusColor(city.status);
                                    const isActive = selected?.city === city.city;
                                    return (
                                        <button
                                            key={city.city}
                                            onClick={() => setSelected(city)}
                                            className={`mv-city-row${isActive ? ' active' : ''}`}
                                            style={isActive ? { background: cc.bg, borderColor: cc.border, transform: 'translateX(4px)' } : {}}
                                        >
                                            <div className="mv-city-dot" style={{ background: cc.dot }} />
                                            <span className="mv-city-name">{city.city}</span>
                                            <span className="mv-city-pm25" style={{ color: cc.text }}>{city.pm25} µg/m³</span>
                                        </button>
                                    );
                                })
                            }
                        </div>

                        {/* Info box */}
                        <div className="mv-info-box">
                            <Info size={16} color="#0891b2" style={{ flexShrink: 0, marginTop: 1 }} />
                            <p>Map displays real-time PM2.5 concentrations. Click any marker or station to view details.</p>
                        </div>
                    </div>
                </aside>
            </div>

            {/* ── Scoped styles ── */}
            <style>{`
                .mv-root {
                    font-family: 'Outfit', sans-serif;
                    background: #f8fafc;
                    color: #0f172a;
                    position: fixed;
                    top: 64px; left: 0; right: 0; bottom: 0;
                    display: flex; flex-direction: column;
                    z-index: 1;
                }
                .mv-layout {
                    flex: 1; display: flex; overflow: hidden; height: 100%;
                }

                /* Map */
                .mv-map-wrap {
                    flex: 1; position: relative; background: #dbeafe; min-height: 0;
                }
                .mv-map-el {
                    position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                    z-index: 1;
                }

                /* Marker animations */
                @keyframes mv-ping {
                    0%   { transform: scale(0.5); opacity: 0.8; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
                .mv-custom-marker { background: none !important; border: none !important; }

                /* Layer buttons */
                .mv-layer-btns {
                    position: absolute; top: 20px; left: 20px; z-index: 1000;
                    display: flex; background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 12px; overflow: hidden;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
                }
                .mv-layer-btn {
                    padding: 8px 14px; font-size: 11px; font-weight: 800;
                    color: #64748b; background: none; border: none; cursor: pointer;
                    transition: all 0.2s; font-family: inherit;
                    text-transform: uppercase; letter-spacing: 0.05em;
                }
                .mv-layer-btn:hover { background: #f8fafc; color: #0f172a; }
                .mv-layer-btn.active { background: #0f172a; color: #fff; }

                /* Reset */
                .mv-ctrl-wrap { position: absolute; top: 20px; right: 20px; z-index: 1000; }
                .mv-ctrl-btn {
                    background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 8px; padding: 6px 12px;
                    display: flex; align-items: center; gap: 6px;
                    font-size: 11px; font-weight: 700; color: #475569;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    cursor: pointer; transition: all 0.2s;
                }
                .mv-ctrl-btn:hover { background: #f8fafc; color: #0f172a; transform: translateY(-1px); }

                /* Layer badge */
                .mv-layer-badge {
                    position: absolute; bottom: 20px; left: 20px; z-index: 1000;
                    display: flex; align-items: center; gap: 6px;
                    background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0;
                    border-radius: 999px; padding: 6px 14px;
                    font-size: 11px; font-weight: 800; color: #475569;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }

                /* Legend */
                .mv-legend {
                    position: absolute; bottom: 20px; right: 20px; z-index: 1000;
                    display: flex; gap: 16px;
                    background: rgba(255,255,255,0.95); border: 1px solid #e2e8f0;
                    border-radius: 12px; padding: 10px 18px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.08);
                }
                .mv-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #475569; }
                .mv-legend-dot { width: 10px; height: 10px; border-radius: 50%; }

                /* Sidebar */
                .mv-sidebar {
                    width: 360px; flex-shrink: 0;
                    background: #fff; border-left: 1px solid #e2e8f0;
                    display: flex; flex-direction: column;
                    overflow-y: auto; z-index: 10;
                }
                .mv-sidebar-inner { padding: 32px 24px; display: flex; flex-direction: column; gap: 24px; }
                .mv-sidebar-header { display: flex; flex-direction: column; gap: 6px; }
                .mv-sidebar-eyebrow {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 11px; font-weight: 800; color: #0891b2;
                    text-transform: uppercase; letter-spacing: 0.1em;
                }
                .mv-sidebar-city {
                    font-size: 32px; font-weight: 900; color: #0f172a;
                    letter-spacing: -0.02em; line-height: 1.1; margin: 0;
                }
                .mv-sidebar-desc { font-size: 13px; color: #64748b; line-height: 1.6; margin: 0; }

                /* AQI card */
                .mv-aqi-card {
                    border: 1px solid; border-radius: 20px; padding: 24px;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.05);
                }
                .mv-aqi-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
                .mv-aqi-label { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; margin: 0 0 4px; }
                .mv-aqi-num { font-size: 42px; font-weight: 900; color: #0f172a; line-height: 1; }
                .mv-aqi-unit { font-size: 14px; font-weight: 600; color: #94a3b8; }
                .mv-aqi-bottom { display: flex; align-items: center; justify-content: space-between; }
                .mv-aqi-status { font-size: 13px; font-weight: 800; padding: 6px 16px; border-radius: 999px; }
                .mv-aqi-index { display: flex; flex-direction: column; align-items: flex-end; }

                /* City list */
                .mv-city-list { display: flex; flex-direction: column; gap: 6px; }
                .mv-city-list-title {
                    display: flex; align-items: center; gap: 6px;
                    font-size: 12px; font-weight: 800; color: #94a3b8;
                    text-transform: uppercase; letter-spacing: 0.1em;
                    margin: 0 0 12px;
                }
                .mv-city-row {
                    display: flex; align-items: center; gap: 12px;
                    padding: 12px 16px; border-radius: 12px;
                    background: #f8fafc; border: 1.5px solid transparent;
                    cursor: pointer; text-align: left; width: 100%;
                    font-family: inherit; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mv-city-row:hover { background: #f1f5f9; transform: translateX(2px); }
                .mv-city-row.active { border-color: inherit; }
                .mv-city-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
                .mv-city-name { flex: 1; font-size: 15px; font-weight: 700; color: #334155; }
                .mv-city-pm25 { font-size: 14px; font-weight: 800; }
                .mv-city-skeleton {
                    height: 48px; background: #f1f5f9; border-radius: 12px;
                    animation: mv-pulse 1.5s ease-in-out infinite;
                }
                @keyframes mv-pulse { 0%,100%{opacity:1;} 50%{opacity:0.5;} }

                /* Info box */
                .mv-info-box {
                    display: flex; align-items: flex-start; gap: 12px;
                    background: #f0f9ff; border: 1px solid #e0f2fe;
                    border-radius: 16px; padding: 18px;
                    font-size: 13px; color: #0369a1; line-height: 1.6;
                }
                .mv-info-box p { margin: 0; }

                /* Leaflet overrides inside our container */
                .mv-map-el .leaflet-container { background: #dbeafe; }
                .mv-map-wrap .leaflet-bar { border: none !important; box-shadow: 0 4px 12px rgba(0,0,0,0.1) !important; }
                .mv-map-wrap .leaflet-bar a {
                    background-color: #fff !important; color: #0f172a !important;
                    border: 1px solid #e2e8f0 !important;
                }

                @media (max-width: 1024px) { .mv-sidebar { width: 320px; } }
                @media (max-width: 800px) {
                    .mv-root { position: relative; top: 0; min-height: calc(100vh - 64px); }
                    .mv-layout { flex-direction: column; overflow: visible; }
                    .mv-map-wrap { height: 450px; flex: none; }
                    .mv-sidebar { width: 100%; border-left: none; border-top: 1px solid #e2e8f0; }
                }
            `}</style>
        </div>
    );
}
