import { useMemo, useState, type FormEvent } from 'react';
import { X, CheckCircle2, Clock, Globe2, ExternalLink } from 'lucide-react';
import { PAYMENT_CONFIG } from '../config/payments';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatCents } from '../lib/sanitize';
import type { Order } from '../types';

interface CheckoutModalProps {
  productId: string | null;
  onClose: () => void;
  onGoToLibrary: () => void;
}

export function CheckoutModal({ productId, onClose, onGoToLibrary }: CheckoutModalProps) {
  const { lang, isSupabaseMode, products, settings, createOrder } = useMarketplace();
  const t = TRANSLATIONS[lang].checkout;

  const product = products.find((p) => p.id === productId);
  const [selectedMethodId, setSelectedMethodId] = useState(PAYMENT_CONFIG.availableMethods[0].id);
  const [manualTxRef, setManualTxRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);

  // One stable idempotency key per modal checkout attempt to prevent duplicate charges
  const idempotencyKey = useMemo(
    () => `idem-${productId || 'none'}-${crypto.randomUUID()}`,
    [productId]
  );

  if (!productId || !product) return null;

  const selectedMethod =
    PAYMENT_CONFIG.availableMethods.find((m) => m.id === selectedMethodId) ||
    PAYMENT_CONFIG.availableMethods[0];

  const handleCheckout = async (e: FormEvent, simulateWebhook = false) => {
    e.preventDefault();
    setErrorMsg('');
    setBusy(true);
    try {
      const order = await createOrder({
        productId: product.id,
        idempotencyKey,
        paymentMethod: selectedMethod.id,
        manualTxReference: simulateWebhook ? undefined : manualTxRef,
        simulateImmediateWebhook: simulateWebhook,
      });
      setCompletedOrder(order);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hostedUrl = PAYMENT_CONFIG.hostedCheckoutBaseUrl
    ? `${PAYMENT_CONFIG.hostedCheckoutBaseUrl}${
        PAYMENT_CONFIG.hostedCheckoutBaseUrl.includes('?') ? '&' : '?'
      }product_id=${encodeURIComponent(product.id)}&idempotency_key=${encodeURIComponent(
        idempotencyKey
      )}`
    : '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-5">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute top-4 end-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {completedOrder ? (
          <div className="space-y-4 py-2 text-center">
            {completedOrder.status === 'confirmed' ? (
              <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto" />
            ) : (
              <Clock className="h-12 w-12 text-amber-400 mx-auto" />
            )}

            <h2 className="font-display text-xl font-bold text-white">
              {completedOrder.status === 'confirmed'
                ? t.orderSuccessTitle
                : t.awaitingAdminTitle}
            </h2>

            <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-4 text-xs space-y-1.5 text-start font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Order ID</span>
                <span className="text-white">{completedOrder.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Amount</span>
                <span className="text-amber-400">{formatCents(completedOrder.grossCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">
                  Platform Fee ({(completedOrder.commissionBps / 100).toFixed(2)}%)
                </span>
                <span className="text-slate-300">{formatCents(completedOrder.commissionCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className="text-blue-400 uppercase">{completedOrder.status}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onGoToLibrary();
              }}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              {t.goToLibrary}
            </button>
          </div>
        ) : (
          <>
            <div>
              <h2 className="font-display text-xl font-bold text-white">{t.title}</h2>
              <p className="mt-1 text-xs text-slate-400 flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span>{t.subtitle}</span>
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#090E1A] p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{product.title}</p>
                <p className="text-xs text-slate-400">
                  v{product.version} · {product.merchantName}
                </p>
              </div>
              <span className="font-mono text-lg font-bold tabular-nums text-amber-400">
                {formatCents(product.priceCents)}
              </span>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={(e) => handleCheckout(e, false)} className="space-y-4">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  {t.selectMethod}
                </label>
                <div className="space-y-2">
                  {PAYMENT_CONFIG.availableMethods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`w-full text-start rounded-xl border p-3 text-xs transition-colors ${
                        selectedMethodId === method.id
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-[#090E1A] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <p className="font-semibold">
                        {lang === 'ar' ? method.labelAr : method.label}
                      </p>
                      <p className="mt-1 text-slate-400">
                        {lang === 'ar' ? method.instructionsAr : method.instructions}
                      </p>
                      {method.accountDetails && (
                        <p className="mt-1.5 font-mono text-amber-300">{method.accountDetails}</p>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {selectedMethod.type === 'gateway_checkout' && hostedUrl && (
                <a
                  href={hostedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-blue-500/50 bg-blue-600/15 py-2.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/25 transition-colors"
                >
                  <span>{t.openGatewayBtn}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.manualRefLabel}
                </label>
                <input
                  type="text"
                  required
                  value={manualTxRef}
                  onChange={(e) => setManualTxRef(e.target.value)}
                  placeholder={t.manualRefPlaceholder}
                  className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <p className="text-[11px] text-slate-400">
                {t.globalNote} ({(settings.commissionBps / 100).toFixed(2)}% platform fee).
              </p>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
                >
                  {t.confirmOrderBtn}
                </button>

                {!isSupabaseMode && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={(e) => handleCheckout(e, true)}
                    className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                  >
                    {t.simulateWebhookBtn}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
