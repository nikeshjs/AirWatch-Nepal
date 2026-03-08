/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: '#22c55e',
                    dark: '#16a34a',
                },
                secondary: '#3b82f6',
                accent: '#8b5cf6',
                background: '#0f172a',
                surface: 'rgba(30, 41, 59, 0.7)',
                glass: 'rgba(255, 255, 255, 0.05)',
                'glass-border': 'rgba(255, 255, 255, 0.1)',
                'text-muted': '#94a3b8',
            },
            fontFamily: {
                sans: ['Outfit', 'sans-serif'],
            },
            animation: {
                'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite',
            },
            backdropBlur: {
                xs: '2px',
            }
        },
    },
    plugins: [],
}
