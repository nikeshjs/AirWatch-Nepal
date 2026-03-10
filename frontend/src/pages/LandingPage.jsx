import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Satellite, Globe, Zap, ArrowUpRight, ChevronRight,
  Activity, Shield, Brain, TrendingUp, Layers, MapPin,
  Eye, CheckCircle2, BarChart3, Cpu, Wind, Github, Mail, Twitter,
} from 'lucide-react';

/* ── animated counter ── */
function useCounter(target, duration = 2000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return val;
}

const FEATURES = [
  { icon: Satellite, title: 'Satellite Data Fusion', desc: 'Multi-spectral imagery from ESA Sentinel-5P & NASA MODIS. AOD, NO₂, SO₂ at sub-10 km daily resolution.', color: '#1B4965', bg: '#e8f0f6' },
  { icon: Brain, title: 'Ensemble ML Prediction', desc: 'XGBoost + Random Forest calibrated against ground sensors, achieving around 80% PM2.5 estimation accuracy.', color: '#C41E3A', bg: '#fce8eb' },
  { icon: TrendingUp, title: '7-Day LSTM Forecast', desc: 'Deep-learning temporal model trained on 3+ years of satellite & meteorological time-series data.', color: '#2D9F5C', bg: '#e6f5ed' },
  { icon: MapPin, title: 'City-Level Insights', desc: 'Granular monitoring across Kathmandu, Pokhara, Birgunj and Chitwan', color: '#D4842A', bg: '#fcf0e0' },
  { icon: Layers, title: 'Multi-Layer Analytics', desc: 'Fuse satellite indices with WRF meteorological outputs — wind, humidity, boundary layer height.', color: '#4A9BBF', bg: '#e4f2f8' },
  { icon: Shield, title: 'Health Risk Alerts', desc: 'Real-time AQI classification with health advisories based on WHO PM2.5 thresholds.', color: '#8B5A3C', bg: '#f5ede7' },
];

const STEPS = [
  { num: 1, icon: Satellite, title: 'Satellite Ingestion', desc: 'Pull multispectral imagery daily from space-borne sensors, capturing atmospheric column data at city-grid resolution.', color: '#1B4965', bg: '#e8f0f6' },
  { num: 2, icon: Layers, title: 'Feature Engineering', desc: 'Merge satellite indices with WRF meteorological model outputs to produce a rich feature matrix per city.', color: '#C41E3A', bg: '#fce8eb' },
  { num: 3, icon: Cpu, title: 'ML Inference', desc: 'Ensemble models estimate current PM2.5; LSTM network extends the forecast 7 days forward.', color: '#2D9F5C', bg: '#e6f5ed' },
  { num: 4, icon: BarChart3, title: 'Delivery & Insights', desc: 'Results published via REST API to an interactive dashboard with maps, charts and health alerts.', color: '#D4842A', bg: '#fcf0e0' },
];

/* ── Trusted by ticker cities ── */
const CITIES = ['Kathmandu', 'Pokhara', 'Birgunj', 'Chitwan'];

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const stat1 = useCounter(80);
  const stat2 = useCounter(4);
  const [cityIdx, setCityIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCityIdx(i => (i + 1) % CITIES.length), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="lp-root">

      {/* ══ NAVBAR ══ */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <Link to="/" className="lp-logo">
            <div className="lp-logo-icon"><Globe size={15} color="#0891b2" /></div>
            AirWatch <span className="lp-logo-acc">Nepal</span>
          </Link>
          <nav className="lp-nav-links">
            {[['Home', '/'], ['About', '/about'], ['Dashboard', '/dashboard'], ['Forecast', '/forecast'], ['Map View', '/map']].map(([n, p]) => (
              <Link key={n} to={p} className="lp-nav-link">{n}</Link>
            ))}
          </nav>
          <Link to="/dashboard" className="lp-cta-btn"><Zap size={13} />View Dashboard</Link>
          <button className="lp-burger" onClick={() => setMobileOpen(v => !v)} aria-label="menu">
            <span /><span /><span />
          </button>
        </div>
        <AnimatePresence>
          {mobileOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="lp-mob-menu">
              {[['Home', '/'], ['About', '/about'], ['Dashboard', '/dashboard'], ['Forecast', '/forecast'], ['Map View', '/map']].map(([n, p]) => (
                <Link key={n} to={p} className="lp-mob-link" onClick={() => setMobileOpen(false)}>{n}</Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ══ HERO ══ */}
      <section className="lp-hero">
        <div className="lp-hero-bg">
          <div className="lp-bg-blob1" />
          <div className="lp-bg-blob2" />
          <div className="lp-bg-dots" />
          <div className="lp-bg-grid" />
        </div>

        <div className="lp-hero-inner">
          {/* ── LEFT ── */}
          <div className="lp-hero-copy">
            <motion.div className="lp-badge"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <span className="lp-badge-dot" />
              Satellite-Powered · AI-Driven · Real-Time
            </motion.div>

            <motion.h1 className="lp-h1"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease: [0.25, 1, 0.5, 1] }}
            >
              Monitor Air Quality<br />
              <span className="lp-h1-acc">Across Nepal</span><br />
              from Space
            </motion.h1>

            <motion.p className="lp-lead"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Ensemble machine learning meets satellite remote sensing to deliver
              precision PM2.5 estimates &amp; 7-day forecasts — powered by Ensemble &amp; LSTM neural networks.
            </motion.p>

            <motion.div className="lp-actions"
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.7 }}
            >
              <Link to="/dashboard" className="lp-btn-primary">
                <Zap size={15} />View Live Dashboard<ArrowUpRight size={14} />
              </Link>
              <Link to="/about" className="lp-btn-ghost">
                How It Works<ChevronRight size={14} />
              </Link>
            </motion.div>

            {/* Live city ticker */}
            <motion.div className="lp-city-ticker"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.9 }}
            >
              <span className="lp-ticker-label">Currently monitoring:</span>
              <AnimatePresence mode="wait">
                <motion.span key={cityIdx} className="lp-ticker-city"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35 }}
                >
                  <MapPin size={12} /> {CITIES[cityIdx]}
                </motion.span>
              </AnimatePresence>
            </motion.div>

            <motion.div className="lp-stats"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 1.0 }}
            >
              {[
                { val: `${stat1}%`, label: 'Model Accuracy', color: '#16a34a' },
                { val: `${stat2}`, label: 'Cities Monitored', color: '#0891b2' },
                { val: '24/7', label: 'Live Monitoring', color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} className="lp-stat">
                  <div className="lp-stat-val" style={{ color: s.color }}>{s.val}</div>
                  <div className="lp-stat-lbl">{s.label}</div>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── RIGHT: SATELLITE ── */}
          <motion.div className="lp-sat-wrap"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.25, 1, 0.5, 1] }}
          >
            <div className="lp-sat-glow" />

            <div className="lp-sat-stage">
              <div className="lp-ring lp-ring1" />
              <div className="lp-ring lp-ring2" />
              <div className="lp-ring lp-ring3" />

              <div className="lp-globe">
                <div className="lp-globe-shine" />
                <div className="lp-globe-land" />
                <div className="lp-globe-atmo" />
              </div>

              <div className="lp-orbit lp-orbit-a">
                <div className="lp-sat lp-sat-a">
                  <Satellite size={22} color="#0891b2" strokeWidth={1.5} />
                  <div className="lp-sat-beam" />
                  <div className="lp-sat-panel lp-panel-l" />
                  <div className="lp-sat-panel lp-panel-r" />
                </div>
              </div>
              <div className="lp-orbit lp-orbit-b">
                <div className="lp-sat lp-sat-b">
                  <Satellite size={13} color="#7c3aed" strokeWidth={1.5} />
                </div>
              </div>

              {/* Data chips */}
              <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="lp-chip lp-chip1">
                <span className="lp-chip-dot" style={{ background: '#16a34a' }} />
                <span>PM2.5</span>
                <strong style={{ color: '#16a34a' }}>58.2 µg/m³</strong>
              </motion.div>

              <motion.div animate={{ y: [0, 7, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }} className="lp-chip lp-chip2">
                <span className="lp-chip-dot" style={{ background: '#0891b2' }} />
                <span>AOD 550nm</span>
                <strong style={{ color: '#0891b2' }}>0.34</strong>
              </motion.div>

              <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="lp-chip lp-chip3">
                <span className="lp-chip-dot" style={{ background: '#7c3aed' }} />
                <span>NO₂ Tropomi</span>
                <strong style={{ color: '#7c3aed' }}>12.1 µmol</strong>
              </motion.div>
            </div>

            <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} className="lp-acc-chip">
              <Activity size={12} color="#0891b2" />
              <span>LSTM + XGBoost ensemble · 80% accuracy</span>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ══ TRUSTED BY STRIP ══ */}
      <section className="lp-trust-strip">
        <div className="lp-container">
          <span className="lp-trust-label">Monitoring cities across Nepal</span>
          <div className="lp-trust-cities">
            {CITIES.map(c => (
              <span key={c} className="lp-trust-city"><MapPin size={11} />{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FEATURES ══ */}
      <section className="lp-section">
        <div className="lp-container">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="lp-sec-hd">
            <span className="lp-eyebrow"><Eye size={11} />Key Capabilities</span>
            <h2 className="lp-h2">Built for Precision<br />&amp; <span className="lp-h2-acc">Scale</span></h2>
            <p className="lp-sec-sub">A full-stack environmental intelligence platform combining space data, meteorology and deep learning.</p>
          </motion.div>
          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title}
                initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(27,73,101,0.1)' }}
                className="lp-feat-card"
              >
                <div className="lp-feat-icon" style={{ background: f.bg, border: `1px solid ${f.color}30` }}>
                  <f.icon size={21} color={f.color} />
                </div>
                <h3 className="lp-feat-title">{f.title}</h3>
                <p className="lp-feat-desc">{f.desc}</p>
                <span className="lp-feat-link" style={{ color: f.color }}>Learn more <ChevronRight size={12} /></span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ HOW IT WORKS ══ */}
      <section className="lp-section lp-alt">
        <div className="lp-container">
          <div className="lp-hiw-grid">
            <div>
              <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} style={{ marginBottom: 44 }}>
                <span className="lp-eyebrow"><Layers size={11} />Data Pipeline</span>
                <h2 className="lp-h2" style={{ fontSize: 'clamp(26px,3vw,38px)', marginTop: 10, textAlign: 'left' }}>
                  From Orbit to<br /><span className="lp-h2-acc">Your Screen</span>
                </h2>
              </motion.div>
              <div className="lp-steps">
                {STEPS.map((s, i) => (
                  <motion.div key={s.num} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="lp-step">
                    <div className="lp-step-left">
                      <div className="lp-step-icon" style={{ background: s.bg, border: `2px solid ${s.color}44` }}>
                        <s.icon size={18} color={s.color} />
                      </div>
                      {i < STEPS.length - 1 && <div className="lp-step-line" />}
                    </div>
                    <div className="lp-step-body">
                      <p className="lp-step-num" style={{ color: s.color }}>Step {s.num}</p>
                      <h4 className="lp-step-title">{s.title}</h4>
                      <p className="lp-step-desc">{s.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="lp-code-panel">
              <div className="lp-code-hdr">
                <div className="lp-traffic"><span /><span /><span /></div>
                <span className="lp-code-name">model_output.json</span>
              </div>
              <div className="lp-code-body">
                <pre className="lp-code">{`{
  "city": "Kathmandu",
  "timestamp": "2026-02-20T08:30Z",
  "pm25_current": 58.2,
  "aqi": 153,
  "status": "Unhealthy",
  "confidence": 0.942,
  "forecast_7d": [
    {"day":1,"pm25":55.1},
    {"day":2,"pm25":49.8},
    {"day":3,"pm25":43.2},
    {"day":4,"pm25":51.7},
    {"day":5,"pm25":60.4},
    {"day":6,"pm25":57.9},
    {"day":7,"pm25":48.3}
  ],
  "features_used": [
    "AOD_550nm","NO2_tropomi",
    "SO2_tropomi","NDVI",
    "wind_speed","temperature"
  ]
}`}</pre>
              </div>
              <div className="lp-mini-chart">
                {[55.1, 49.8, 43.2, 51.7, 60.4, 57.9, 48.3].map((v, i) => (
                  <motion.div key={i}
                    initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    style={{
                      flex: 1, borderRadius: '4px 4px 0 0', transformOrigin: 'bottom',
                      height: `${(v / 70) * 80}%`, opacity: 0.85,
                      background: v > 55.4 ? '#f42415' : v > 35.4 ? '#eefa04' : '#22c55e',
                    }}
                  />
                ))}
              </div>
              <p className="lp-mini-lbl">7-Day PM2.5 Forecast · µg/m³</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══ STATS ══ */}
      <section className="lp-section">
        <div className="lp-container">
          <div className="lp-stats-grid">
            {[
              { val: '80%', label: 'Model Accuracy', sub: 'vs. ground sensors', color: '#2D9F5C', border: '#d4edde' },
              { val: '4', label: 'Cities Monitored', sub: 'across Nepal', color: '#1B4965', border: '#c8dae8' },
              { val: '7-Day', label: 'PM2.5 Forecast', sub: 'LSTM time-series model', color: '#C41E3A', border: '#f2c8cf' },
              { val: '24/7', label: 'Live Monitoring', sub: 'automated pipeline', color: '#D4842A', border: '#f2dfc8' },
            ].map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
                whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(27,73,101,0.12)' }}
                className="lp-stat-card" style={{ border: `1px solid ${s.border}` }}
              >
                <div className="lp-sc-val" style={{ color: s.color }}>{s.val}</div>
                <div className="lp-sc-lbl">{s.label}</div>
                <div className="lp-sc-sub">{s.sub}</div>
                <div className="lp-sc-bar" style={{ background: `linear-gradient(90deg,${s.color},transparent)` }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ CTA ══ */}
      <section className="lp-cta-section">
        <div className="lp-container">
          <motion.div initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="lp-cta-card">
            <div className="lp-cta-blob1" /><div className="lp-cta-blob2" />
            <div className="lp-cta-inner">
              <span className="lp-eyebrow" style={{ justifyContent: 'center' }}><CheckCircle2 size={11} />Ready to Explore?</span>
              <h2 className="lp-cta-h">
                Real Air Quality Data,<br />
                <span style={{ color: '#C41E3A' }}>Powered by Space Science</span>
              </h2>
              <p className="lp-cta-p">Explore live PM2.5 levels, 7-day forecasts and satellite-derived atmospheric parameters for every major city in Nepal.</p>
              <div className="lp-cta-btns">
                <Link to="/dashboard" className="lp-btn-primary" style={{ fontSize: 15, padding: '13px 28px' }}><Zap size={16} />Launch Dashboard</Link>
                <Link to="/map" className="lp-btn-ghost" style={{ fontSize: 15, padding: '12px 22px' }}>Explore Map<ChevronRight size={15} /></Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══ FOOTER ══ */}
      <footer className="lp-footer">
        <div className="lp-container">
          <div className="lp-footer-top">
            <div>
              <Link to="/" className="lp-logo" style={{ display: 'inline-flex', marginBottom: 10 }}>
                <div className="lp-logo-icon"><Globe size={14} color="#0891b2" /></div>
                AirWatch <span className="lp-logo-acc">Nepal</span>
              </Link>
              <p className="lp-footer-sub">Satellite-based air quality monitoring &amp; prediction for a healthier Nepal.</p>
              <div className="lp-socials">
                {[[Github, '#'], [Twitter, '#'], [Mail, '#']].map(([Icon, href], i) => (
                  <a key={i} href={href} className="lp-social"><Icon size={14} /></a>
                ))}
              </div>
            </div>
            <div className="lp-footer-cols">
              <div>
                <p className="lp-fhd">Platform</p>
                {[['Dashboard', '/dashboard'], ['Forecast', '/forecast'], ['Map View', '/map']].map(([n, p]) => (
                  <Link key={n} to={p} className="lp-flink">{n}</Link>
                ))}
              </div>
              <div>
                <p className="lp-fhd">Project</p>
                {[['About', '/about'], ['Methodology', '/about'], ['Research', '#']].map(([n, p]) => (
                  <Link key={n} to={p} className="lp-flink">{n}</Link>
                ))}
              </div>
            </div>
          </div>
          <div className="lp-footer-bottom">© 2026 AirWatch Nepal · Satellite PM2.5 Monitoring &amp; Forecasting System</div>
        </div>
      </footer>

      {/* ══ STYLES ══ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .lp-root {
          font-family: 'Outfit', -apple-system, sans-serif;
          background: #F7F3EE; color: #1B4965; min-height: 100vh; overflow-x: hidden;
        }

        /* ── NAV ── */
        .lp-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          background: rgba(247,243,238,0.92); backdrop-filter: blur(18px);
          border-bottom: 1px solid #e5ddd3; box-shadow: 0 1px 16px rgba(27,73,101,0.06);
        }
        .lp-nav-inner {
          max-width: 1280px; margin: 0 auto; padding: 0 32px; height: 68px;
          display: grid; grid-template-columns: auto 1fr auto;
          align-items: center; gap: 24px;
        }
        .lp-logo {
          display: flex; align-items: center; gap: 9px;
          font-size: 17px; font-weight: 900; color: #229fec;
          text-decoration: none; flex-shrink: 0; letter-spacing: -0.02em;
          transition: opacity 0.2s;
        }
        .lp-logo:hover { opacity: 0.82; }
        .lp-logo-icon {
          width: 32px; height: 32px; border-radius: 9px;
          background: linear-gradient(135deg, #e8f0f6, #d0e2ef);
          border: 1px solid #b8d0e2;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 2px 8px rgba(27,73,101,0.15);
        }
        .lp-logo-acc { color: #C41E3A; }
        .lp-nav-links { display: flex; align-items: center; justify-content: center; gap: 4px; }
        .lp-nav-link {
          position: relative; padding: 7px 15px; border-radius: 8px;
          font-size: 13.5px; font-weight: 600; color: #5a7d95;
          text-decoration: none; transition: color 0.22s;
        }
        .lp-nav-link::after {
          content: ''; position: absolute; left: 15px; right: 15px;
          bottom: 3px; height: 2px; border-radius: 99px;
          background: #C41E3A; transform: scaleX(0); transform-origin: center;
          transition: transform 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.25s; opacity: 0;
        }
        .lp-nav-link:hover { color: #1B4965; }
        .lp-nav-link:hover::after { transform: scaleX(1); opacity: 1; }
        .lp-cta-btn {
          display: flex; align-items: center; gap: 7px; flex-shrink: 0;
          background: linear-gradient(135deg, #C41E3A 0%, #a31830 100%);
          color: #fff; font-size: 13px; font-weight: 700;
          padding: 10px 20px; border-radius: 11px; text-decoration: none;
          transition: all 0.25s; white-space: nowrap;
          box-shadow: 0 2px 12px rgba(196,30,58,0.2); border: 1px solid transparent;
        }
        .lp-cta-btn:hover { background: #d42545; transform: translateY(-2px); box-shadow: 0 6px 24px rgba(196,30,58,0.3); }
        .lp-burger { display:none; flex-direction:column; gap:5px; background:none; border:none; cursor:pointer; padding:6px; }
        .lp-burger span { width:22px; height:2px; background:#5a7d95; border-radius:2px; display:block; }
        .lp-mob-menu { overflow:hidden; background:#F7F3EE; border-top:1px solid #e5ddd3; padding:8px 20px 16px; }
        .lp-mob-link {
          display:flex; align-items:center; padding:13px 10px;
          font-size:15px; font-weight:600; color:#3d6480;
          text-decoration:none; border-bottom:1px solid #ede7df;
          transition: color 0.2s, padding-left 0.2s;
        }
        .lp-mob-link:hover { color:#C41E3A; padding-left:18px; }

        /* ── HERO ── */
        .lp-hero {
          min-height: 100vh; position: relative; overflow: hidden;
          display: flex; align-items: center; padding-top: 64px;
          background: linear-gradient(160deg, #eef4f8 0%, #F7F3EE 40%, #f0ece5 70%, #e8f0f6 100%);
        }
        .lp-hero-bg { position: absolute; inset: 0; pointer-events: none; }
        .lp-bg-blob1 {
          position: absolute; width: 800px; height: 800px; top: -250px; right: -200px;
          border-radius: 50%; background: radial-gradient(circle, rgba(27,73,101,0.07) 0%, transparent 65%);
          animation: lp-breathe 16s ease-in-out infinite alternate;
        }
        .lp-bg-blob2 {
          position: absolute; width: 600px; height: 600px; bottom: -200px; left: -180px;
          border-radius: 50%; background: radial-gradient(circle, rgba(196,30,58,0.05) 0%, transparent 65%);
          animation: lp-breathe 20s ease-in-out infinite alternate-reverse;
        }
        .lp-bg-dots {
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, #c8bfb3 1px, transparent 1px);
          background-size: 30px 30px; opacity: 0.35;
          mask-image: radial-gradient(ellipse 85% 85% at 50% 50%, black 20%, transparent 100%);
        }
        .lp-bg-grid {
          position: absolute; inset: 0;
          background-image: linear-gradient(rgba(27,73,101,0.04) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(27,73,101,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .lp-hero-inner {
          max-width: 1200px; margin: 0 auto; width: 100%;
          padding: 80px 24px 100px;
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 60px; align-items: center; position: relative; z-index: 2;
        }

        /* Left copy */
        .lp-hero-copy { display: flex; flex-direction: column; gap: 20px; }
        .lp-badge {
          display: inline-flex; align-items: center; gap: 8px;
          font-size: 10.5px; font-weight: 800; color: #C41E3A;
          background: rgba(196,30,58,0.08); border: 1px solid rgba(196,30,58,0.18);
          border-radius: 999px; padding: 6px 16px;
          letter-spacing: 0.08em; text-transform: uppercase; width: fit-content;
        }
        .lp-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #C41E3A; box-shadow: 0 0 8px rgba(196,30,58,0.5);
          animation: lp-pulse 1.6s ease-in-out infinite;
        }
        .lp-h1 {
          font-size: clamp(36px,4.5vw,62px); font-weight: 900;
          line-height: 1.07; letter-spacing: -0.03em; color: #1B4965; margin: 0;
        }
        .lp-h1-acc { color: #C41E3A; }
        .lp-lead { font-size: 15.5px; color: #5a7d95; line-height: 1.8; max-width: 460px; margin: 0; }
        .lp-actions { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
        .lp-btn-primary {
          display: inline-flex; align-items: center; gap: 7px;
          background: linear-gradient(135deg, #C41E3A, #a31830); color: #fff; font-size: 13px; font-weight: 700;
          padding: 12px 20px; border-radius: 12px; text-decoration: none;
          transition: all 0.22s; font-family: inherit;
        }
        .lp-btn-primary:hover { background: linear-gradient(135deg, #d42545, #C41E3A); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(196,30,58,0.25); }
        .lp-btn-ghost {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fff; color: #1B4965; font-size: 13px; font-weight: 600;
          padding: 12px 18px; border-radius: 12px; text-decoration: none;
          border: 1.5px solid #d0dce6; transition: all 0.2s;
        }
        .lp-btn-ghost:hover { border-color: #1B4965; background: #eef4f8; }

        /* City ticker */
        .lp-city-ticker {
          display: flex; align-items: center; gap: 10px;
          font-size: 12px; color: #8a9fb2;
        }
        .lp-ticker-label { font-weight: 600; }
        .lp-ticker-city {
          display: inline-flex; align-items: center; gap: 4px;
          font-weight: 800; color: #C41E3A;
          background: rgba(196,30,58,0.08); border-radius: 6px;
          padding: 4px 10px;
        }

        .lp-stats {
          display: flex; gap: 28px; padding-top: 14px;
          border-top: 1px solid #ddd5cb; flex-wrap: wrap;
        }
        .lp-stat-val { font-size: 30px; font-weight: 900; letter-spacing: -0.02em; line-height: 1; }
        .lp-stat-lbl { font-size: 10.5px; color: #8a9fb2; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; margin-top: 4px; }

        /* ── SATELLITE STAGE ── */
        .lp-sat-wrap { display: flex; flex-direction: column; align-items: center; gap: 20px; position: relative; margin-top: -60px; }
        .lp-sat-glow {
          position: absolute; width: 520px; height: 520px;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(27,73,101,0.12) 0%, transparent 70%);
          filter: blur(20px);
          animation: lp-glow-pulse 4s ease-in-out infinite alternate;
        }
        .lp-sat-stage { width: 520px; height: 520px; position: relative; }
        .lp-globe {
          position: absolute; width: 220px; height: 220px;
          top: 50%; left: 50%; transform: translate(-50%,-50%);
          border-radius: 50%; overflow: hidden;
          background: radial-gradient(circle at 33% 30%, #e0f2fe, #0ea5e9 50%, #1d4ed8 100%);
          box-shadow: inset -14px -14px 30px rgba(0,0,0,0.2), 0 0 50px rgba(14,165,233,0.25), 0 0 100px rgba(14,165,233,0.1);
          z-index: 3;
        }
        .lp-globe-shine { position: absolute; top: 12%; left: 14%; width: 28%; height: 18%; background: rgba(255,255,255,0.4); border-radius: 50%; filter: blur(6px); }
        .lp-globe-land {
          position: absolute; inset: 0;
          background: url('https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/2004_world_borders.png/800px-2004_world_borders.png') center/cover;
          opacity: 0.18; animation: lp-globespin 50s linear infinite;
        }
        .lp-globe-atmo {
          position: absolute; inset: -10px; border-radius: 50%; z-index: 4;
          background: radial-gradient(circle at 50% 50%, transparent 55%, rgba(14,165,233,0.15) 70%, rgba(56,189,248,0.05) 85%, transparent);
          pointer-events: none;
        }
        .lp-ring { position: absolute; top: 50%; left: 50%; border-radius: 50%; border: 1px solid rgba(8,145,178,0.18); }
        .lp-ring1 { width:300px;height:300px; margin:-150px 0 0 -150px; transform:rotateX(72deg); border-color:rgba(8,145,178,0.28); }
        .lp-ring2 { width:420px;height:420px; margin:-210px 0 0 -210px; transform:rotateX(75deg) rotateZ(28deg); border-color:rgba(124,58,237,0.14); }
        .lp-ring3 { width:510px;height:510px; margin:-255px 0 0 -255px; transform:rotateX(78deg) rotateZ(-18deg); border-color:rgba(14,165,233,0.08); }
        .lp-orbit { position:absolute; top:50%; left:50%; transform-origin:0 0; }
        .lp-orbit-a { animation: lp-orb 12s linear infinite; }
        .lp-orbit-b { animation: lp-orb 20s linear infinite reverse; }
        .lp-sat { position: absolute; display: flex; align-items: center; justify-content: center; border-radius: 10px; }
        .lp-sat-a {
          width: 44px; height: 44px; top: -150px; left: -22px;
          background: rgba(8,145,178,0.15); border: 1px solid rgba(8,145,178,0.35);
          backdrop-filter: blur(4px); box-shadow: 0 0 20px rgba(8,145,178,0.3);
        }
        .lp-sat-b { width: 26px; height: 26px; top: -210px; left: -13px; background: rgba(124,58,237,0.12); border: 1px solid rgba(124,58,237,0.3); }
        .lp-sat-panel { position: absolute; top: 50%; width: 18px; height: 8px; background: linear-gradient(135deg, #bae6fd, #0ea5e9); border-radius: 2px; transform: translateY(-50%); opacity: 0.85; }
        .lp-panel-l { right: 100%; margin-right: 2px; }
        .lp-panel-r { left: 100%; margin-left: 2px; }
        .lp-sat-beam {
          position: absolute; bottom: -50px; left: 50%; transform: translateX(-50%);
          width: 34px; height: 50px;
          background: linear-gradient(180deg, rgba(8,145,178,0.45), transparent);
          clip-path: polygon(50% 0, 0 100%, 100% 100%);
          animation: lp-beam 2.2s ease-in-out infinite alternate;
        }
        .lp-chip {
          position: absolute; display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.92); backdrop-filter: blur(12px);
          border: 1px solid #ddd5cb; border-radius: 999px;
          padding: 7px 14px; font-size: 11px; font-weight: 600; color: #3d6480;
          box-shadow: 0 4px 20px rgba(27,73,101,0.08); white-space: nowrap; z-index: 10;
          transition: box-shadow 0.3s, transform 0.3s;
        }
        .lp-chip:hover { box-shadow: 0 8px 32px rgba(27,73,101,0.12); transform: scale(1.04); }
        .lp-chip-dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
        .lp-chip1 { top: 5%; right: -20px; }
        .lp-chip2 { top: 50%; left: -40px; transform: translateY(-50%); }
        .lp-chip3 { bottom: 8%; right: -30px; }
        .lp-acc-chip {
          display: flex; align-items: center; gap: 7px;
          background: #fff; border: 1px solid #ddd5cb; border-radius: 999px;
          padding: 7px 16px; font-size: 11px; font-weight: 600; color: #5a7d95;
          box-shadow: 0 2px 12px rgba(27,73,101,0.06);
        }

        /* ── TRUST STRIP ── */
        .lp-trust-strip {
          background: #fff; border-top: 1px solid #e5ddd3; border-bottom: 1px solid #e5ddd3;
          padding: 20px 0;
        }
        .lp-trust-strip .lp-container { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
        .lp-trust-label { font-size: 11px; font-weight: 700; color: #8a9fb2; text-transform: uppercase; letter-spacing: 0.1em; white-space: nowrap; }
        .lp-trust-cities { display: flex; gap: 8px; flex-wrap: wrap; }
        .lp-trust-city {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; color: #3d6480;
          background: #f0ece5; border: 1px solid #ddd5cb;
          border-radius: 8px; padding: 5px 12px;
          transition: all 0.2s;
        }
        .lp-trust-city:hover { background: #e8f0f6; color: #1B4965; border-color: #b8d0e2; }

        /* ── FEATURES ── */
        .lp-section { padding: 90px 0; }
        .lp-alt { background: #fff; }
        .lp-container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
        .lp-sec-hd { text-align:center; margin-bottom:56px; display:flex; flex-direction:column; align-items:center; gap:14px; }
        .lp-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 800; color: #C41E3A;
          text-transform: uppercase; letter-spacing: 0.14em;
        }
        .lp-h2 { font-size:clamp(26px,3.5vw,44px); font-weight:900; color:#1B4965; letter-spacing:-0.025em; margin:0; line-height:1.1; text-align:center; }
        .lp-h2-acc { color: #C41E3A; }
        .lp-sec-sub { font-size:15px; color:#5a7d95; max-width:490px; line-height:1.65; margin:0; }
        .lp-feat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:18px; }
        .lp-feat-card {
          background: #fff; border: 1px solid #e5ddd3; border-radius: 20px;
          padding: 28px 24px; display: flex; flex-direction: column; gap: 14px;
          transition: all 0.28s; cursor: default;
        }
        .lp-feat-card:hover { border-color: #c8bfb3; }
        .lp-feat-icon { width:50px; height:50px; border-radius:14px; display:flex; align-items:center; justify-content:center; }
        .lp-feat-title { font-size:15px; font-weight:800; color:#1B4965; margin:0; }
        .lp-feat-desc { font-size:13px; color:#5a7d95; line-height:1.65; margin:0; }
        .lp-feat-link {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 12px; font-weight: 700; margin-top: auto;
          opacity: 0; transform: translateX(-6px);
          transition: opacity 0.25s, transform 0.25s;
        }
        .lp-feat-card:hover .lp-feat-link { opacity: 1; transform: translateX(0); }

        /* ── HOW IT WORKS ── */
        .lp-hiw-grid { display:grid; grid-template-columns:1fr 420px; gap:72px; align-items:flex-start; }
        .lp-steps { display:flex; flex-direction:column; gap:28px; }
        .lp-step { display:flex; gap:20px; align-items:flex-start; }
        .lp-step-left { flex-shrink:0; display:flex; flex-direction:column; align-items:center; }
        .lp-step-icon { width:50px; height:50px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
        .lp-step-line { width:1px; height:40px; background:linear-gradient(to bottom,#ddd5cb,transparent); margin-top:6px; }
        .lp-step-body { padding-top:8px; }
        .lp-step-num { font-size:10px; font-weight:800; text-transform:uppercase; letter-spacing:0.14em; margin:0 0 4px; }
        .lp-step-title { font-size:16px; font-weight:800; color:#1B4965; margin:0 0 5px; }
        .lp-step-desc { font-size:13px; color:#5a7d95; line-height:1.6; margin:0; }
        .lp-code-panel { background:#1B4965; border:1px solid #2a5d7e; border-radius:20px; overflow:hidden; position:sticky; top:88px; box-shadow:0 8px 32px rgba(27,73,101,0.2); }
        .lp-code-hdr { display:flex; align-items:center; gap:8px; padding:12px 16px; border-bottom:1px solid #2a5d7e; background:rgba(15,50,72,0.5); }
        .lp-traffic { display:flex; gap:5px; }
        .lp-traffic span { width:10px; height:10px; border-radius:50%; }
        .lp-traffic span:nth-child(1){background:#f42415}
        .lp-traffic span:nth-child(2){background:#eefa04}
        .lp-traffic span:nth-child(3){background:#22c55e}
        .lp-code-name { font-size:11px; color:#8ab0c8; font-weight:600; }
        .lp-code-body { padding:16px; overflow-x:auto; }
        .lp-code { font-family:'Courier New',monospace; font-size:11px; line-height:1.65; color:#7ec8e8; margin:0; white-space:pre; }
        .lp-mini-chart { display:flex; align-items:flex-end; gap:4px; height:70px; padding:0 16px; }
        .lp-mini-lbl { font-size:10px; color:#8ab0c8; text-align:center; padding:6px 0 14px; margin:0; font-weight:600; }

        /* ── STATS ── */
        .lp-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .lp-stat-card { background:#fff; border-radius:20px; padding:32px 24px; text-align:center; transition:all 0.25s; cursor:default; }
        .lp-sc-val { font-size:clamp(36px,4vw,52px); font-weight:900; letter-spacing:-0.03em; line-height:1.1; margin-bottom:8px; }
        .lp-sc-lbl { font-size:14px; font-weight:800; color:#1B4965; margin-bottom:4px; }
        .lp-sc-sub { font-size:12px; color:#8a9fb2; }
        .lp-sc-bar { height:3px; border-radius:99px; margin-top:18px; }

        /* ── CTA ── */
        .lp-cta-section { padding:80px 0; }
        .lp-cta-card {
          background:linear-gradient(135deg,#eef4f8,#fce8eb); border:1.5px solid #ddd5cb;
          border-radius:28px; padding:72px 48px; text-align:center;
          position:relative; overflow:hidden; box-shadow:0 8px 48px rgba(27,73,101,0.08);
        }
        .lp-cta-blob1 { position:absolute;width:480px;height:480px;top:-200px;right:-100px;border-radius:50%;background:radial-gradient(circle,rgba(27,73,101,0.06),transparent 70%);pointer-events:none; }
        .lp-cta-blob2 { position:absolute;width:400px;height:400px;bottom:-180px;left:-100px;border-radius:50%;background:radial-gradient(circle,rgba(196,30,58,0.05),transparent 70%);pointer-events:none; }
        .lp-cta-inner { position:relative;z-index:2;display:flex;flex-direction:column;align-items:center;gap:16px; }
        .lp-cta-h { font-size:clamp(26px,4vw,46px);font-weight:900;color:#1B4965;margin:0;letter-spacing:-0.025em;line-height:1.1; }
        .lp-cta-p { font-size:15px;color:#5a7d95;line-height:1.65;max-width:480px;margin:0; }
        .lp-cta-btns { display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:8px; }

        /* ── FOOTER ── */
        .lp-footer { background:#1B4965; border-top:1px solid #2a5d7e; padding-top:56px; }
        .lp-footer-top { display:flex; justify-content:space-between; gap:48px; padding-bottom:48px; flex-wrap:wrap; }
        .lp-footer-sub { font-size:13px;color:#8ab0c8;line-height:1.65;max-width:240px;margin:8px 0 0; }
        .lp-socials { display:flex;gap:8px;margin-top:16px; }
        .lp-social { width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;color:#8ab0c8;text-decoration:none;transition:all 0.2s; }
        .lp-social:hover { background:rgba(196,30,58,0.15);color:#fff;border-color:rgba(196,30,58,0.3); }
        .lp-footer-cols { display:flex;gap:56px; }
        .lp-fhd { font-size:11px;font-weight:800;color:#8ab0c8;text-transform:uppercase;letter-spacing:0.12em;margin:0 0 14px; }
        .lp-flink { display:block;font-size:14px;color:#b0d0e4;text-decoration:none;margin-bottom:10px;transition:color 0.15s; }
        .lp-flink:hover { color:#fff; }
        .lp-footer-bottom { border-top:1px solid #2a5d7e;padding:18px 24px;text-align:center;font-size:12px;color:#6a9ab8; }

        /* ── KEYFRAMES ── */
        @keyframes lp-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes lp-globespin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lp-orb { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes lp-beam { from{opacity:0.2;height:44px} to{opacity:0.55;height:60px} }
        @keyframes lp-breathe {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1.1); opacity: 0.8; }
        }
        @keyframes lp-glow-pulse {
          0% { opacity: 0.7; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 1; transform: translate(-50%,-50%) scale(1.08); }
        }

        /* ── RESPONSIVE ── */
        @media(max-width:1024px){
          .lp-hero-inner { grid-template-columns:1fr; }
          .lp-hero-copy { align-items:center; text-align:center; }
          .lp-lead { max-width:100%; }
          .lp-stats { justify-content:center; }
          .lp-actions { justify-content:center; }
          .lp-city-ticker { justify-content:center; }
          .lp-hiw-grid { grid-template-columns:1fr; }
          .lp-feat-grid { grid-template-columns:repeat(2,1fr); }
          .lp-stats-grid { grid-template-columns:repeat(2,1fr); }
          .lp-code-panel { position:static; }
          .lp-sat-wrap { margin: 0 auto; }
        }
        @media(max-width:768px){
          .lp-nav-links,.lp-cta-btn { display:none; }
          .lp-burger { display:flex; }
          .lp-feat-grid { grid-template-columns:1fr; }
          .lp-cta-card { padding:44px 20px; }
          .lp-section { padding:64px 0; }
          .lp-sat-stage { width:300px;height:300px; }
          .lp-chip { display:none; }
        }
        @media(max-width:540px){
          .lp-stats-grid { grid-template-columns:1fr 1fr; }
          .lp-footer-cols { flex-direction:column;gap:28px; }
        }
      `}</style>
    </div>
  );
}
