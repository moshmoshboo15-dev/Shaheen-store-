import { useState, type FormEvent } from 'react';
import { Upload, Plus, Trash2, Edit3, Banknote, AlertTriangle } from 'lucide-react';
import type { ProductCategory, SupportedPlatform, WithdrawalMethod } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatBytes, formatCents } from '../lib/sanitize';
import { productCreateSchema, payoutRequestSchema } from '../lib/validation';
import { TurnstileWidget } from './TurnstileWidget';

export function MerchantDashboardView() {
  const {
    lang,
    currentUser,
    products,
    orders,
    payouts,
    settings,
    uploadProduct,
    pushProductVersion,
    updateProductDetails,
    deleteProduct,
    requestPayout,
  } = useMarketplace();

  const t = TRANSLATIONS[lang].merchant;

  // Upload form state
  const [title, setTitle] = useState('');
  const [titleAr, setTitleAr] = useState('');
  const [shortTagline, setShortTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ProductCategory>('software');
  const [platform, setPlatform] = useState<SupportedPlatform>('Cross-Platform');
  const [version, setVersion] = useState('1.0.0');
  const [priceDollars, setPriceDollars] = useState('19');
  const [binaryFile, setBinaryFile] = useState<File | null>(null);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [busy, setBusy] = useState(false);

  // Version modal/inline state
  const [versionTargetId, setVersionTargetId] = useState<string | null>(null);
  const [newVerNumber, setNewVerNumber] = useState('');
  const [newVerChangelog, setNewVerChangelog] = useState('');
  const [newVerFile, setNewVerFile] = useState<File | null>(null);

  // Edit state
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrice, setEditPrice] = useState('19');

  // Payout form state
  const [payoutAmount, setPayoutAmount] = useState('25');
  const [payoutMethod, setPayoutMethod] = useState<WithdrawalMethod>('paypal');
  const [payoutDest, setPayoutDest] = useState(currentUser?.payoutDestination || '');
  const [payoutMsg, setPayoutMsg] = useState('');

  if (!currentUser || (currentUser.role !== 'merchant' && currentUser.role !== 'admin')) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center space-y-2">
        <h1 className="font-display text-xl font-bold text-white">{t.title}</h1>
        <p className="text-sm text-slate-400">
          {lang === 'ar'
            ? 'سجّل الدخول بحساب تاجر للوصول إلى لوحة رفع المنتجات والأرباح.'
            : 'Sign in with a Merchant account to upload products, manage versions, and request payouts.'}
        </p>
      </div>
    );
  }

  const myProducts = products.filter((p) => p.merchantId === currentUser.id);
  const mySalesCount = orders.filter(
    (o) => o.merchantId === currentUser.id && o.status === 'confirmed'
  ).length;
  const myPayouts = payouts.filter((p) => p.merchantId === currentUser.id);

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadStatus('');
    if (!binaryFile) {
      setUploadError('Select a binary/archive/APK/script file (max 50 MB).');
      return;
    }
    const parsed = productCreateSchema.safeParse({
      title,
      titleAr,
      shortTagline,
      shortTaglineAr: '',
      description,
      descriptionAr: '',
      category,
      platform,
      version,
      priceDollars: Number(priceDollars),
      turnstileToken,
    });
    if (!parsed.success) {
      setUploadError(parsed.error.issues[0]?.message || 'Check product form fields.');
      return;
    }
    setBusy(true);
    try {
      await uploadProduct({
        title,
        titleAr,
        shortTagline,
        shortTaglineAr: '',
        description,
        descriptionAr: '',
        category,
        platform,
        version,
        priceDollars: Number(priceDollars),
        binaryFile,
        screenshotFile,
        turnstileToken,
      });
      setTitle('');
      setTitleAr('');
      setShortTagline('');
      setDescription('');
      setBinaryFile(null);
      setScreenshotFile(null);
      setUploadStatus(
        lang === 'ar'
          ? 'تم رفع المنتج تحت اسم عشوائي آمن وهو الآن بانتظار مراجعة الإدارة.'
          : 'Product uploaded as an opaque binary under a random storage key and queued for admin review.'
      );
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleVersionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionTargetId || !newVerFile) return;
    await pushProductVersion({
      productId: versionTargetId,
      versionNumber: newVerNumber,
      changelog: newVerChangelog,
      binaryFile: newVerFile,
    });
    setVersionTargetId(null);
    setNewVerNumber('');
    setNewVerChangelog('');
    setNewVerFile(null);
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editTargetId) return;
    await updateProductDetails(editTargetId, {
      title: editTitle,
      shortTagline: editTagline,
      description: editDesc,
      priceDollars: Number(editPrice),
    });
    setEditTargetId(null);
  };

  const handlePayoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPayoutMsg('');
    const parsed = payoutRequestSchema.safeParse({
      amountDollars: Number(payoutAmount),
      method: payoutMethod,
      destination: payoutDest,
    });
    if (!parsed.success) {
      setPayoutMsg(parsed.error.issues[0]?.message || 'Invalid payout request.');
      return;
    }
    try {
      await requestPayout({
        amountDollars: Number(payoutAmount),
        method: payoutMethod,
        destination: payoutDest,
      });
      setPayoutMsg(
        lang === 'ar' ? 'تم إرسال طلب السحب للمراجعة.' : 'Payout request submitted for admin processing.'
      );
    } catch (err) {
      setPayoutMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-white">{t.title}</h1>
        <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
      </div>

      {currentUser.suspended && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 flex items-center gap-3 text-xs text-red-200">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <span>{t.suspendedBanner}</span>
        </div>
      )}

      {/* Merchant Balance KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.availableBalance}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-emerald-400">
            {formatCents(currentUser.availableBalanceCents)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.pendingBalance}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-amber-400">
            {formatCents(currentUser.pendingBalanceCents)}
          </p>
          <p className="text-[11px] text-slate-500">
            {settings.holdingPeriodDays}d hold · {(settings.commissionBps / 100).toFixed(2)}% fee
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.totalSales}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-white">{mySalesCount}</p>
        </div>
      </div>

      {/* Upload + Payout Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Upload New Product Form */}
        <form
          onSubmit={handleUpload}
          className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-400" />
            <h2 className="font-display text-lg font-bold text-white">{t.uploadNewProduct}</h2>
          </div>

          {uploadError && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {uploadError}
            </div>
          )}
          {uploadStatus && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
              {uploadStatus}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Product Title (EN)</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Title (AR Optional)</label>
              <input
                type="text"
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Short Tagline</label>
            <input
              type="text"
              required
              value={shortTagline}
              onChange={(e) => setShortTagline(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">Technical Description</label>
            <textarea
              required
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-2.5 py-2 text-xs text-white"
              >
                <option value="software">Software</option>
                <option value="apk">Android APK</option>
                <option value="tools">Tools</option>
                <option value="scripts">Scripts</option>
                <option value="assets">Assets</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Platform</label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as SupportedPlatform)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-2.5 py-2 text-xs text-white"
              >
                <option value="Cross-Platform">Cross-Platform</option>
                <option value="Windows">Windows</option>
                <option value="macOS">macOS</option>
                <option value="Linux">Linux</option>
                <option value="Android (APK)">Android (APK)</option>
                <option value="Web / Node.js">Web / Node.js</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Version</label>
              <input
                type="text"
                required
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-2.5 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">Price (USD)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                required
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-2.5 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Product Binary / Archive / APK (Max 50 MB)
              </label>
              <input
                type="file"
                required
                onChange={(e) => setBinaryFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Screenshot (PNG/JPG/WebP, EXIF stripped)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setScreenshotFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-300 file:me-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
              />
            </div>
          </div>

          <TurnstileWidget lang={lang} onVerify={setTurnstileToken} />

          <button
            type="submit"
            disabled={busy || currentUser.suspended}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
          >
            {busy ? 'Uploading...' : t.uploadNewProduct}
          </button>
        </form>

        {/* Payout Request Card */}
        <div className="lg:col-span-5 space-y-6">
          <form
            onSubmit={handlePayoutSubmit}
            className="rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Banknote className="h-4 w-4 text-amber-400" />
              <h2 className="font-display text-lg font-bold text-white">{t.requestPayout}</h2>
            </div>
            <p className="text-xs text-slate-400">{t.holdingNote}</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  min="5"
                  step="0.01"
                  required
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value as WithdrawalMethod)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
                >
                  <option value="paypal">PayPal</option>
                  <option value="nsave">nsave</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">
                Destination (PayPal Email or nsave Tag)
              </label>
              <input
                type="text"
                required
                value={payoutDest}
                onChange={(e) => setPayoutDest(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
              />
            </div>

            {payoutMsg && <p className="text-xs text-amber-300">{payoutMsg}</p>}

            <button
              type="submit"
              className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
            >
              {t.requestPayout}
            </button>
          </form>

          {/* Payout History */}
          <div className="rounded-2xl border border-slate-800 bg-[#111827] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">{t.payoutHistory}</h3>
            {myPayouts.length === 0 ? (
              <p className="text-xs text-slate-500">No payout requests yet.</p>
            ) : (
              <div className="divide-y divide-slate-800 text-xs">
                {myPayouts.map((pay) => (
                  <div key={pay.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-white">
                        {formatCents(pay.amountCents)} · {pay.method}
                      </p>
                      <p className="text-slate-400 truncate max-w-[200px]">{pay.destination}</p>
                    </div>
                    <span className="font-mono uppercase text-amber-400">{pay.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Merchant Products Table */}
      <section className="space-y-4 border-t border-slate-800 pt-6">
        <h2 className="font-display text-lg font-bold text-white">{t.myProducts}</h2>
        <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#111827]">
          {myProducts.map((p) => (
            <div key={p.id} className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-white">{p.title}</p>
                  <p className="text-xs font-mono text-slate-400">
                    v{p.version} · {formatBytes(p.fileSizeBytes)} · {formatCents(p.priceCents)} ·{' '}
                    <span className="text-amber-400 uppercase">{p.status}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditTargetId(p.id);
                      setEditTitle(p.title);
                      setEditTagline(p.shortTagline);
                      setEditDesc(p.description);
                      setEditPrice((p.priceCents / 100).toFixed(2));
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setVersionTargetId(p.id);
                      setNewVerNumber('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-500/40 px-2.5 py-1.5 text-xs text-blue-300 hover:bg-blue-500/10"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{t.addNewVersion}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteProduct(p.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1.5 text-xs text-red-300 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{t.deleteProduct}</span>
                  </button>
                </div>
              </div>

              {versionTargetId === p.id && (
                <form
                  onSubmit={handleVersionSubmit}
                  className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-lg border border-slate-800 bg-[#090E1A] p-3"
                >
                  <input
                    type="text"
                    required
                    placeholder="Version (e.g. 2.9.0)"
                    value={newVerNumber}
                    onChange={(e) => setNewVerNumber(e.target.value)}
                    className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Changelog summary"
                    value={newVerChangelog}
                    onChange={(e) => setNewVerChangelog(e.target.value)}
                    className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                  />
                  <input
                    type="file"
                    required
                    onChange={(e) => setNewVerFile(e.target.files?.[0] || null)}
                    className="text-xs text-slate-300"
                  />
                  <button
                    type="submit"
                    className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Release Update
                  </button>
                </form>
              )}

              {editTargetId === p.id && (
                <form
                  onSubmit={handleEditSubmit}
                  className="space-y-2 rounded-lg border border-slate-800 bg-[#090E1A] p-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      required
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="text"
                      required
                      value={editTagline}
                      onChange={(e) => setEditTagline(e.target.value)}
                      className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs font-mono text-white"
                    />
                  </div>
                  <textarea
                    rows={2}
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-[#111827] px-2.5 py-1.5 text-xs text-white"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTargetId(null)}
                      className="rounded border border-slate-700 px-3 py-1.5 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
