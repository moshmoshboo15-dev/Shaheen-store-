import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  Heart,
  ShieldAlert,
  Star,
  Flag,
  CheckCircle2,
  Download,
} from 'lucide-react';
import type { ActiveRoute, ProductReport } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatBytes, formatCents } from '../lib/sanitize';
import { ProductImage } from './ProductImage';

interface ProductDetailViewProps {
  productId: string;
  onNavigate: (route: ActiveRoute) => void;
  onStartCheckout: (productId: string) => void;
  onOpenAuth: () => void;
}

export function ProductDetailView({
  productId,
  onNavigate,
  onStartCheckout,
  onOpenAuth,
}: ProductDetailViewProps) {
  const {
    lang,
    currentUser,
    products,
    reviews,
    orders,
    wishlistIds,
    toggleWishlist,
    submitReview,
    reportProduct,
  } = useMarketplace();

  const t = TRANSLATIONS[lang];
  const product = products.find((p) => p.id === productId);

  const [activeShot, setActiveShot] = useState(0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<ProductReport['reason']>('malware');
  const [reportDetails, setReportDetails] = useState('');
  const [reportStatus, setReportStatus] = useState('');

  if (!product) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center space-y-4">
        <p className="text-slate-300">Product not found or removed.</p>
        <button
          type="button"
          onClick={() => onNavigate({ page: 'home' })}
          className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white"
        >
          {t.product.backToStore}
        </button>
      </div>
    );
  }

  const productReviews = reviews.filter((r) => r.productId === product.id);
  const isOwned = Boolean(
    currentUser &&
      orders.some(
        (o) =>
          o.buyerId === currentUser.id &&
          o.productId === product.id &&
          o.status === 'confirmed'
      )
  );
  const inWishlist = wishlistIds.includes(product.id);
  const title = lang === 'ar' && product.titleAr ? product.titleAr : product.title;
  const desc = lang === 'ar' && product.descriptionAr ? product.descriptionAr : product.description;

  const handleReviewSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setReviewError('');
    setReviewSuccess(false);
    try {
      await submitReview(product.id, rating, comment);
      setComment('');
      setReviewSuccess(true);
    } catch (err) {
      setReviewError((err as Error).message);
    }
  };

  const handleReportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await reportProduct(product.id, reportReason, reportDetails);
      setReportDetails('');
      setReportStatus(
        lang === 'ar'
          ? 'تم إرسال البلاغ للمراجعة الفورية.'
          : 'Security report submitted for admin review.'
      );
      setTimeout(() => setReportOpen(false), 1200);
    } catch (err) {
      setReportStatus((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        <span>{t.product.backToStore}</span>
      </button>

      {/* Main PDP Split: Gallery Left + Contiguous Purchase Module Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Gallery & Description Column */}
        <div className="lg:col-span-7 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#111827] aspect-[16/10]">
            <ProductImage
              src={product.screenshots[activeShot] || product.screenshots[0]}
              alt={title}
              category={product.category}
              className="h-full w-full"
            />
          </div>

          {product.screenshots.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {product.screenshots.map((shot, i) => (
                <button
                  key={`${shot}-${i}`}
                  type="button"
                  onClick={() => setActiveShot(i)}
                  className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                    i === activeShot ? 'border-blue-500' : 'border-slate-800 opacity-70 hover:opacity-100'
                  }`}
                >
                  <ProductImage src={shot} alt={title} category={product.category} className="h-full w-full" />
                </button>
              ))}
            </div>
          )}

          {/* Third-Party Merchant File Security Notice */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-amber-300">{t.product.thirdPartyWarningTitle}</p>
              <p className="text-slate-300 leading-relaxed">{t.product.thirdPartyWarningBody}</p>
            </div>
          </div>

          <div className="space-y-3 border-t border-slate-800/80 pt-6">
            <h2 className="font-display text-lg font-semibold text-white">
              {lang === 'ar' ? 'نظرة عامة تقنية' : 'Technical Overview'}
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-line">{desc}</p>
          </div>

          {/* Version History */}
          {product.versions && product.versions.length > 0 && (
            <div className="space-y-3 border-t border-slate-800/80 pt-6">
              <h2 className="font-display text-lg font-semibold text-white">
                {t.product.releaseHistory}
              </h2>
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#111827]">
                {product.versions.map((ver) => (
                  <div key={ver.id} className="p-4 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-semibold text-amber-400">
                        v{ver.versionNumber}
                      </span>
                      <span className="font-mono text-slate-400">
                        {formatBytes(ver.fileSizeBytes)} · {ver.createdAt.slice(0, 10)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-300">{ver.changelog}</p>
                    <p className="font-mono text-[11px] text-slate-500 truncate">
                      SHA-256: {ver.sha256Hash}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Purchase Module Right */}
        <aside className="lg:col-span-5 lg:sticky lg:top-24 rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="uppercase tracking-wider text-amber-400 font-medium">
                {t.categories[product.category]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{product.merchantName}</span>
            </div>

            <h1 className="font-display text-2xl font-bold text-white leading-tight">{title}</h1>

            <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
              <span className="inline-flex items-center gap-1 text-amber-400 font-mono tabular-nums">
                <Star className="h-3.5 w-3.5 fill-amber-400" />
                {product.ratingAvg.toFixed(1)} ({product.ratingCount})
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {product.salesCount} {t.store.sales}
              </span>
            </div>
          </div>

          <div className="border-y border-slate-800 py-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t.product.version}</span>
              <span className="font-mono text-white">v{product.version}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t.product.fileSize}</span>
              <span className="font-mono text-white">{formatBytes(product.fileSizeBytes)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t.product.platform}</span>
              <span className="text-white">{product.platform}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{t.product.scanStatus}</span>
              <span className="inline-flex items-center gap-1 font-mono text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {product.scanStatus.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">USD</span>
            <span className="font-mono text-3xl font-bold tabular-nums text-white">
              {formatCents(product.priceCents)}
            </span>
          </div>

          <div className="space-y-3">
            {isOwned ? (
              <button
                type="button"
                onClick={() => onNavigate({ page: 'library' })}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition-colors"
              >
                <Download className="h-4 w-4" />
                <span>{t.product.ownedInLibrary}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (!currentUser) onOpenAuth();
                  else onStartCheckout(product.id);
                }}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
              >
                {t.product.buyNow}
              </button>
            )}

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => toggleWishlist(product.id)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-medium transition-colors ${
                  inWishlist
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
              >
                <Heart className={`h-3.5 w-3.5 ${inWishlist ? 'fill-amber-400' : ''}`} />
                <span>{inWishlist ? t.product.inWishlist : t.product.addWishlist}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!currentUser) onOpenAuth();
                  else setReportOpen((v) => !v);
                }}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 py-2.5 text-xs font-medium text-slate-300 hover:border-red-500/50 hover:text-red-300 transition-colors"
              >
                <Flag className="h-3.5 w-3.5" />
                <span>{t.product.reportProduct}</span>
              </button>
            </div>
          </div>

          {reportOpen && (
            <form
              onSubmit={handleReportSubmit}
              className="space-y-3 rounded-xl border border-red-500/30 bg-[#090E1A] p-4"
            >
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value as ProductReport['reason'])}
                className="w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-white"
              >
                <option value="malware">Malware / Suspicious Binary</option>
                <option value="copyright">Copyright / Stolen Asset</option>
                <option value="broken_file">Corrupted / Broken Package</option>
                <option value="misleading">Misleading Description</option>
                <option value="other">Other</option>
              </select>
              <textarea
                required
                rows={3}
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Describe the security or policy issue..."
                className="w-full rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs text-white focus:border-red-500 focus:outline-none"
              />
              {reportStatus && <p className="text-xs text-amber-300">{reportStatus}</p>}
              <button
                type="submit"
                className="w-full rounded-lg bg-red-600 py-2 text-xs font-semibold text-white hover:bg-red-500 transition-colors"
              >
                {t.product.submitReport}
              </button>
            </form>
          )}
        </aside>
      </div>

      {/* Reviews Section */}
      <section className="space-y-5 border-t border-slate-800/80 pt-8">
        <h2 className="font-display text-xl font-bold text-white">{t.product.reviewsTitle}</h2>

        {isOwned ? (
          <form
            onSubmit={handleReviewSubmit}
            className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3 max-w-2xl"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white">{t.product.writeReview}</span>
              <select
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="rounded-lg border border-slate-700 bg-[#090E1A] px-2.5 py-1 text-xs font-mono text-amber-400"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {n} / 5
                  </option>
                ))}
              </select>
            </div>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t.product.writeReview}
              className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
            />
            {reviewError && <p className="text-xs text-red-400">{reviewError}</p>}
            {reviewSuccess && (
              <p className="text-xs text-emerald-400">
                {lang === 'ar' ? 'تم نشر تقييمك.' : 'Review published.'}
              </p>
            )}
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              {t.product.submitReview}
            </button>
          </form>
        ) : (
          <p className="text-xs text-slate-400">{t.product.purchaseToReview}</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {productReviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl border border-slate-800 bg-[#111827] p-4 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">{rev.buyerName}</span>
                <span className="font-mono text-amber-400">{rev.rating}.0 / 5</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{rev.comment}</p>
              <p className="font-mono text-[11px] text-slate-500">{rev.createdAt.slice(0, 10)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
