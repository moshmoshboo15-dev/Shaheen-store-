import { useState } from 'react';
import { Download, ShieldCheck, Heart, ExternalLink } from 'lucide-react';
import type { ActiveRoute } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatBytes, formatCents } from '../lib/sanitize';
import { ProductImage } from './ProductImage';

interface BuyerLibraryViewProps {
  mode: 'library' | 'wishlist';
  onNavigate: (route: ActiveRoute) => void;
}

export function BuyerLibraryView({ mode, onNavigate }: BuyerLibraryViewProps) {
  const {
    lang,
    currentUser,
    products,
    orders,
    wishlistIds,
    toggleWishlist,
    generateDownloadLink,
  } = useMarketplace();

  const t = TRANSLATIONS[lang];
  const [downloadMsg, setDownloadMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (mode === 'wishlist') {
    const savedProducts = products.filter((p) => wishlistIds.includes(p.id));
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{t.wishlist.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{t.wishlist.subtitle}</p>
        </div>

        {savedProducts.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-sm text-slate-400">
            {t.wishlist.empty}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {savedProducts.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-slate-800 bg-[#111827] overflow-hidden flex flex-col justify-between"
              >
                <button
                  type="button"
                  onClick={() => onNavigate({ page: 'product', productId: p.id })}
                  className="aspect-[4/3] w-full bg-[#090E1A]"
                >
                  <ProductImage
                    src={p.screenshots[0]}
                    alt={p.title}
                    category={p.category}
                    className="h-full w-full"
                  />
                </button>
                <div className="p-4 space-y-3">
                  <p className="font-display text-sm font-semibold text-white truncate">{p.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-amber-400">
                      {formatCents(p.priceCents)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleWishlist(p.id)}
                        className="rounded-lg border border-slate-700 p-1.5 text-amber-400 hover:bg-slate-800"
                      >
                        <Heart className="h-3.5 w-3.5 fill-amber-400" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate({ page: 'product', productId: p.id })}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t.product.buyNow}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const myOrders = currentUser ? orders.filter((o) => o.buyerId === currentUser.id) : [];
  const confirmedOrders = myOrders.filter((o) => o.status === 'confirmed');

  const handleDownload = async (productId: string) => {
    setErrorMsg('');
    setDownloadMsg('');
    try {
      const { url, filename } = await generateDownloadLink(productId);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener noreferrer';
      a.click();
      setDownloadMsg(
        lang === 'ar'
          ? `تم إنشاء رابط تحميل صالح لمدة 60 ثانية للملف: ${filename}`
          : `60-second signed attachment link generated for ${filename}.`
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{t.library.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.library.subtitle}</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#111827] p-4 flex items-center gap-3 text-xs text-slate-300">
        <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0" />
        <span>{t.library.signedUrlNote}</span>
      </div>

      {downloadMsg && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
          {downloadMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          {errorMsg}
        </div>
      )}

      {confirmedOrders.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center text-sm text-slate-400">
          {t.library.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {confirmedOrders.map((ord) => {
            const prod = products.find((p) => p.id === ord.productId);
            if (!prod) return null;
            return (
              <div
                key={ord.id}
                className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#111827] p-4"
              >
                <div className="min-w-0 space-y-1">
                  <button
                    type="button"
                    onClick={() => onNavigate({ page: 'product', productId: prod.id })}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:text-blue-400"
                  >
                    <span className="truncate">{prod.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </button>
                  <p className="font-mono text-xs text-slate-400">
                    v{prod.version} · {formatBytes(prod.fileSizeBytes)} · {prod.platform}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(prod.id)}
                  className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors whitespace-nowrap"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t.library.downloadBtn}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Order History Table */}
      <section className="space-y-3 border-t border-slate-800 pt-6">
        <h2 className="font-display text-lg font-bold text-white">{t.library.orderHistory}</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111827]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-start">
                <th className="px-4 py-3 font-medium text-start">Order</th>
                <th className="px-4 py-3 font-medium text-start">Product</th>
                <th className="px-4 py-3 font-medium text-start">Method</th>
                <th className="px-4 py-3 font-medium text-end">Amount</th>
                <th className="px-4 py-3 font-medium text-start">Status</th>
                <th className="px-4 py-3 font-medium text-start">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {myOrders.map((o) => (
                <tr key={o.id} className="hover:bg-slate-800/30">
                  <td className="px-4 py-3 font-mono text-slate-300">{o.id}</td>
                  <td className="px-4 py-3 text-white font-medium">{o.productTitle}</td>
                  <td className="px-4 py-3 font-mono text-slate-400">{o.paymentMethod}</td>
                  <td className="px-4 py-3 font-mono text-end tabular-nums text-amber-400">
                    {formatCents(o.grossCents)}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    {o.status === 'confirmed'
                      ? t.library.statusConfirmed
                      : o.status === 'refunded'
                      ? t.library.statusRefunded
                      : t.library.statusAwaiting}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{o.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
