import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { ActiveRoute } from './types';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext';
import { TRANSLATIONS } from './i18n/translations';
import { StorefrontView } from './components/StorefrontView';
import { ProductDetailView } from './components/ProductDetailView';
import { BuyerLibraryView } from './components/BuyerLibraryView';
import { MerchantDashboardView } from './components/MerchantDashboardView';
import { AdminPanelView } from './components/AdminPanelView';
import { LegalPagesView } from './components/LegalPagesView';
import { DeploymentGuideView } from './components/DeploymentGuideView';
import { AuthModal } from './components/AuthModal';
import { CheckoutModal } from './components/CheckoutModal';

function ShaheenShell() {
  const { lang, currentUser, isSupabaseMode } = useMarketplace();
  const t = TRANSLATIONS[lang];

  const [route, setRoute] = useState<ActiveRoute>({ page: 'home' });
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [checkoutProductId, setCheckoutProductId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Automatically open role picker if user signed up and hasn't chosen Buyer vs Merchant yet
  useEffect(() => {
    if (currentUser && !currentUser.roleSelected) {
      setAuthModalOpen(true);
    }
  }, [currentUser]);

  const navigate = (next: ActiveRoute) => {
    setRoute(next);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090E1A] text-slate-100">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090E1A]/95 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigate({ page: 'home' })}
            className="flex items-center gap-2.5 font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <svg viewBox="0 0 32 32" className="h-6 w-6 shrink-0" aria-hidden="true">
              <path
                d="M16 3 L20 9 L30 11 L24 16 L27 20 L20 21 L16 29 L12 21 L5 20 L8 16 L2 11 L12 9 Z"
                fill="#D4A843"
              />
              <polygon points="16,11 19,16 16,22 13,16" fill="#2563EB" />
            </svg>
            <span>{t.brand}</span>
          </button>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigate({ page: 'home' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                route.page === 'home' ? 'text-white underline underline-offset-8 decoration-blue-500' : ''
              }`}
            >
              {t.nav.discover}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'library' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                route.page === 'library' ? 'text-white underline underline-offset-8 decoration-blue-500' : ''
              }`}
            >
              {t.nav.library}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'wishlist' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                route.page === 'wishlist' ? 'text-white underline underline-offset-8 decoration-blue-500' : ''
              }`}
            >
              {t.nav.wishlist}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'merchant' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                route.page === 'merchant' ? 'text-white underline underline-offset-8 decoration-blue-500' : ''
              }`}
            >
              {t.nav.merchant}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'admin' })}
              className={`whitespace-nowrap shrink-0 transition-colors hover:text-white ${
                route.page === 'admin' ? 'text-white underline underline-offset-8 decoration-blue-500' : ''
              }`}
            >
              {t.nav.admin}
            </button>
          </nav>

          {/* Zone 3: 1 Primary Action Button (+ mobile menu trigger) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 max-w-[160px] truncate"
            >
              {currentUser ? currentUser.displayName : t.nav.signIn}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              className="md:hidden rounded-lg border border-slate-800 p-2 text-slate-300"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-[#0C1426] px-4 py-3 flex flex-wrap gap-3 text-xs font-medium text-slate-300">
            <button type="button" onClick={() => navigate({ page: 'home' })}>
              {t.nav.discover}
            </button>
            <button type="button" onClick={() => navigate({ page: 'library' })}>
              {t.nav.library}
            </button>
            <button type="button" onClick={() => navigate({ page: 'wishlist' })}>
              {t.nav.wishlist}
            </button>
            <button type="button" onClick={() => navigate({ page: 'merchant' })}>
              {t.nav.merchant}
            </button>
            <button type="button" onClick={() => navigate({ page: 'admin' })}>
              {t.nav.admin}
            </button>
          </div>
        )}
      </header>

      {/* Main Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {!isSupabaseMode && route.page === 'home' && (
          <div className="mb-6 rounded-xl border border-slate-800 bg-[#111827] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
            <span>
              {lang === 'ar'
                ? 'وضع المعاينة التفاعلي نشط (للتشغيل الفعلي على Supabase أضف مفاتيح المشروع في .env).'
                : 'Interactive Preview Sandbox active — configure VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY to connect your live Supabase backend.'}
            </span>
            <button
              type="button"
              onClick={() => navigate({ page: 'deploy-guide' })}
              className="text-amber-400 font-semibold hover:underline whitespace-nowrap"
            >
              {t.footer.deployChecklist}
            </button>
          </div>
        )}

        {route.page === 'home' && (
          <StorefrontView
            onNavigate={navigate}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.page === 'product' && (
          <ProductDetailView
            productId={route.productId}
            onNavigate={navigate}
            onStartCheckout={(pid) => setCheckoutProductId(pid)}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}
        {route.page === 'library' && (
          <BuyerLibraryView mode="library" onNavigate={navigate} />
        )}
        {route.page === 'wishlist' && (
          <BuyerLibraryView mode="wishlist" onNavigate={navigate} />
        )}
        {route.page === 'merchant' && <MerchantDashboardView />}
        {route.page === 'admin' && <AdminPanelView />}
        {route.page === 'legal' && (
          <LegalPagesView doc={route.doc} onNavigate={navigate} />
        )}
        {route.page === 'deploy-guide' && (
          <DeploymentGuideView onNavigate={navigate} />
        )}
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-slate-800/80 bg-[#090E1A] py-8 mt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs text-slate-400">
          <div className="space-y-1">
            <p className="font-semibold text-slate-200">{t.brand}</p>
            <p>{t.footer.rights}</p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <button
              type="button"
              onClick={() => navigate({ page: 'legal', doc: 'terms' })}
              className="hover:text-white transition-colors"
            >
              {t.footer.terms}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'legal', doc: 'privacy' })}
              className="hover:text-white transition-colors"
            >
              {t.footer.privacy}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'legal', doc: 'refund' })}
              className="hover:text-white transition-colors"
            >
              {t.footer.refund}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'legal', doc: 'contact' })}
              className="hover:text-white transition-colors"
            >
              {t.footer.contact}
            </button>
            <button
              type="button"
              onClick={() => navigate({ page: 'deploy-guide' })}
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              {t.footer.deployChecklist}
            </button>
          </div>
        </div>
      </footer>

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      <CheckoutModal
        productId={checkoutProductId}
        onClose={() => setCheckoutProductId(null)}
        onGoToLibrary={() => navigate({ page: 'library' })}
      />
    </div>
  );
}

export default function App() {
  return (
    <MarketplaceProvider>
      <ShaheenShell />
    </MarketplaceProvider>
  );
}
