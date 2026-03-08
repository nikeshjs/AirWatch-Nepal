import React from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
    Satellite,
    Cpu,
    Globe,
    Users,
    CheckCircle2,
    Mail,
    Linkedin,
    Github,
    Code2,
    Layers,
    Target,
    ArrowRight,
    Zap,
    Brain,
} from 'lucide-react';

/* ─── helpers ───────────────────────────────────────────── */
const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 24 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.55, delay, ease: 'easeOut' },
});

const Badge = ({ children }) => (
    <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 14px', borderRadius: 999,
        background: 'rgba(196,30,58,0.08)', border: '1px solid rgba(196,30,58,0.18)',
        color: '#C41E3A', fontSize: 12, fontWeight: 700,
        letterSpacing: '0.04em', textTransform: 'uppercase',
    }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C41E3A', display: 'inline-block', boxShadow: '0 0 8px rgba(196,30,58,0.4)' }} />
        {children}
    </span>
);

const Section = ({ children, style = {} }) => (
    <section style={{ marginBottom: 80, ...style }}>{children}</section>
);

const SectionHeader = ({ badge, title, sub }) => (
    <motion.div {...fadeUp(0)} style={{ textAlign: 'center', marginBottom: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Badge>{badge}</Badge>
        <h2 style={{ fontSize: 'clamp(26px,4vw,38px)', fontWeight: 900, color: '#1B4965', letterSpacing: '-0.02em', margin: 0 }}>{title}</h2>
        {sub && <p style={{ color: '#5a7d95', fontSize: 16, maxWidth: 540, margin: 0, lineHeight: 1.6 }}>{sub}</p>}
    </motion.div>
);

/* ─── main ──────────────────────────────────────────────── */
export default function AboutPage() {
    const steps = [
        {
            icon: Satellite, color: '#1B4965', bg: '#e8f0f6',
            title: 'Step 1 — Satellite Data Ingestion',
            desc: 'We pull multispectral imagery from ESA Sentinel-5P TROPOMI and NASA MODIS sensors, capturing AOD, NO₂, SO₂, CO, and NDVI readings at sub-10km resolution daily.',
        },
        {
            icon: Layers, color: '#C41E3A', bg: '#fce8eb',
            title: 'Step 2 — Feature Engineering',
            desc: 'Satellite indices are merged with WRF meteorological model outputs (wind, humidity, temperature, boundary layer height), producing a rich feature matrix per grid cell.',
        },
        {
            icon: Cpu, color: '#2D9F5C', bg: '#e6f5ed',
            title: 'Step 3 — Ensemble ML Prediction',
            desc: 'XGBoost and Random Forest models trained on ground-sensor data estimate real-time PM2.5. An LSTM network then generates 7-day temporal forecasts per city.',
        },
        {
            icon: Globe, color: '#D4842A', bg: '#fcf0e0',
            title: 'Step 4 — Spatial Interpolation',
            desc: 'Kriging and IDW fill gaps between sparse monitoring stations. Results are served as interactive maps and time-series charts at city-level granularity.',
        },
    ];

    const techs = [
        { cat: 'Frontend', items: ['React 18', 'Vite', 'Recharts', 'Framer Motion', 'TailwindCSS'] },
        { cat: 'Backend', items: ['Django','Django REST Framework', 'Python 3'] },
        { cat: 'ML / Data', items: ['TensorFlow', 'XGBoost', 'LSTM','scikit-learn', 'pandas', 'NumPy'] },
        { cat: 'Satellite', items: ['Sentinel-2','Sentinel-5P TROPOMI', 'MODIS Terra / Aqua', 'ERA5','Google Earth Engine', 'NASA EarthData'] },
    ];

    const team = [
        { name: 'Pradip Dhakal', role: 'Full-stack', initials: 'PD', type: 'fs' },
        { name: 'Nikesh Jung Shrestha', role: 'AI + Backend', initials: 'NS', type: 'ai' },
        { name: 'Shlok Pandey', role: 'AI / ML Developer', initials: 'SP', type: 'ai' },
        { name: 'Samriddhi Badal', role: 'Data + AI / ML', initials: 'SB', type: 'ai' },
    ];

    const goals = [
        { icon: Target, title: 'Accessibility', desc: 'Free, open data for every researcher and citizen across Nepal.' },
        { icon: Zap, title: 'Accuracy', desc: '80% validated model accuracy using ground-sensor comparison.' },
        { icon: CheckCircle2, title: 'Awareness', desc: 'Predictive pollution alerts so communities can take action.' },
    ];

    return (
        <div className="ab-root">

            {/* ═══ HERO ═══════════════════════════════════════════ */}
            <section className="ab-hero">
                <motion.div {...fadeUp(0)} className="ab-hero-inner">
                    <Badge>About the Project</Badge>
                    <h1 className="ab-h1">
                        Data for a <span style={{ color: '#C41E3A' }}>Cleaner Nepal</span>
                    </h1>
                    <p className="ab-lead">
                        AirWatch Nepal bridges the gap between space technology and urban environmental health —
                        providing democratic access to satellite-driven PM2.5 data across the unique Himalayan terrain.
                    </p>
                    <div className="ab-hero-actions">
                        <Link to="/dashboard" className="ab-btn-primary">
                            View Dashboard <ArrowRight size={16} />
                        </Link>
                        <Link to="/map" className="ab-btn-ghost">
                            Explore Map
                        </Link>
                    </div>
                </motion.div>

                {/* stat pills */}
                <motion.div {...fadeUp(0.15)} className="ab-stat-row">
                    {[
                        { value: '80%', label: 'Model Accuracy', color: '#16a34a' },
                        { value: '4', label: 'Cities Monitored', color: '#0891b2' },
                        { value: '24/7', label: 'Live Monitoring', color: '#ca8a04' },
                        { value: '7-Day', label: 'PM2.5 Forecast', color: '#7c3aed' },
                    ].map(s => (
                        <div key={s.label} className="ab-stat-pill">
                            <div className="ab-stat-val" style={{ color: s.color }}>{s.value}</div>
                            <div className="ab-stat-lbl">{s.label}</div>
                        </div>
                    ))}
                </motion.div>
            </section>

            <div className="ab-container">

                {/* ═══ GOALS ════════════════════════════════════════ */}
                <Section>
                    <SectionHeader badge="Our Mission" title="Why We Built This" sub="Making air quality science accessible to everyone across Nepal." />
                    <div className="ab-goals-grid">
                        {goals.map((g, i) => (
                            <motion.div key={g.title} {...fadeUp(i * 0.1)} className="ab-goal-card">
                                <div className="ab-goal-icon">
                                    <g.icon size={22} color="#C41E3A" />
                                </div>
                                <h3 className="ab-goal-title">{g.title}</h3>
                                <p className="ab-goal-desc">{g.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* ═══ METHODOLOGY ══════════════════════════════════ */}
                <Section>
                    <SectionHeader badge="Methodology" title="How It Works" sub="A four-stage pipeline from satellite sensor to your screen." />
                    <div className="ab-steps">
                        {steps.map((s, i) => (
                            <motion.div key={s.title} {...fadeUp(i * 0.08)} className="ab-step-card">
                                <div className="ab-step-icon" style={{ background: s.bg }}>
                                    <s.icon size={24} color={s.color} />
                                </div>
                                <div>
                                    <h4 className="ab-step-title">{s.title}</h4>
                                    <p className="ab-step-desc">{s.desc}</p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* ═══ TECH STACK ═══════════════════════════════════ */}
                <Section>
                    <SectionHeader badge="Technology Stack" title="Built With" sub="A modern, full-stack research platform." />
                    <div className="ab-tech-grid">
                        {techs.map((col, i) => (
                            <motion.div key={col.cat} {...fadeUp(i * 0.1)} className="ab-tech-card">
                                <h4 className="ab-tech-cat">{col.cat}</h4>
                                <div className="ab-tech-tags">
                                    {col.items.map(t => (
                                        <span key={t} className="ab-tech-tag">{t}</span>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Section>

                {/* ═══ TEAM ═════════════════════════════════════════ */}
                <Section>
                    <SectionHeader badge="Research Team" title="The People Behind It" />
                    <div className="ab-team-grid">
                        {team.map((m, i) => (
                            <motion.div key={m.name} {...fadeUp(i * 0.1)} className="ab-team-card">
                                <div className="ab-team-avatar">{m.initials}</div>
                                <h4 className="ab-team-name">{m.name}</h4>
                                <div className={`ab-team-role-tag role-${m.type}`}>
                                    {m.type === 'ai' ? <Brain size={12} /> : <Code2 size={12} />}
                                    <span>{m.role}</span>
                                </div>
                                <div className="ab-team-socials">
                                    {[Linkedin, Github, Mail].map((Icon, j) => (
                                        <a key={j} href="#" className="ab-social-btn" aria-label="social">
                                            <Icon size={15} />
                                        </a>
                                    ))}
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </Section>

            </div>

            {/* ─── FOOTER ─────────────────────── */}
            <footer className="ab-footer">
                <p>© 2026 AirWatch Nepal · Built with satellite data &amp; machine learning ·
                    <Link to="/" style={{ color: '#C41E3A', marginLeft: 6, fontWeight: 700 }}>Return Home</Link>
                </p>
            </footer>

            {/* ─── Scoped styles ──────────────── */}
            <style>{`
                .ab-root {
                    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: #F7F3EE;
                    color: #1B4965;
                    min-height: 100vh;
                }
                .ab-container {
                    max-width: 1000px;
                    margin: 0 auto;
                    padding: 0 24px;
                }

                /* Hero */
                .ab-hero {
                    background: linear-gradient(180deg, #eef4f8 0%, #F7F3EE 100%);
                    border-bottom: 1px solid #e5ddd3;
                    padding: 96px 24px 64px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 40px;
                }
                .ab-hero-inner {
                    max-width: 680px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 20px;
                }
                .ab-h1 {
                    font-size: clamp(32px, 5vw, 52px);
                    font-weight: 900;
                    letter-spacing: -0.03em;
                    color: #1B4965;
                    margin: 0;
                    line-height: 1.1;
                }
                .ab-lead {
                    color: #5a7d95;
                    font-size: 16px;
                    line-height: 1.75;
                    max-width: 560px;
                    margin: 0;
                }
                .ab-hero-actions {
                    display: flex;
                    gap: 12px;
                    flex-wrap: wrap;
                    justify-content: center;
                    margin-top: 8px;
                }
                .ab-btn-primary {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: linear-gradient(135deg, #C41E3A, #a31830); color: #fff; font-size: 14px; font-weight: 700;
                    padding: 11px 22px; border-radius: 10px; text-decoration: none;
                    transition: all 0.2s; box-shadow: 0 4px 12px rgba(196,30,58,0.2);
                }
                .ab-btn-primary:hover { background: #d42545; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(196,30,58,0.3); }
                .ab-btn-ghost {
                    display: inline-flex; align-items: center; gap: 8px;
                    background: #fff; color: #1B4965; font-size: 14px; font-weight: 600;
                    padding: 11px 22px; border-radius: 10px; text-decoration: none;
                    border: 1.5px solid #d0dce6; transition: all 0.2s;
                }
                .ab-btn-ghost:hover { border-color: #1B4965; background: #eef4f8; }

                /* stat row */
                .ab-stat-row {
                    display: flex;
                    gap: 16px;
                    flex-wrap: wrap;
                    justify-content: center;
                }
                .ab-stat-pill {
                    background: #fff;
                    border: 1px solid #ddd5cb;
                    border-radius: 14px;
                    padding: 16px 24px;
                    text-align: center;
                    min-width: 120px;
                    box-shadow: 0 2px 8px rgba(27,73,101,0.04);
                }
                .ab-stat-val { font-size: 26px; font-weight: 900; }
                .ab-stat-lbl { font-size: 11px; font-weight: 700; color: #8a9fb2; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }

                /* sections */
                section.ab-section { margin-bottom: 80px; }

                /* goals */
                .ab-goals-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .ab-goal-card {
                    background: #fff;
                    border: 1px solid #e5ddd3;
                    border-radius: 18px;
                    padding: 28px 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    transition: all 0.2s;
                }
                .ab-goal-card:hover { box-shadow: 0 8px 24px rgba(27,73,101,0.06); border-color: #ddd5cb; transform: translateY(-3px); }
                .ab-goal-icon {
                    width: 46px; height: 46px; border-radius: 12px;
                    background: #fce8eb; display: flex; align-items: center; justify-content: center;
                }
                .ab-goal-title { font-size: 16px; font-weight: 800; color: #1B4965; margin: 0; }
                .ab-goal-desc  { font-size: 13px; color: #5a7d95; line-height: 1.6; margin: 0; }

                /* steps */
                .ab-steps { display: flex; flex-direction: column; gap: 20px; }
                .ab-step-card {
                    background: #fff;
                    border: 1px solid #e5ddd3;
                    border-radius: 18px;
                    padding: 24px 28px;
                    display: flex;
                    gap: 20px;
                    align-items: flex-start;
                    transition: all 0.2s;
                }
                .ab-step-card:hover { box-shadow: 0 8px 24px rgba(27,73,101,0.06); border-color: #ddd5cb; }
                .ab-step-icon {
                    width: 52px; height: 52px; border-radius: 14px;
                    display: flex; align-items: center; justify-content: center;
                    flex-shrink: 0;
                }
                .ab-step-title { font-size: 15px; font-weight: 800; color: #1B4965; margin: 0 0 6px; }
                .ab-step-desc  { font-size: 14px; color: #5a7d95; line-height: 1.65; margin: 0; }

                /* tech */
                .ab-tech-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 20px;
                }
                .ab-tech-card {
                    background: #fff;
                    border: 1px solid #e5ddd3;
                    border-radius: 18px;
                    padding: 24px;
                }
                .ab-tech-cat {
                    font-size: 11px; font-weight: 800; color: #C41E3A;
                    text-transform: uppercase; letter-spacing: 0.1em;
                    margin: 0 0 14px;
                }
                .ab-tech-tags { display: flex; flex-wrap: wrap; gap: 8px; }
                .ab-tech-tag {
                    background: #f0ece5; color: #1B4965;
                    font-size: 12px; font-weight: 600;
                    padding: 5px 12px; border-radius: 8px;
                    border: 1px solid #ddd5cb;
                }

                /* team */
                .ab-team-grid {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                }
                .ab-team-card {
                    background: #fff;
                    border: 1px solid #e5ddd3;
                    border-radius: 20px;
                    padding: 32px 24px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 10px;
                    transition: all 0.2s;
                }
                .ab-team-card:hover { box-shadow: 0 12px 32px rgba(27,73,101,0.08); transform: translateY(-4px); }
                .ab-team-avatar {
                    width: 72px; height: 72px; border-radius: 50%;
                    background: linear-gradient(135deg, #1B4965, #4A9BBF);
                    color: #fff; font-size: 24px; font-weight: 900;
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 4px;
                    box-shadow: 0 4px 12px rgba(27,73,101,0.15);
                }
                .ab-team-name { font-size: 17px; font-weight: 800; color: #1B4965; margin: 0; }
                
                .ab-team-role-tag {
                    display: inline-flex; align-items: center; gap: 6px;
                    font-size: 11px; font-weight: 700; text-transform: uppercase;
                    letter-spacing: 0.04em; padding: 5px 14px; border-radius: 99px;
                    margin-top: 4px; border: 1px solid transparent;
                }
                .ab-team-role-tag.role-ai {
                    background: rgba(124, 58, 237, 0.08); 
                    color: #7c3aed; 
                    border-color: rgba(124, 58, 237, 0.15);
                }
                .ab-team-role-tag.role-fs {
                    background: rgba(8, 145, 178, 0.08); 
                    color: #0891b2; 
                    border-color: rgba(8, 145, 178, 0.15);
                }

                .ab-team-socials { display: flex; gap: 10px; margin-top: 6px; }
                .ab-social-btn {
                    width: 34px; height: 34px; border-radius: 9px;
                    background: #f0ece5; border: 1px solid #ddd5cb;
                    display: flex; align-items: center; justify-content: center;
                    color: #1B4965; text-decoration: none; transition: all 0.2s;
                }
                .ab-social-btn:hover { background: #fce8eb; color: #C41E3A; border-color: #f2c8cf; }

                /* footer */
                .ab-footer {
                    text-align: center;
                    padding: 32px 24px;
                    border-top: 1px solid #e5ddd3;
                    font-size: 13px;
                    color: #8a9fb2;
                    margin-top: 24px;
                }

                /* Responsive */
                @media (max-width: 768px) {
                    .ab-goals-grid  { grid-template-columns: 1fr; }
                    .ab-tech-grid   { grid-template-columns: 1fr; }
                    .ab-team-grid   { grid-template-columns: 1fr; }
                    .ab-step-card   { flex-direction: column; }
                    .ab-hero        { padding: 80px 20px 48px; }
                }
                @media (max-width: 480px) {
                    .ab-stat-row    { gap: 10px; }
                    .ab-stat-pill   { min-width: 100px; padding: 14px 16px; }
                }
            `}</style>
        </div>
    );
}
