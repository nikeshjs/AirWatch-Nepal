import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, NavLink } from 'react-router-dom';
import Navbar from './components/Navbar';

// Lazy load pages for better performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MapViewPage = lazy(() => import('./pages/MapViewPage'));
const ForecastPage = lazy(() => import('./pages/ForecastPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));

// Loading state component
const PageLoader = () => (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e2e8f0', borderTop: '3px solid #06b6d4', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
);

// Full light navbar for dashboard/inner pages
const LightTopBar = () => {
    const { pathname } = useLocation();
    const [scrolled, setScrolled] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const fn = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', fn);
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const links = [
        { label: 'Home', to: '/' },
        { label: 'About', to: '/about' },
        { label: 'Dashboard', to: '/dashboard' },
        { label: 'Forecast', to: '/forecast' },
        { label: 'Map View', to: '/map' },
    ];

    return (
        <>
            <header style={{
                position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
                background: scrolled ? 'rgba(248,250,252,0.98)' : 'rgba(248,250,252,0.95)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid #e2e8f0',
                height: 64,
                display: 'flex', alignItems: 'center',
                boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.06)' : 'none',
                transition: 'box-shadow 0.3s',
            }}>
                <div style={{ maxWidth: 1280, margin: '0 auto', width: '100%', padding: '0 32px', display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 24 }}>
                    {/* Logo */}
                    <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#0f172a', fontWeight: 900, fontSize: 17, flexShrink: 0, letterSpacing: '-0.02em', transition: 'opacity 0.2s' }}
                        onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
                        onMouseOut={e => e.currentTarget.style.opacity = '1'}
                    >
                        <span style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#e0f2fe,#bae6fd)', border: '1px solid #a5f3fc', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(8,145,178,0.2)' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                        </span>
                        AirWatch <span style={{ color: '#0891b2' }}>Nepal</span>
                    </NavLink>

                    {/* Desktop nav links — CENTERED */}
                    <nav style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }} className="ltb-desktop-nav">
                        {links.map(({ label, to }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className="ltb-link"
                                style={({ isActive }) => ({
                                    position: 'relative',
                                    padding: '7px 15px', borderRadius: 8,
                                    fontSize: 13.5, fontWeight: isActive ? 700 : 600,
                                    color: isActive ? '#0891b2' : '#475569',
                                    textDecoration: 'none',
                                    transition: 'color 0.22s',
                                    letterSpacing: '0.01em',
                                })}
                            >
                                {({ isActive }) => (
                                    <>
                                        {label}
                                        <span style={{
                                            position: 'absolute', left: 15, right: 15, bottom: 3,
                                            height: 2, borderRadius: 99, background: '#0891b2',
                                            display: 'block',
                                            transform: isActive ? 'scaleX(1)' : 'scaleX(0)',
                                            transformOrigin: 'center',
                                            transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
                                            opacity: isActive ? 1 : 0,
                                        }} className="ltb-underline" />
                                    </>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    {/* CTA */}
                    <NavLink
                        to="/dashboard"
                        style={{
                            padding: '10px 20px', borderRadius: 11,
                            background: 'linear-gradient(135deg,#0f172a,#1e3a5f)',
                            color: '#fff', fontSize: 13, fontWeight: 700,
                            textDecoration: 'none', flexShrink: 0,
                            transition: 'all 0.25s', display: 'flex', alignItems: 'center', gap: 6,
                            boxShadow: '0 2px 12px rgba(8,145,178,0.2)', border: '1px solid transparent',
                            whiteSpace: 'nowrap',
                        }}
                        onMouseOver={e => { e.currentTarget.style.background = '#0891b2'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(8,145,178,0.35)'; }}
                        onMouseOut={e => { e.currentTarget.style.background = 'linear-gradient(135deg,#0f172a,#1e3a5f)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(8,145,178,0.2)'; }}
                    >
                        ⚡ View Dashboard
                    </NavLink>

                    {/* Mobile hamburger */}
                    <button
                        onClick={() => setMobileOpen(v => !v)}
                        className="ltb-hamburger"
                        style={{ display: 'none', flexDirection: 'column', gap: 5, background: 'none', border: 'none', cursor: 'pointer', padding: 4, marginLeft: 12 }}
                        aria-label="Toggle menu"
                    >
                        <span style={{ width: 22, height: 2, background: '#0f172a', borderRadius: 4, display: 'block' }} />
                        <span style={{ width: 22, height: 2, background: '#0f172a', borderRadius: 4, display: 'block' }} />
                        <span style={{ width: 22, height: 2, background: '#0f172a', borderRadius: 4, display: 'block' }} />
                    </button>
                </div>
            </header>

            {/* Mobile Menu */}
            {mobileOpen && (
                <div style={{
                    position: 'fixed', top: 64, left: 0, right: 0, zIndex: 99,
                    background: '#fff', borderBottom: '1px solid #e2e8f0',
                    padding: '12px 24px 20px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                }}>
                    {links.map(({ label, to }) => (
                        <NavLink
                            key={to}
                            to={to}
                            onClick={() => setMobileOpen(false)}
                            style={({ isActive }) => ({
                                display: 'block', padding: '10px 0',
                                fontSize: 15, fontWeight: isActive ? 700 : 500,
                                color: isActive ? '#0891b2' : '#374151',
                                textDecoration: 'none',
                                borderBottom: '1px solid #f1f5f9',
                            })}
                        >
                            {label}
                        </NavLink>
                    ))}
                </div>
            )}

            <style>{`
                .ltb-link:hover { color: #0f172a !important; }
                .ltb-link:hover .ltb-underline { transform: scaleX(1) !important; opacity: 1 !important; }
                @media (max-width: 768px) {
                    .ltb-desktop-nav { display: none !important; }
                    .ltb-cta { display: none !important; }
                    .ltb-hamburger { display: flex !important; }
                }
            `}</style>
        </>
    );
};

// Inner layout component – knows the current route
function Layout() {
    const { pathname } = useLocation();

    // Normalize pathname (strip trailing slashes and lowercase)
    const normalizedPath = (pathname === '/' ? '/' : pathname.replace(/\/$/, '')).toLowerCase();

    console.log('Detected Path:', normalizedPath);

    // Landing page has its own built-in navbar, so don't render LightTopBar for it
    const isLanding = normalizedPath === '/';

    // Inner pages use the light top bar
    const isInnerLight = ['/dashboard', '/about', '/forecast', '/map'].includes(normalizedPath);

    // Dark pages (none currently, but kept for extensibility)
    const isDark = !isLanding && !isInnerLight;

    return (
        <div className={
            isDark
                ? 'min-h-screen bg-[#020617] text-white'
                : 'min-h-screen bg-[#f0f4f8]'
        }>
            {isInnerLight && <LightTopBar />}
            {isDark && <Navbar />}
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/map" element={<MapViewPage />} />
                    <Route path="/forecast" element={<ForecastPage />} />
                    <Route path="/about" element={<AboutPage />} />
                    {/* Fallback */}
                    <Route path="*" element={<LandingPage />} />
                </Routes>
            </Suspense>
        </div>
    );
}

function App() {
    return (
        <Router>
            <Layout />
        </Router>
    );
}

export default App;
