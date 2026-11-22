import { useMemo, useState } from 'react';
import { Globe, Heart, Star, ArrowUpDown } from 'lucide-react';
import type { ActiveRoute, Product, ProductCategory } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatBytes, formatCents } from '../lib/sanitize';
import { ShaheenHero } from './ShaheenHero';
import { ProductImage } from './ProductImage';

interface StorefrontViewProps {
  onNavigate: (route: ActiveRoute) => void;
  onOpenAuth: () => void;
}

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

export function StorefrontView({ onNavigate, onOpenAuth }: StorefrontViewProps) {
  const { lang, setLang, products, wishlistIds, toggleWishlist, currentUser } = useMarketplace();
  const t = TRANSLATIONS[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | ProductCategory>('all');
  const [sortBy, setSortBy] = useState<SortKey>('popular');

  const approvedProducts = useMemo(
    () => products.filter((p) => p.status === 'approved'),
    [products]
  );

  const featuredProducts = useMemo(
    () => approvedProducts.filter((p) => p.featured).slice(0, 3),
    [approvedProducts]
  );

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = approvedProducts.filter((p) => {
      if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.titleAr.toLowerCase().includes(q) ||
        p.shortTagline.toLowerCase().includes(q) ||
        p.merchantName.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q)
      );
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'popular') return b.salesCount - a.salesCount;
      if (sortBy === 'newest')
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sortBy === 'price_asc') return a.priceCents - b.priceCents;
      return b.priceCents - a.priceCents;
    });
  }, [approvedProducts, searchQuery, selectedCategory, sortBy]);

  const topSellers = useMemo(
    () => [...approvedProducts].sort((a, b) => b.salesCount - a.salesCount).slice(0, 4),
    [approvedProducts]
  );

  const categoryTabs: Array<{ id: 'all' | ProductCategory; label: string }> = [
    { id: 'all', label: t.categories.all },
    { id: 'software', label: t.categories.software },
    { id: 'apk', label: t.categories.apk },
    { id: 'tools', label: t.categories.tools },
    { id: 'scripts', label: t.categories.scripts },
    { id: 'assets', label: t.categories.assets },
  ];

  const getProductTitle = (p: Product) => (lang === 'ar' && p.titleAr ? p.titleAr : p.title);
  const getProductTagline = (p: Product) =>
    lang === 'ar' && p.shortTaglineAr ? p.shortTaglineAr : p.shortTagline;

  return (
    <div className="space-y-12">
      {/* Storefront Utility Bar: Language Switcher (EN/AR RTL) + Wishlist Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>{t.categories.software}</span>
          <span aria-hidden="true">·</span>
          <span>{t.categories.apk}</span>
          <span aria-hidden="true">·</span>
          <span>{t.categories.scripts}</span>
          <span aria-hidden="true">·</span>
          <span>{t.categories.assets}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'wishlist' })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-[#111827] px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-slate-700 transition-colors whitespace-nowrap shrink-0"
          >
            <Heart className="h-3.5 w-3.5 text-amber-400" />
            <span>{t.nav.wishlist}</span>
            <span className="font-mono text-slate-400">({wishlistIds.length})</span>
          </button>

          <div className="inline-flex items-center rounded-lg border border-slate-800 bg-[#111827] p-0.5">
            <Globe className="h-3.5 w-3.5 text-slate-400 mx-2 shrink-0" />
            <button
              type="button"
              onClick={() => setLang('en')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                lang === 'en' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLang('ar')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                lang === 'ar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              العربية
            </button>
          </div>
        </div>
      </div>

      {/* Animated SVG/CSS Falcon Hero Banner */}
      <ShaheenHero
        lang={lang}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={() => {
          document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onStartSelling={() => {
          if (currentUser?.role === 'merchant' || currentUser?.role === 'admin') {
            onNavigate({ page: 'merchant' });
          } else {
            onOpenAuth();
          }
        }}
        onOpenDeployGuide={() => onNavigate({ page: 'deploy-guide' })}
      />

      {/* Section 1: Featured Steam-Style Showcase */}
      {featuredProducts.length > 0 && !searchQuery && selectedCategory === 'all' && (
        <section className="space-y-5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              {t.store.featuredTitle}
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {featuredProducts.length} / {approvedProducts.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredProducts.map((product) => {
              const saved = wishlistIds.includes(product.id);
              return (
                <article
                  key={product.id}
                  className="group flex flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-[#111827] hover:border-blue-500/60 hover:-translate-y-0.5 transition-all duration-150"
                >
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'product', productId: product.id })}
                    className="relative aspect-[4/3] w-full overflow-hidden bg-[#090E1A] text-start"
                  >
                    <ProductImage
                      src={product.screenshots[0]}
                      alt={getProductTitle(product)}
                      category={product.category}
                      className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </button>

                  <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
                    <div className="space-y-2">
                      {/* Zero-pill clean inline metadata */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="uppercase tracking-wider text-amber-400 font-medium">
                          {t.categories[product.category]}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">v{product.version}</span>
                        <span aria-hidden="true">·</span>
                        <span>{product.platform}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => onNavigate({ page: 'product', productId: product.id })}
                        className="block text-start"
                      >
                        <h3 className="font-display text-base font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                          {getProductTitle(product)}
                        </h3>
                      </button>

                      <p className="text-xs leading-relaxed text-slate-400 line-clamp-2">
                        {getProductTagline(product)}
                      </p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="inline-flex items-center gap-1 text-amber-400 font-mono tabular-nums">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          {product.ratingAvg.toFixed(1)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {product.salesCount} {t.store.sales}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleWishlist(product.id)}
                          aria-label={t.product.addWishlist}
                          className={`rounded-lg p-1.5 border transition-colors ${
                            saved
                              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                              : 'border-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${saved ? 'fill-amber-400' : ''}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate({ page: 'product', productId: product.id })}
                          className="font-mono text-sm font-semibold tabular-nums text-white bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {formatCents(product.priceCents)}
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Section 2: Interactive Category Filter + Full Storefront Catalog */}
      <section id="catalog-section" className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-[#111827] p-1">
            {categoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort catalog"
              className="rounded-lg border border-slate-800 bg-[#111827] px-3 py-2 text-xs font-medium text-slate-200 focus:border-blue-500 focus:outline-none"
            >
              <option value="popular">{t.store.sortPopular}</option>
              <option value="newest">{t.store.sortNewest}</option>
              <option value="price_asc">{t.store.sortPriceLow}</option>
              <option value="price_desc">{t.store.sortPriceHigh}</option>
            </select>
          </div>
        </div>

        {filteredCatalog.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 text-center space-y-3">
            <p className="text-sm text-slate-300">{t.store.noResults}</p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              {t.store.resetFilters}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCatalog.map((product) => (
              <article
                key={product.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-800/90 bg-[#111827] hover:border-blue-500/60 hover:-translate-y-0.5 transition-all duration-150"
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'product', productId: product.id })}
                  className="aspect-[4/3] w-full overflow-hidden bg-[#090E1A]"
                >
                  <ProductImage
                    src={product.screenshots[0]}
                    alt={getProductTitle(product)}
                    category={product.category}
                    className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </button>
                <div className="flex flex-1 flex-col justify-between p-5 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="uppercase tracking-wider text-blue-400 font-medium">
                        {t.categories[product.category]}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{formatBytes(product.fileSizeBytes)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{product.platform}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'product', productId: product.id })}
                      className="text-start block"
                    >
                      <h3 className="font-display text-base font-semibold text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                        {getProductTitle(product)}
                      </h3>
                    </button>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {getProductTagline(product)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-800/80 pt-3">
                    <span className="text-xs text-slate-400 truncate max-w-[60%]">
                      {t.store.byMerchant} {product.merchantName}
                    </span>
                    <button
                      type="button"
                      onClick={() => onNavigate({ page: 'product', productId: product.id })}
                      className="font-mono text-sm font-semibold tabular-nums text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      {formatCents(product.priceCents)}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 3: Top Sellers Compact List */}
      <section className="space-y-4 border-t border-slate-800/80 pt-8">
        <h2 className="font-display text-xl font-bold text-white">{t.store.topSellersTitle}</h2>
        <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800/90 bg-[#111827]">
          {topSellers.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate({ page: 'product', productId: item.id })}
              className="w-full flex items-center justify-between gap-4 px-5 py-3.5 text-start hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="font-mono text-xs text-slate-500 tabular-nums w-6 shrink-0">
                  0{idx + 1}.
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {getProductTitle(item)}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {item.merchantName} · {item.platform} · v{item.version}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <span className="hidden sm:inline font-mono text-xs text-slate-400 tabular-nums">
                  {item.salesCount} {t.store.sales}
                </span>
                <span className="font-mono text-sm font-semibold text-amber-400 tabular-nums">
                  {formatCents(item.priceCents)}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
