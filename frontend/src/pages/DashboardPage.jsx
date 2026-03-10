import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Activity, ChevronDown, MapPin, Wind, Thermometer,
    Wifi, WifiOff, TrendingUp, TrendingDown, Minus, Play,
    RefreshCw, AlertCircle,
} from 'lucide-react';
import {
    XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, AreaChart, Area, ReferenceLine,
} from 'recharts';
import { getCities, getCitySummary, triggerPredictions } from '../services/api';

/* ─── status config ───────────────────────────────────────── */
const STATUS = {
    Good: { text: '#15803d', bg: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '#86efac', badge: '#22c55e', num: '#15803d' },
    Moderate: { text: '#9ca000', bg: 'linear-gradient(135deg,#fffbeb,#fef9c3)', border: '#fde152', badge: '#eefa04', num: '#9ca000' },
    'Unhealthy for SG': { text: '#d84315', bg: 'linear-gradient(135deg,#fff3e0,#ffe0b2)', border: '#ffb74d', badge: '#f48415', num: '#d84315' },
    Unhealthy: { text: '#b91c1c', bg: 'linear-gradient(135deg,#fff1f2,#ffe4e6)', border: '#f87171', badge: '#f42415', num: '#b91c1c' },
    'Very Unhealthy': { text: '#6d28d9', bg: 'linear-gradient(135deg,#faf5ff,#ede9fe)', border: '#c4b5fd', badge: '#7c3aed', num: '#6d28d9' },
    Hazardous: { text: '#7f1d1d', bg: 'linear-gradient(135deg,#fef2f2,#fee2e2)', border: '#fca5a5', badge: '#9c493a', num: '#7f1d1d' },
};

function getStatus(pm25) {
    if (!pm25) return STATUS.Moderate;
    if (pm25 <= 12.0) return STATUS.Good;
    if (pm25 <= 35.4) return STATUS.Moderate;
    if (pm25 <= 55.4) return STATUS['Unhealthy for SG'];
    if (pm25 <= 150.4) return STATUS.Unhealthy;
    if (pm25 <= 250.4) return STATUS['Very Unhealthy'];
    return STATUS.Hazardous;
}

function getStatusLabel(pm25) {
    if (!pm25) return 'Moderate';
    if (pm25 <= 12.0) return 'Good';
    if (pm25 <= 35.4) return 'Moderate';
    if (pm25 <= 55.4) return 'Unhealthy for SG';
    if (pm25 <= 150.4) return 'Unhealthy';
    if (pm25 <= 250.4) return 'Very Unhealthy';
    return 'Hazardous';
}

/* ─── sparkline helper ────────────────────────────────────── */
const spark = (series) =>
    Array.isArray(series) && series.length > 1
        ? series.map((v, i) => ({ i, v: Number(v) }))
        : Array.from({ length: 12 }, (_, i) => ({ i, v: typeof series === 'number' ? series : 0 }));

/* ─── custom tooltip ──────────────────────────────────────── */
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
            padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,.10)',
        }}>
            <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginBottom: 2 }}>Day {label}</p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
                {payload[0].value} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>µg/m³</span>
            </p>
        </div>
    );
};

/* ─── AQI gauge arc (SVG) ─────────────────────────────────── */
const AQIGauge = ({ pm25, colors }) => {
    const max = 200;
    const clamped = Math.min(pm25 || 0, max);
    const pct = clamped / max;
    const r = 70;
    const cx = 90; const cy = 90;
    const startAngle = -210; const sweep = 240;
    const toRad = d => (d * Math.PI) / 180;
    const polarToCart = (angle, radius) => ({
        x: cx + radius * Math.cos(toRad(angle)),
        y: cy + radius * Math.sin(toRad(angle)),
    });
    const arcPath = (r2, fromA, toA) => {
        const s = polarToCart(fromA, r2);
        const e = polarToCart(toA, r2);
        const large = (toA - fromA) > 180 ? 1 : 0;
        return `M ${s.x} ${s.y} A ${r2} ${r2} 0 ${large} 1 ${e.x} ${e.y}`;
    };
    const valueAngle = startAngle + pct * sweep;

    return (
        <svg width={180} height={140} viewBox="0 0 180 140" style={{ overflow: 'visible' }}>
            {/* Track */}
            <path d={arcPath(r, startAngle, startAngle + sweep)} fill="none"
                stroke="#e2e8f0" strokeWidth={14} strokeLinecap="round" />
            {/* Value arc */}
            {pm25 > 0 && (
                <path d={arcPath(r, startAngle, valueAngle)} fill="none"
                    stroke={colors.badge} strokeWidth={14} strokeLinecap="round" />
            )}
            {/* Needle dot */}
            {pm25 > 0 && (
                <circle
                    cx={polarToCart(valueAngle, r).x}
                    cy={polarToCart(valueAngle, r).y}
                    r={8} fill={colors.badge} stroke="#fff" strokeWidth={3}
                />
            )}
        </svg>
    );
};

/* ─── Legend row ──────────────────────────────────────────── */
const LegendRow = ({ color, label, range, desc }) => (
    <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 0', borderBottom: '1px solid #f1f5f9',
    }}>
        <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: color, flexShrink: 0, marginTop: 4,
        }} />
        <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#0f172a', marginBottom: 2 }}>
                {label} <span style={{ fontSize: 12, fontWeight: 500, color: '#64748b' }}>{range}</span>
            </p>
            <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.55, margin: 0 }}>{desc}</p>
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════ */
export default function DashboardPage() {
    const [cities, setCities] = useState([]);
    const [city, setCity] = useState('Kathmandu');
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [online, setOnline] = useState(true);
    const [pipelineRunning, setPipelineRunning] = useState(false);
    const [pipelineStatus, setPipelineStatus] = useState(null);

    useEffect(() => {
        getCities()
            .then(list => setCities(list.map(c => c.name)))
            .catch(() => setCities(['Kathmandu', 'Pokhara', 'Chitwan', 'Birgunj', 'Lalitpur', 'Bhaktapur']));
    }, []);

    const fetchData = useCallback(async (cityName) => {
        setLoading(true); setError(null);
        try {
            const result = await getCitySummary(cityName);
            setData(result);
            setLastUpdated(new Date());
            setOnline(true);
        } catch (err) {
            setError(err.message);
            setOnline(false);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(city); }, [city, fetchData]);

    const handleTriggerPipeline = async () => {
        setPipelineRunning(true);
        setPipelineStatus('Pipeline running... This may take 5-15 minutes');
        try {
            const result = await triggerPredictions();
            setPipelineStatus('Pipeline completed! Data updated.');
            // Refresh current city data
            await fetchData(city);
            // Clear status message after 3 seconds
            setTimeout(() => setPipelineStatus(null), 3000);
        } catch (err) {
            setPipelineStatus(`Error: ${err.message}`);
            setTimeout(() => setPipelineStatus(null), 3000);
        } finally {
            setPipelineRunning(false);
        }
    };

    const colors = getStatus(data?.pm25);
    const statusLbl = data ? getStatusLabel(data.pm25) : '—';

    return (
        <div className="db-outer">
            {/* ═══ TOP HERO BAND ═══════════════════════════════════ */}
            <div className="db-hero-band">
                <div className="db-hero-inner">
                    {/* Left: title */}
                    <div>
                        <h1 className="db-hero-title">Air Quality Dashboard</h1>
                        <p className="db-hero-sub">Monitor & forecast PM2.5 across Nepal in real-time</p>
                    </div>
                    {/* Right: status + time */}
                    <div className="db-hero-meta">
                        <span className={`db-badge ${online ? 'db-badge-online' : 'db-badge-offline'}`}>
                            {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                            {online ? 'Live' : 'Offline'}
                        </span>
                        {lastUpdated && (
                            <span className="db-updated">
                                Updated {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ MAIN CONTENT ════════════════════════════════════ */}
            <div className="db-container">

                {/* Error */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="db-error"
                        >
                            <AlertCircle size={15} />
                            <span>API unreachable — showing seeded / cached data. ({error})</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── District Selector Section ── */}
                <div className="db-district-section">
                    {/* Heading area */}
                    <div className="db-district-header">
                        <div className="db-district-icon-wrap">
                            <motion.div
                                animate={{ y: [0, -3, 0] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                className="db-district-icon"
                            >
                                <MapPin size={20} color="#fff" />
                            </motion.div>
                        </div>
                        <div>
                            <h2 className="db-district-title">Select Your District</h2>
                            <p className="db-district-subtitle">Choose a location to view real-time air quality data & forecasts</p>
                        </div>
                    </div>

                    {/* Selector bar */}
                    <div className="db-selector-row">
                        <div className="db-select-wrap" onClick={() => setOpen(v => !v)}>
                            <div className="db-select-pin-glow">
                                <span className="db-pin-pulse" />
                                <MapPin size={16} color="#0891b2" style={{ position: 'relative', zIndex: 1 }} />
                            </div>
                            <button className="db-select-btn">
                                <span>{city}</span>
                                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.25, ease: 'easeInOut' }}>
                                    <ChevronDown size={16} color="#64748b" />
                                </motion.div>
                            </button>
                            <AnimatePresence>
                                {open && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        className="db-dropdown"
                                    >
                                        <div className="db-dd-header">
                                            <MapPin size={12} color="#94a3b8" />
                                            <span>Available Districts</span>
                                        </div>
                                        {cities.map(c => (
                                            <button
                                                key={c}
                                                className={`db-dd-item${c === city ? ' active' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setCity(c); setOpen(false); }}
                                            >
                                                <span className="db-dd-dot" style={{ background: c === city ? '#0891b2' : '#cbd5e1' }} />
                                                <span className="db-dd-name">{c}</span>
                                                {c === city && (
                                                    <span className="db-dd-check">✓</span>
                                                )}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className={`db-fetch-btn${loading ? ' loading' : ''}`}
                            onClick={() => fetchData(city)}
                            disabled={loading}
                        >
                            <RefreshCw size={14} className={loading ? 'spin' : ''} />
                            {loading ? 'Fetching…' : 'Refresh'}
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.03, y: -1 }}
                            whileTap={{ scale: 0.97 }}
                            className={`db-fetch-btn${pipelineRunning ? ' loading' : ''}`}
                            onClick={handleTriggerPipeline}
                            disabled={pipelineRunning}
                            style={{ background: '#a855f7', color: '#fff' }}
                        >
                            <Play size={14} fill="currentColor" className={pipelineRunning ? 'spin' : ''} />
                            {pipelineRunning ? 'Running…' : 'Generate'}
                        </motion.button>
                    </div>
                </div>

                {/* Pipeline Status Message */}
                <AnimatePresence>
                    {pipelineStatus && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                            className="db-error"
                            style={{ background: pipelineStatus.startsWith('Error') ? '#fee2e2' : '#ecfdf5', borderColor: pipelineStatus.startsWith('Error') ? '#fca5a5' : '#86efac', color: pipelineStatus.startsWith('Error') ? '#991b1b' : '#166534' }}
                        >
                            <span>{pipelineStatus}</span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── AQI + Charts Grid ── */}
                <div className="db-top-grid">

                    {/* AQI Card */}
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={city + (data?.pm25 ?? 'x')}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="db-aqi-card"
                            style={{ background: colors.bg, borderColor: colors.border }}
                        >
                            {loading && (
                                <div className="db-overlay">
                                    <div className="db-spinner" style={{ borderTopColor: colors.badge }} />
                                </div>
                            )}

                            {/* Header */}
                            <div className="db-aqi-header">
                                <div>
                                    <p className="db-aqi-eyebrow">Current Location</p>
                                    <h2 className="db-aqi-city" style={{ color: colors.badge }}>{city}</h2>
                                </div>
                                <div className="db-aqi-activity-icon" style={{ background: `${colors.badge}18` }}>
                                    <Activity size={18} color={colors.badge} />
                                </div>
                            </div>

                            {/* Gauge */}
                            <div className="db-gauge-wrap">
                                <AQIGauge pm25={data?.pm25 ?? 0} colors={colors} />
                                <div className="db-gauge-center">
                                    <p className="db-gauge-label">Today's PM2.5</p>
                                    <div className="db-gauge-num" style={{ color: colors.num }}>
                                        {data?.pm25 ?? '—'}
                                    </div>
                                    <span className="db-gauge-unit">µg/m³</span>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="db-aqi-status-row">
                                <span className="db-status-pill" style={{ color: colors.badge, background: `${colors.badge}14`, border: `1px solid ${colors.border}` }}>
                                    {statusLbl}
                                </span>
                                {data?.aqi && (
                                    <span className="db-aqi-index">AQI · <strong>{data.aqi}</strong></span>
                                )}
                            </div>

                            {/* Message */}
                            {data?.message && (
                                <p className="db-aqi-msg">{data.message}</p>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Charts column */}
                    <div className="db-charts-col">

                        {/* Forecast */}
                        <div className="db-chart-card">
                            <div className="db-chart-head">
                                <h3 className="db-chart-title">
                                    <span className="db-chart-dot" style={{ background: '#eefa04' }} />
                                    7-Day LSTM Forecast
                                </h3>
                                <span className="db-chart-tag" style={{ color: '#b45309', background: '#fefce8', borderColor: '#fcd34d' }}>Predicted</span>
                            </div>
                            {data?.forecast?.length ? (
                                <ResponsiveContainer width="100%" height={150}>
                                    <AreaChart data={data.forecast} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#eefa04" stopOpacity={0.25} />
                                                <stop offset="95%" stopColor="#eefa04" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={v => `D${v}`} />
                                        <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                                        <ReferenceLine y={35.4} stroke="#eefa04" strokeDasharray="3 3" strokeWidth={1} />
                                        <Tooltip content={<ChartTooltip />} />
                                        <Area type="monotone" dataKey="pm25" stroke="#eefa04" strokeWidth={2}
                                            fill="url(#fcGrad)"
                                            dot={{ fill: '#eefa04', r: 3, strokeWidth: 2, stroke: '#fff' }}
                                            activeDot={{ r: 5, fill: '#eefa04', stroke: '#fff', strokeWidth: 2 }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="db-chart-empty">
                                    <div className="db-chart-skeleton" />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── AQI Legend ── */}
                <section className="db-section">
                    <div className="db-section-head">
                        <h3 className="db-section-title">Air Quality Index Reference</h3>
                        <p className="db-section-sub">PM2.5 concentration thresholds and health recommendations</p>
                        <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, marginBottom: 0 }}>(Categories based on ECA PM2.5 standards.)</p>
                    </div>
                    <div className="db-legend-card">
                        <div className="db-legend-grid">
                            {[
                                { color: '#22c55e', label: 'Good', range: '0 – 12.0 µg/m³', desc: 'Air quality is satisfactory. Little or no risk for the general population.' },
                                { color: '#eefa04', label: 'Moderate', range: '12.1 – 35.4 µg/m³', desc: 'Acceptable air quality. Sensitive individuals should consider reducing prolonged outdoor exertion.' },
                                { color: '#f48415', label: 'Unhealthy for sensitive groups', range: '35.5 –55.4 µg/m³', desc: 'Sensitive groups may experience health effects. General public is unlikely to be affected.' },
                                { color: '#f42415', label: 'Unhealthy', range: '55.5 –150.4 µg/m³', desc: 'Every groups may experience health effects. Direct problems can be seen in their health.' },
                                { color: '#7c3aed', label: 'Very Unhealthy', range: '150.5 – 250.4 µg/m³', desc: 'Everyone may begin to experience more serious health effects.' },
                                { color: '#9c493a90', label: 'Hazardous', range: '250.5+ µg/m³', desc: 'Very harmful.' },
                            ].map(row => (
                                <LegendRow key={row.label} {...row} />
                            ))}
                        </div>

                        {/* Health tip */}
                        <div className="db-health-tip" style={{
                            background: getStatus(data?.pm25).bg,
                            borderColor: getStatus(data?.pm25).border,
                        }}>
                            <span className="db-health-tip-label">Right now in {city}:</span>
                            <span style={{ color: getStatus(data?.pm25).badge, fontWeight: 800, fontSize: 14 }}>
                                {statusLbl}
                            </span>
                            <span className="db-health-tip-msg">{data?.message ?? 'Fetching…'}</span>
                        </div>
                    </div>
                </section>

            </div>{/* /db-container */}

            {/* ═══ SCOPED STYLES ═══════════════════════════════════ */}
            <style>{`
                /* ── Root layout ──────────────────────────── */
                .db-outer {
                    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: #f0f4f8;
                    min-height: 100vh;
                    color: #0f172a;
                }

                .db-container {
                    max-width: 1080px;
                    margin: 0 auto;
                    padding: 28px 24px 80px;
                }

                /* ── Hero band ───────────────────────────── */
                .db-hero-band {
                    background: #fff;
                    border-bottom: 1px solid #e2e8f0;
                    padding: 0 24px;
                }
                .db-hero-inner {
                    max-width: 1080px;
                    margin: 0 auto;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px 0;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .db-hero-title {
                    font-size: 24px; font-weight: 900;
                    color: #0f172a; letter-spacing: -0.02em;
                    margin: 0 0 3px;
                }
                .db-hero-sub {
                    font-size: 13px; color: #64748b; margin: 0;
                }
                .db-hero-meta {
                    display: flex; align-items: center; gap: 12px;
                }
                .db-badge {
                    display: inline-flex; align-items: center; gap: 5px;
                    font-size: 11px; font-weight: 800; padding: 4px 11px;
                    border-radius: 999px; letter-spacing: 0.04em;
                }
                .db-badge-online  { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
                .db-badge-offline { background: #fff1f2; color: #dc2626; border: 1px solid #fecdd3; }
                .db-updated { font-size: 11px; color: #94a3b8; }

                /* ── Error ─────────────────────────────── */
                .db-error {
                    display: flex; align-items: center; gap: 8px;
                    background: #fff7ed; border: 1px solid #fed7aa;
                    border-radius: 10px; padding: 11px 16px;
                    margin-bottom: 20px;
                    font-size: 13px; color: #c2410c; font-weight: 500;
                }

                /* ── District selector section ─────────── */
                .db-district-section {
                    background: linear-gradient(135deg, #ffffff, #f0f9ff);
                    border: 1.5px solid #e0f2fe;
                    border-radius: 20px;
                    padding: 24px 28px;
                    margin-bottom: 28px;
                    box-shadow: 0 4px 20px rgba(8,145,178,0.06);
                    position: relative;
                    overflow: visible;
                }
                .db-district-section::before {
                    content: '';
                    position: absolute;
                    top: -50%; right: -20%;
                    width: 300px; height: 300px;
                    background: radial-gradient(circle, rgba(8,145,178,0.05) 0%, transparent 70%);
                    pointer-events: none;
                }
                .db-district-section::after {
                    content: '';
                    position: absolute;
                    bottom: -30%; left: -10%;
                    width: 200px; height: 200px;
                    background: radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%);
                    pointer-events: none;
                }

                .db-district-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                    position: relative;
                    z-index: 1;
                }
                .db-district-icon-wrap {
                    width: 48px; height: 48px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #0891b2, #06b6d4, #22d3ee);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 16px rgba(8,145,178,0.3);
                    flex-shrink: 0;
                }
                .db-district-icon {
                    display: flex; align-items: center; justify-content: center;
                }
                .db-district-title {
                    font-size: 20px;
                    font-weight: 900;
                    color: #0f172a;
                    margin: 0 0 4px;
                    letter-spacing: -0.02em;
                    background: linear-gradient(135deg, #0f172a 40%, #0891b2);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                .db-district-subtitle {
                    font-size: 13px;
                    color: #64748b;
                    margin: 0;
                    font-weight: 500;
                }

                /* ── City selector row ────────────────────── */
                .db-selector-row {
                    display: flex; gap: 12px;
                    align-items: center;
                    position: relative;
                    z-index: 2;
                }
                .db-select-wrap {
                    position: relative; flex: 1;
                    display: flex; align-items: center; gap: 12px;
                    background: #fff; border: 2px solid #e2e8f0;
                    border-radius: 14px; padding: 0 18px; height: 52px;
                    cursor: pointer;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }
                .db-select-wrap:hover {
                    border-color: #0891b2;
                    box-shadow: 0 4px 16px rgba(8,145,178,0.12);
                }
                .db-select-pin-glow {
                    position: relative;
                    display: flex; align-items: center; justify-content: center;
                    width: 32px; height: 32px;
                    flex-shrink: 0;
                }
                @keyframes db-pulse {
                    0% { transform: scale(1); opacity: 0.4; }
                    50% { transform: scale(1.6); opacity: 0; }
                    100% { transform: scale(1); opacity: 0; }
                }
                .db-pin-pulse {
                    position: absolute;
                    width: 24px; height: 24px;
                    border-radius: 50%;
                    background: rgba(8,145,178,0.18);
                    animation: db-pulse 2s ease-in-out infinite;
                }
                .db-select-btn {
                    flex: 1; display: flex; align-items: center; justify-content: space-between;
                    background: none; border: none; outline: none; cursor: pointer;
                    font-size: 15px; font-weight: 700; color: #0f172a; font-family: inherit;
                    padding: 0;
                }

                .db-dropdown {
                    position: absolute; top: calc(100% + 8px); left: 0; right: 0;
                    background: #fff; border: 1.5px solid #e2e8f0;
                    border-radius: 16px; overflow: hidden;
                    z-index: 60;
                    box-shadow: 0 16px 48px rgba(0,0,0,.14), 0 4px 12px rgba(0,0,0,.06);
                }
                .db-dd-header {
                    display: flex; align-items: center; gap: 6px;
                    padding: 10px 16px 8px;
                    font-size: 10px; font-weight: 800;
                    color: #94a3b8; text-transform: uppercase;
                    letter-spacing: 0.08em;
                    border-bottom: 1px solid #f1f5f9;
                }
                .db-dd-item {
                    display: flex; align-items: center; gap: 10px;
                    width: 100%; text-align: left;
                    padding: 12px 16px; font-size: 14px; font-weight: 500;
                    color: #374151; background: none; border: none;
                    cursor: pointer; transition: all .15s; font-family: inherit;
                    border-left: 3px solid transparent;
                }
                .db-dd-item:hover {
                    background: #f0f9ff;
                    border-left-color: #06b6d4;
                    padding-left: 20px;
                }
                .db-dd-item.active {
                    background: linear-gradient(90deg, #e0f2fe, #f0f9ff);
                    color: #0891b2; font-weight: 700;
                    border-left-color: #0891b2;
                }
                .db-dd-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; transition: transform 0.15s; }
                .db-dd-item:hover .db-dd-dot { transform: scale(1.3); }
                .db-dd-name { flex: 1; }
                .db-dd-check {
                    font-size: 13px; font-weight: 800; color: #0891b2;
                    background: #e0f2fe; width: 22px; height: 22px;
                    border-radius: 50%; display: flex; align-items: center;
                    justify-content: center; flex-shrink: 0;
                }

                .db-fetch-btn {
                    height: 52px; padding: 0 24px;
                    background: linear-gradient(135deg, #0891b2, #06b6d4);
                    color: #fff; font-size: 14px; font-weight: 700;
                    border-radius: 14px; border: none; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                    white-space: nowrap; font-family: inherit;
                    box-shadow: 0 4px 16px rgba(6,182,212,.3);
                    position: relative;
                    overflow: hidden;
                }
                .db-fetch-btn::before {
                    content: '';
                    position: absolute; inset: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%);
                    pointer-events: none;
                }
                .db-fetch-btn.loading, .db-fetch-btn:disabled { opacity: .65; cursor: not-allowed; }
                @keyframes db-spin { to { transform: rotate(360deg); } }
                .spin { animation: db-spin .7s linear infinite; }

                /* ── Top grid (AQI + charts) ───────────── */
                .db-top-grid {
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 20px;
                    margin-bottom: 28px;
                    align-items: start;
                }

                /* AQI card */
                .db-aqi-card {
                    border: 1.5px solid; border-radius: 22px;
                    padding: 24px; position: relative; overflow: hidden;
                    display: flex; flex-direction: column; gap: 16px;
                }
                .db-overlay {
                    position: absolute; inset: 0;
                    background: rgba(255,255,255,.55);
                    display: flex; align-items: center; justify-content: center; z-index: 10;
                }
                .db-spinner {
                    width: 30px; height: 30px;
                    border: 3px solid #e2e8f0;
                    border-radius: 50%; animation: db-spin .7s linear infinite;
                }

                .db-aqi-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .db-aqi-eyebrow {
                    font-size: 10px; font-weight: 800; color: #64748b;
                    text-transform: uppercase; letter-spacing: .08em; margin-bottom: 4px;
                }
                .db-aqi-city { font-size: 22px; font-weight: 900; margin: 0; }
                .db-aqi-activity-icon {
                    width: 38px; height: 38px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                }

                .db-gauge-wrap {
                    position: relative; display: flex;
                    justify-content: center; align-items: center;
                }
                .db-gauge-center {
                    position: absolute; display: flex;
                    flex-direction: column; align-items: center;
                    padding-top: 16px;
                }
                .db-gauge-label {
                    font-size: 10px; font-weight: 700; color: #64748b;
                    text-transform: uppercase; letter-spacing: .06em; margin-bottom: 2px;
                }
                .db-gauge-num {
                    font-size: 48px; font-weight: 900; letter-spacing: -.03em; line-height: 1;
                }
                .db-gauge-unit { font-size: 12px; color: #94a3b8; font-weight: 500; }

                .db-aqi-status-row { display: flex; align-items: center; gap: 10px; justify-content: center; }
                .db-status-pill {
                    font-size: 14px; font-weight: 800;
                    padding: 5px 16px; border-radius: 999px;
                }
                .db-aqi-index { font-size: 13px; color: #64748b; font-weight: 600; }
                .db-aqi-msg {
                    font-size: 12px; color: #475569; text-align: center;
                    line-height: 1.55; margin: 0;
                    border-top: 1px solid rgba(0,0,0,.07); padding-top: 12px;
                }

                /* Charts column */
                .db-charts-col { display: flex; flex-direction: column; gap: 16px; }
                .db-chart-card {
                    background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 18px; padding: 18px 20px;
                }
                .db-chart-head {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 14px;
                }
                .db-chart-title {
                    font-size: 13px; font-weight: 800; color: #0f172a;
                    display: flex; align-items: center; gap: 7px; margin: 0;
                }
                .db-chart-dot {
                    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
                }
                .db-chart-tag {
                    font-size: 10px; font-weight: 800; color: #2563eb;
                    background: #eff6ff; border: 1px solid #bfdbfe;
                    border-radius: 999px; padding: 3px 10px;
                    text-transform: uppercase; letter-spacing: .06em;
                }
                .db-chart-empty { height: 150px; display: flex; align-items: center; justify-content: center; }
                .db-chart-skeleton {
                    width: 100%; height: 80px;
                    background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
                    background-size: 200% 100%;
                    border-radius: 8px;
                    animation: shimmer 1.5s infinite;
                }
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }

                /* ── Sections ─────────────────────────── */
                .db-section { margin-bottom: 36px; }
                .db-section-head { margin-bottom: 16px; }
                .db-section-title { font-size: 17px; font-weight: 900; color: #0f172a; margin: 0 0 4px; }
                .db-section-sub { font-size: 13px; color: #94a3b8; margin: 0; }

                /* Env grid */
                .db-env-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 14px;
                }

                /* Legend card */
                .db-legend-card {
                    background: #fff; border: 1px solid #e2e8f0;
                    border-radius: 20px; overflow: hidden;
                }
                .db-legend-grid { padding: 8px 24px; }
                .db-health-tip {
                    display: flex; align-items: center; gap: 10px;
                    flex-wrap: wrap;
                    border: 1px solid; margin: 0 16px 16px;
                    border-radius: 14px; padding: 14px 18px;
                }
                .db-health-tip-label {
                    font-size: 12px; font-weight: 700; color: #475569;
                    text-transform: uppercase; letter-spacing: .05em;
                }
                .db-health-tip-msg {
                    font-size: 13px; color: #475569; flex: 1;
                }

                /* ── Responsive ───────────────────────── */
                @media (max-width: 900px) {
                    .db-top-grid { grid-template-columns: 1fr; }
                    .db-env-grid  { grid-template-columns: repeat(2, 1fr); }
                    .db-gauge-num { font-size: 40px; }
                }
                @media (max-width: 600px) {
                    .db-container { padding: 20px 16px 60px; }
                    .db-env-grid  { grid-template-columns: 1fr; }
                    .db-hero-title { font-size: 20px; }
                }
            `}</style>
        </div>
    );
}
