import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    Calendar, TrendingUp, Wind, CloudSun,
    Droplets, Zap, MapPin, ChevronDown, RefreshCw, AlertCircle,
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getCities, getCitySummary } from '../services/api';

/* ── AQI helpers ─────────────────────────────── */
const STATUS_COLORS = {
    Good: { text: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', hex: '#22c55e' },
    Moderate: { text: '#9ca000', bg: '#fffbeb', border: '#fde152', hex: '#eefa04' },
    'Unhealthy for SG': { text: '#d84315', bg: '#fff3e0', border: '#ffb74d', hex: '#f48415' },
    Unhealthy: { text: '#dc2626', bg: '#fff1f2', border: '#f87171', hex: '#f42415' },
    'Very Unhealthy': { text: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe', hex: '#7c3aed' },
    Hazardous: { text: '#7f1d1d', bg: '#fef2f2', border: '#fca5a5', hex: '#9c493a' },
};

function getStatusColor(pm25) {
    if (pm25 <= 12.0) return STATUS_COLORS.Good;
    if (pm25 <= 35.4) return STATUS_COLORS.Moderate;
    if (pm25 <= 55.4) return STATUS_COLORS['Unhealthy for SG'];
    if (pm25 <= 150.4) return STATUS_COLORS.Unhealthy;
    if (pm25 <= 250.4) return STATUS_COLORS['Very Unhealthy'];
    return STATUS_COLORS.Hazardous;
}

function getStatusLabel(pm25) {
    if (pm25 <= 12.0) return 'Good';
    if (pm25 <= 35.4) return 'Moderate';
    if (pm25 <= 55.4) return 'Unhealthy for SG';
    if (pm25 <= 150.4) return 'Unhealthy';
    if (pm25 <= 250.4) return 'Very Unhealthy';
    return 'Hazardous';
}

/* ── Forecast day card ───────────────────────── */
const DayCard = ({ day, pm25, isToday }) => {
    const c = getStatusColor(pm25);
    return (
        <motion.div
            whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
            style={{
                background: isToday ? c.bg : '#fff',
                border: `1.5px solid ${isToday ? c.border : '#e2e8f0'}`,
                borderRadius: 16, padding: '20px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 10, textAlign: 'center',
                transition: 'box-shadow 0.2s',
                position: 'relative', overflow: 'hidden',
            }}
        >

            <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Day {day}
            </p>
            <div style={{ fontSize: 40, fontWeight: 900, color: c.text, lineHeight: 1 }}>{pm25}</div>
            <p style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>µg/m³</p>
            <span style={{
                fontSize: 11, fontWeight: 700, color: c.text,
                background: c.bg, border: `1px solid ${c.border}`,
                borderRadius: 999, padding: '3px 10px',
            }}>
                {getStatusLabel(pm25)}
            </span>
        </motion.div>
    );
};

/* ── Custom tooltip ──────────────────────────── */
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const pm25 = payload[0].value;
    const c = getStatusColor(pm25);
    return (
        <div style={{
            background: '#fff', border: `1px solid ${c.border}`,
            borderRadius: 12, padding: '12px 16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
            minWidth: 120,
        }}>
            <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 4 }}>
                Day {label} (Forecast)
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: c.text }}>{pm25} <span style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>µg/m³</span></p>
            <p style={{ fontSize: 11, color: c.text, fontWeight: 700, marginTop: 4 }}>{getStatusLabel(pm25)}</p>
        </div>
    );
};

/* ── Main Page ───────────────────────────────── */
export default function ForecastPage() {
    const [cities, setCities] = useState([]);
    const [city, setCity] = useState('Kathmandu');
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        getCities()
            .then(list => setCities(list.map(c => c.name)))
            .catch(() => setCities(['Kathmandu', 'Pokhara', 'Chitwan', 'Birgunj']));
    }, []);

    const fetchData = useCallback(async (cityName) => {
        setLoading(true); setError(null);
        try {
            const result = await getCitySummary(cityName);
            setData(result);
            setLastUpdated(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(city); }, [city, fetchData]);

    const forecast = data?.forecast || [];

    return (
        <div className="fp-root">
            {/* ── Header ── */}
            <div className="fp-header">
                <div>
                    <div className="fp-badge">
                        <Calendar size={13} />
                        <span>LSTM 7-Day Temporal Prediction</span>
                    </div>
                    <h1 className="fp-title">PM2.5 Forecast</h1>
                    <p className="fp-subtitle">Predicting air quality 7 days ahead using Long Short-Term Memory neural networks trained on satellite and meteorological data.</p>
                </div>
                <div className="fp-stats-row">
                    <div className="fp-stat-box">
                        <span className="fp-stat-label">Model Accuracy</span>
                        <span className="fp-stat-value" style={{ color: '#16a34a' }}>81.6%</span>
                    </div>
                </div>
            </div>

            {/* ── Error banner ── */}
            {error && (
                <div className="fp-error">
                    <AlertCircle size={16} />
                    <span>Could not reach API. Showing seed data. ({error})</span>
                </div>
            )}

            {/* ── City selector + refresh ── */}
            <div className="fp-selector-row">
                <div className="fp-select-wrap">
                    <MapPin size={16} color="#06b6d4" style={{ flexShrink: 0, marginRight: 8 }} />
                    <button className="fp-select-btn" onClick={() => setOpen(v => !v)}>
                        <span>{city}</span>
                        <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : '', transition: 'transform 0.2s' }} />
                    </button>
                    {open && (
                        <div className="fp-dropdown">
                            {cities.map(c => (
                                <button
                                    key={c}
                                    className={`fp-dropdown-item${c === city ? ' active' : ''}`}
                                    onClick={() => { setCity(c); setOpen(false); }}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <button
                    className="fp-refresh-btn"
                    onClick={() => fetchData(city)}
                    disabled={loading}
                >
                    <RefreshCw size={14} className={loading ? 'fp-spin' : ''} />
                    {loading ? 'Loading…' : 'Refresh'}
                </button>
                {lastUpdated && (
                    <span className="fp-updated">Updated {lastUpdated.toLocaleTimeString()}</span>
                )}
            </div>

            {/* ── Main Chart ── */}
            <div className="fp-chart-card">
                <div className="fp-chart-card-header">
                    <div>
                        <h2 className="fp-chart-title">
                            <Zap size={16} color="#eefa04" />
                            7-Day PM2.5 Prediction — {city}
                        </h2>
                        <p className="fp-chart-subtitle">LSTM model output with confidence bounds</p>
                    </div>
                </div>
                {loading ? (
                    <div className="fp-chart-loading">
                        <div className="fp-spinner" />
                    </div>
                ) : forecast.length ? (
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={forecast} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                            <defs>
                                <linearGradient id="fcGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eefa04" stopOpacity={0.25} />
                                    <stop offset="95%" stopColor="#eefa04" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                            <XAxis
                                dataKey="day"
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickLine={false} axisLine={false}
                                tickFormatter={v => `Day ${v}`}
                            />
                            <YAxis
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickLine={false} axisLine={false}
                                label={{ value: 'PM2.5 µg/m³', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94a3b8', dy: 50 }}
                            />
                            <ReferenceLine y={12.0} stroke="#22c55e" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Good', position: 'right', fontSize: 9, fill: '#22c55e' }} />
                            <ReferenceLine y={35.4} stroke="#eefa04" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Moderate', position: 'right', fontSize: 9, fill: '#eefa04' }} />
                            <ReferenceLine y={55.4} stroke="#f48415" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Unhealthy for SG', position: 'right', fontSize: 9, fill: '#f48415' }} />
                            <ReferenceLine y={150.4} stroke="#f42415" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: 'Unhealthy', position: 'right', fontSize: 9, fill: '#f42415' }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone" dataKey="pm25"
                                stroke="#eefa04" strokeWidth={2.5}
                                fill="url(#fcGradient)"
                                dot={{ fill: '#eefa04', r: 4, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, fill: '#eefa04', stroke: '#fff', strokeWidth: 2 }}
                                animationDuration={1000}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="fp-chart-loading" style={{ color: '#94a3b8', fontSize: 14 }}>No forecast data available</div>
                )}
            </div>

            {/* ── Day Cards ── */}
            <div className="fp-section">
                <h3 className="fp-section-title">Daily Breakdown</h3>
                <div className="fp-day-grid">
                    {loading
                        ? Array.from({ length: 7 }, (_, i) => (
                            <div key={i} className="fp-skeleton" />
                        ))
                        : forecast.map((d, i) => (
                            <DayCard key={d.day} day={d.day} pm25={d.pm25} isToday={i === 0} />
                        ))
                    }
                </div>
            </div>

            {/* ── Influencer Cards ── */}
            <div className="fp-section">
                <h3 className="fp-section-title">Model Insights</h3>
                <div className="fp-info-grid">
                    <div className="fp-info-card" style={{ borderTopColor: '#3b82f6' }}>
                        <div className="fp-info-icon" style={{ background: '#eff6ff' }}>
                            <Wind size={22} color="#3b82f6" />
                        </div>
                        <div>
                            <h4 className="fp-info-title">Wind Influence</h4>
                            <p className="fp-info-desc">Western disturbances detected. Low wind intensity likely to cause particle trapping in the valley for the next 48 hours.</p>
                        </div>
                    </div>
                    <div className="fp-info-card" style={{ borderTopColor: '#f59e0b' }}>
                        <div className="fp-info-icon" style={{ background: '#fefce8' }}>
                            <CloudSun size={22} color="#f59e0b" />
                        </div>
                        <div>
                            <h4 className="fp-info-title">Seasonal Trend</h4>
                            <p className="fp-info-desc">Stable winter inversion layer active. Expect higher late-night PM2.5 concentrations due to temperature drop.</p>
                        </div>
                    </div>
                    <div className="fp-info-card" style={{ borderTopColor: '#22c55e' }}>
                        <div className="fp-info-icon" style={{ background: '#f0fdf4' }}>
                            <TrendingUp size={22} color="#22c55e" />
                        </div>
                        <div>
                            <h4 className="fp-info-title">Predictive Logic</h4>
                            <p className="fp-info-desc">LSTM model integrated with real-time MODIS Aerosol Optical Depth (AOD) data and NO₂/SO₂ surface reflectance variables.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── AQI Reference ── */}
            <div className="fp-section">
                <h3 className="fp-section-title">AQI Reference Scale</h3>
                <div className="fp-scale">
                    {[
                        { label: 'Good', range: '0 – 12.0 µg/m³', color: '#22c55e', bg: '#f0fdf4' },
                        { label: 'Moderate', range: '12.1 – 35.4 µg/m³', color: '#eefa04', bg: '#fffbeb' },
                        { label: 'Unhealthy for SG', range: '35.5 – 55.4 µg/m³', color: '#f48415', bg: '#fff3e0' },
                        { label: 'Unhealthy', range: '55.5 – 150.4 µg/m³', color: '#f42415', bg: '#fff1f2' },
                        { label: 'Very Unhealthy', range: '150.5 – 250.4 µg/m³', color: '#7c3aed', bg: '#faf5ff' },
                        { label: 'Hazardous', range: '250.5+ µg/m³', color: '#9c493a', bg: '#fef2f2' },
                    ].map(s => (
                        <div key={s.label} className="fp-scale-item" style={{ background: s.bg }}>
                            <div className="fp-scale-dot" style={{ background: s.color }} />
                            <div>
                                <p className="fp-scale-label" style={{ color: s.color }}>{s.label}</p>
                                <p className="fp-scale-range">{s.range}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Scoped Styles ── */}
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&display=swap');

                .fp-root {
                    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: #f8fafc; color: #0f172a;
                    min-height: 100vh; padding: 96px 24px 72px;
                    max-width: 960px; margin: 0 auto;
                }

                /* Header */
                .fp-header {
                    display: flex; justify-content: space-between;
                    align-items: flex-start; flex-wrap: wrap;
                    gap: 20px; margin-bottom: 28px;
                }
                .fp-badge {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 11px; font-weight: 800; color: #0891b2;
                    background: #e0f2fe; border: 1px solid #bae6fd;
                    border-radius: 999px; padding: 4px 12px;
                    letter-spacing: 0.05em; margin-bottom: 10px;
                    text-transform: uppercase;
                }
                .fp-title {
                    font-size: clamp(26px, 4vw, 36px); font-weight: 900;
                    color: #0f172a; letter-spacing: -0.02em; margin-bottom: 8px;
                }
                .fp-subtitle {
                    font-size: 14px; color: #64748b; max-width: 520px; line-height: 1.6;
                }
                .fp-stats-row {
                    display: flex; gap: 12px; align-items: flex-start; flex-shrink: 0;
                }
                .fp-stat-box {
                    background: #fff; border: 1px solid #e2e8f0; border-radius: 14px;
                    padding: 14px 20px; display: flex; flex-direction: column;
                    align-items: center; gap: 4; min-width: 100px; text-align: center;
                }
                .fp-stat-label { font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
                .fp-stat-value { font-size: 22px; font-weight: 900; color: #0f172a; }

                /* Error */
                .fp-error {
                    display: flex; align-items: center; gap: 10px;
                    background: #fff7ed; border: 1px solid #fed7aa;
                    border-radius: 10px; padding: 12px 16px;
                    font-size: 13px; color: #c2410c; font-weight: 500;
                    margin-bottom: 20px;
                }

                /* Selector */
                .fp-selector-row {
                    display: flex; gap: 12px; align-items: center;
                    margin-bottom: 24px; flex-wrap: wrap;
                }
                .fp-select-wrap {
                    position: relative; display: flex; align-items: center;
                    background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 10px; padding: 0 16px; height: 44px; flex: 1; min-width: 180px;
                }
                .fp-select-btn {
                    flex: 1; display: flex; align-items: center; justify-content: space-between;
                    background: none; border: none; outline: none; cursor: pointer;
                    font-size: 15px; font-weight: 600; color: #0f172a; font-family: inherit;
                }
                .fp-dropdown {
                    position: absolute; top: calc(100% + 4px); left: 0; right: 0;
                    background: #fff; border: 1px solid #e2e8f0; border-radius: 10px;
                    overflow: hidden; z-index: 50; box-shadow: 0 8px 24px rgba(0,0,0,0.10);
                }
                .fp-dropdown-item {
                    display: block; width: 100%; text-align: left;
                    padding: 10px 16px; font-size: 14px; font-weight: 500;
                    color: #374151; background: none; border: none;
                    cursor: pointer; transition: background .15s; font-family: inherit;
                }
                .fp-dropdown-item:hover { background: #f1f5f9; }
                .fp-dropdown-item.active { background: #eff6ff; color: #2563eb; font-weight: 700; }
                .fp-refresh-btn {
                    height: 44px; padding: 0 20px; background: #2563eb; color: #fff;
                    font-size: 14px; font-weight: 700; border-radius: 10px; border: none;
                    cursor: pointer; display: flex; align-items: center; gap: 7px;
                    transition: background .2s; white-space: nowrap; font-family: inherit;
                }
                .fp-refresh-btn:hover:not(:disabled) { background: #1d4ed8; }
                .fp-refresh-btn:disabled { opacity: .7; cursor: not-allowed; }
                .fp-updated { font-size: 11px; color: #94a3b8; }
                @keyframes fp-spin { to { transform: rotate(360deg); } }
                .fp-spin { animation: fp-spin 0.7s linear infinite; }

                /* Chart */
                .fp-chart-card {
                    background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 20px; padding: 24px;
                    margin-bottom: 32px;
                }
                .fp-chart-card-header {
                    display: flex; justify-content: space-between;
                    align-items: flex-start; margin-bottom: 20px;
                    flex-wrap: wrap; gap: 10px;
                }
                .fp-chart-title {
                    font-size: 16px; font-weight: 800; color: #0f172a;
                    display: flex; align-items: center; gap: 7px; margin-bottom: 4px;
                }
                .fp-chart-subtitle { font-size: 12px; color: #94a3b8; }
                .fp-chart-meta {
                    display: flex; align-items: center; gap: 5px;
                    font-size: 11px; color: #94a3b8; font-weight: 600;
                }
                .fp-chart-loading {
                    height: 280px; display: flex;
                    align-items: center; justify-content: center;
                }
                .fp-spinner {
                    width: 32px; height: 32px;
                    border: 3px solid #e2e8f0; border-top-color: #eefa04;
                    border-radius: 50%; animation: fp-spin 0.7s linear infinite;
                }

                /* Section */
                .fp-section { margin-bottom: 36px; }
                .fp-section-title {
                    font-size: 16px; font-weight: 900; color: #0f172a; margin-bottom: 16px;
                }

                /* Day grid */
                .fp-day-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 10px;
                }
                .fp-skeleton {
                    height: 160px; background: #f1f5f9;
                    border-radius: 16px; animation: pulse 1.5s ease-in-out infinite;
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: .5; }
                }

                /* Info cards */
                .fp-info-grid {
                    display: grid; grid-template-columns: repeat(3, 1fr);
                    gap: 16px;
                }
                .fp-info-card {
                    background: #fff; border: 1px solid #e2e8f0;
                    border-top: 4px solid;
                    border-radius: 16px; padding: 20px;
                    display: flex; gap: 14px; align-items: flex-start;
                }
                .fp-info-icon {
                    width: 44px; height: 44px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .fp-info-title { font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
                .fp-info-desc { font-size: 13px; color: #64748b; line-height: 1.6; }

                /* AQI Scale */
                .fp-scale {
                    display: grid; grid-template-columns: repeat(4, 1fr);
                    gap: 12px;
                }
                .fp-scale-item {
                    border-radius: 14px; padding: 16px 14px;
                    display: flex; align-items: center; gap: 10px;
                }
                .fp-scale-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
                .fp-scale-label { font-size: 13px; font-weight: 800; }
                .fp-scale-range { font-size: 11px; color: #64748b; margin-top: 2px; }

                /* Responsive */
                @media (max-width: 900px) {
                    .fp-day-grid { grid-template-columns: repeat(4, 1fr); }
                    .fp-info-grid { grid-template-columns: 1fr 1fr; }
                    .fp-scale { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 640px) {
                    .fp-root { padding: 88px 16px 56px; }
                    .fp-day-grid { grid-template-columns: repeat(3, 1fr); }
                    .fp-info-grid { grid-template-columns: 1fr; }
                    .fp-scale { grid-template-columns: 1fr 1fr; }
                    .fp-stats-row { flex-direction: row; }
                    .fp-header { flex-direction: column; }
                }
                @media (max-width: 420px) {
                    .fp-day-grid { grid-template-columns: repeat(2, 1fr); }
                }
            `}</style>
        </div>
    );
}
