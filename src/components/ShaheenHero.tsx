import type { FormEvent } from 'react';
import { Search, Code2, Smartphone, Terminal, Layers, Shield, ArrowRight } from 'lucide-react';
import type { Language } from '../types';
import { TRANSLATIONS } from '../i18n/translations';

interface ShaheenHeroProps {
  lang: Language;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onStartSelling: () => void;
  onOpenDeployGuide: () => void;
}

export function ShaheenHero({
  lang,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onStartSelling,
  onOpenDeployGuide,
}: ShaheenHeroProps) {
  const t = TRANSLATIONS[lang].hero;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSearchSubmit();
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-[#0C1426]">
      {/* Animated SVG Circuit Grid & Atmospheric Glow (No external image required) */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-55"
        viewBox="0 0 1200 460"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="shaheen-navy-glow" cx="76%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.28" />
            <stop offset="55%" stopColor="#D4A843" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#090E1A" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="shaheen-gold-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#F5D061" />
            <stop offset="50%" stopColor="#D4A843" />
            <stop offset="100%" stopColor="#9A721E" />
          </linearGradient>
          <linearGradient id="circuit-line" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#D4A843" stopOpacity="0.25" />
          </linearGradient>
          <pattern id="circuit-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path
              d="M 64 0 L 0 0 0 64"
              fill="none"
              stroke="rgba(59, 130, 246, 0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="1200" height="460" fill="url(#circuit-grid)" />
        <rect width="1200" height="460" fill="url(#shaheen-navy-glow)" />

        {/* Subtle animated circuit paths */}
        <g className="animate-shaheen-circuit" fill="none" stroke="url(#circuit-line)" strokeWidth="1.25">
          <path d="M 40 90 H 260 L 300 130 H 520" />
          <path d="M 90 360 H 320 L 365 315 H 640" />
          <path d="M 740 70 H 950 L 990 110 H 1160" />
          <path d="M 780 390 H 980 L 1030 340 H 1170" />
          <circle cx="520" cy="130" r="3" fill="#3B82F6" />
          <circle cx="640" cy="315" r="3" fill="#D4A843" />
          <circle cx="740" cy="70" r="3" fill="#3B82F6" />
          <circle cx="780" cy="390" r="3" fill="#D4A843" />
        </g>
      </svg>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 items-center gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:px-12">
        {/* Left/Start Content Column */}
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium tracking-wider uppercase text-amber-400">
            {t.eyebrow}
          </p>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold leading-[1.12] tracking-tight text-white max-w-2xl">
            <span className="text-amber-400">{TRANSLATIONS[lang].brand}</span>
            <span className="block mt-1.5 text-slate-100 text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold">
              {t.title}
            </span>
          </h1>

          <p className="text-sm sm:text-base leading-relaxed text-slate-300 max-w-xl">
            {t.subtitle}
          </p>

          {/* Integrated Search Bar */}
          <form onSubmit={handleSubmit} className="max-w-xl">
            <div className="flex items-center rounded-xl border border-slate-700/80 bg-[#090E1A]/90 p-1.5 focus-within:border-blue-500 transition-colors">
              <Search className="mx-3 h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                className="w-full bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                {t.searchButton}
              </button>
            </div>
          </form>

          {/* Actions Row */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onStartSelling}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
            >
              <span>{t.startSelling}</span>
              <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
            </button>
            <button
              type="button"
              onClick={onOpenDeployGuide}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-900/70 px-4 py-2.5 text-xs font-medium text-slate-300 hover:border-slate-600 hover:text-white transition-colors whitespace-nowrap"
            >
              <Shield className="h-3.5 w-3.5 text-blue-400" />
              <span>{t.deployGuide}</span>
            </button>
          </div>
        </div>

        {/* Right/End Visual Column: Stylized Golden Shaheen Falcon Silhouette + Floating Vector Icons */}
        <div className="lg:col-span-5 relative flex items-center justify-center min-h-[260px] sm:min-h-[300px]">
          {/* Subtle Orbital Ring */}
          <div className="relative flex items-center justify-center w-64 h-64 sm:w-72 sm:h-72 rounded-full border border-blue-500/20 bg-[#090E1A]/60">
            <div className="absolute inset-4 rounded-full border border-amber-500/20" />

            {/* Stylized Golden Falcon (Shaheen) SVG */}
            <svg
              viewBox="0 0 240 240"
              className="w-48 h-48 sm:w-56 sm:h-56 animate-shaheen-wing drop-shadow-[0_12px_28px_rgba(212,168,67,0.22)]"
              role="img"
              aria-label="Shaheen Store Golden Falcon Emblem"
            >
              <defs>
                <linearGradient id="falcon-wing-gold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FDE68A" />
                  <stop offset="45%" stopColor="#D4A843" />
                  <stop offset="100%" stopColor="#926A18" />
                </linearGradient>
                <linearGradient id="falcon-electric-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="100%" stopColor="#1D4ED8" />
                </linearGradient>
              </defs>

              {/* Swept geometric falcon wings & crest */}
              <path
                d="M120 26 L138 56 L214 68 L178 100 L198 122 L152 132 L134 196 L120 214 L106 196 L88 132 L42 122 L62 100 L26 68 L102 56 Z"
                fill="url(#falcon-wing-gold)"
              />
              {/* Inner electric-blue armor facets */}
              <path
                d="M120 44 L132 68 L182 78 L156 102 L140 164 L120 186 L100 164 L84 102 L58 78 L108 68 Z"
                fill="#0D1528"
                stroke="url(#falcon-electric-blue)"
                strokeWidth="2"
              />
              {/* Falcon head & sharp beak profile */}
              <path
                d="M120 52 C129 52 135 58 135 66 C135 72 130 76 125 80 L132 88 L120 96 L108 88 L115 80 C110 76 105 72 105 66 C105 58 111 52 120 52 Z"
                fill="url(#falcon-wing-gold)"
              />
              {/* Eye focus */}
              <circle cx="125" cy="65" r="2.2" fill="#090E1A" />
              <circle cx="115" cy="65" r="2.2" fill="#090E1A" />
              {/* Center core diamond */}
              <polygon points="120,108 132,128 120,148 108,128" fill="url(#falcon-electric-blue)" />
            </svg>

            {/* Floating Vector App, Code & Tool Icons (Compositor transform only) */}
            <div className="animate-shaheen-float absolute -top-2 left-4 rounded-xl border border-blue-500/30 bg-[#111827]/95 p-2.5 text-blue-400">
              <Code2 className="h-5 w-5" />
            </div>
            <div className="animate-shaheen-float-slow absolute top-6 -right-3 rounded-xl border border-amber-500/30 bg-[#111827]/95 p-2.5 text-amber-400">
              <Smartphone className="h-5 w-5" />
            </div>
            <div className="animate-shaheen-float-slow absolute bottom-4 -left-3 rounded-xl border border-amber-500/30 bg-[#111827]/95 p-2.5 text-amber-400">
              <Terminal className="h-5 w-5" />
            </div>
            <div className="animate-shaheen-float absolute -bottom-2 right-6 rounded-xl border border-blue-500/30 bg-[#111827]/95 p-2.5 text-blue-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
