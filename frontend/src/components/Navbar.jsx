import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
    Globe,
    Satellite,
    Menu,
    X,
    Rocket,
    Home,
    LayoutDashboard,
    AreaChart,
    Map as MapIcon,
    Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [lang, setLang] = useState('EN');

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Home', path: '/', icon: Home },
        { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
        { name: 'Forecast', path: '/forecast', icon: AreaChart },
        { name: 'Map View', path: '/map', icon: MapIcon },
        { name: 'About', path: '/about', icon: Info },
    ];

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${isScrolled ? 'py-2' : 'py-4 md:py-6'
            }`}>
            <div className="max-w-[1400px] mx-auto px-4 md:px-6">
                <div className={`glass px-4 md:px-8 py-3 rounded-full flex items-center justify-between transition-all duration-500 ${isScrolled ? 'shadow-2xl border-opacity-30' : 'bg-opacity-10 border-opacity-10'
                    }`}>
                    {/* Logo */}
                    <NavLink to="/" className="flex items-center gap-3 group shrink-0">
                        <div className="relative flex items-center justify-center">
                            <Globe className="w-6 h-6 md:w-8 md:h-8 text-primary group-hover:rotate-45 transition-transform duration-700" />
                            <Satellite className="w-3 h-3 md:w-4 md:h-4 text-secondary absolute -top-1 -right-1 animate-pulse" />
                        </div>
                        <div className="flex flex-col leading-none">
                            <span className="text-lg md:text-xl font-black tracking-tighter">NEPAL<span className="text-primary">AQ</span></span>
                            <span className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-bold text-text-muted">Satellite Insights</span>
                        </div>
                    </NavLink>

                    {/* Desktop Links */}
                    <div className="hidden lg:flex items-center gap-2 xl:gap-6 bg-glass/30 px-6 py-2 rounded-full border border-glass-border">
                        {navLinks.map((link) => (
                            <NavLink
                                key={link.name}
                                to={link.path}
                                className={({ isActive }) => `
                                    text-xs xl:text-sm font-bold transition-all flex items-center gap-2 px-3 py-1.5 rounded-full
                                    ${isActive ? 'text-primary bg-primary/10' : 'text-text-muted hover:text-white hover:bg-glass'}
                                `}
                            >
                                <link.icon className="w-4 h-4" />
                                <span className="hidden xl:inline">{link.name}</span>
                            </NavLink>
                        ))}
                    </div>

                    {/* Actions */}
                    <div className="hidden lg:flex items-center gap-4">
                        <button
                            onClick={() => setLang(lang === 'EN' ? 'NP' : 'EN')}
                            className="w-10 h-10 flex items-center justify-center text-xs font-black border border-glass-border rounded-full hover:bg-glass hover:border-primary transition-all"
                        >
                            {lang}
                        </button>
                        <NavLink
                            to="/dashboard"
                            className="primary-gradient px-6 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105 transition-all whitespace-nowrap"
                        >
                            <Rocket className="w-4 h-4" />
                            Launch Dashboard
                        </NavLink>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="lg:hidden p-2 text-text hover:bg-glass rounded-full transition-colors"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                    </button>
                </div>
            </div>

            {/* Mobile Menu */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="absolute top-full left-0 right-0 mt-4 px-4 lg:hidden"
                    >
                        <div className="glass rounded-[32px] p-6 flex flex-col gap-3 shadow-2xl border border-glass-border">
                            {navLinks.map((link) => (
                                <NavLink
                                    key={link.name}
                                    to={link.path}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className={({ isActive }) => `
                                        text-lg font-bold flex items-center gap-4 p-4 rounded-2xl transition-all
                                        ${isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'hover:bg-glass'}
                                    `}
                                >
                                    <link.icon className="w-6 h-6" />
                                    {link.name}
                                </NavLink>
                            ))}
                            <div className="h-px bg-glass-border my-2" />
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setLang(lang === 'EN' ? 'NP' : 'EN')}
                                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-glass font-bold"
                                >
                                    <Globe className="w-5 h-5 text-primary" />
                                    {lang === 'EN' ? 'EN' : 'नेपाली'}
                                </button>
                                <NavLink
                                    to="/dashboard"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="primary-gradient p-4 rounded-2xl text-center font-bold flex items-center justify-center gap-2"
                                >
                                    <Rocket className="w-5 h-5" />
                                    Dashboard
                                </NavLink>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </nav>
    );
};

export default Navbar;
