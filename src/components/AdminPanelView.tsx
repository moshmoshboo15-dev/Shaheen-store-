import { useState, type FormEvent } from 'react';
import {
  KeyRound,
  Download,
  Check,
  XCircle,
  ShieldAlert,
  RotateCcw,
  Ban,
  AlertTriangle,
} from 'lucide-react';
import type { WithdrawalMethod } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { formatBytes, formatCents } from '../lib/sanitize';

type AdminTab = 'queue' | 'orders' | 'wallet' | 'users' | 'reports' | 'audit';

export function AdminPanelView() {
  const {
    lang,
    currentUser,
    aalLevel,
    users,
    products,
    orders,
    ledger,
    payouts,
    ownerWithdrawals,
    reports,
    auditLogs,
    settings,
    verifyTotpMfa,
    adminApproveProduct,
    adminRejectProduct,
    adminTakedownProduct,
    adminConfirmMalicious,
    adminConfirmOrder,
    adminRefundOrder,
    adminUpdateSettings,
    adminToggleSuspendUser,
    adminMarkPayoutPaid,
    adminWithdrawOwnerWallet,
    exportDatabaseJson,
    exportLedgerCsv,
  } = useMarketplace();

  const t = TRANSLATIONS[lang].admin;
  const [tab, setTab] = useState<AdminTab>('queue');
  const [totpCode, setTotpCode] = useState('');
  const [totpErr, setTotpErr] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Settings form
  const [commPercent, setCommPercent] = useState((settings.commissionBps / 100).toFixed(2));
  const [holdDays, setHoldDays] = useState(String(settings.holdingPeriodDays));

  // Owner withdrawal form
  const [withdrawAmt, setWithdrawAmt] = useState('25');
  const [withdrawMethod, setWithdrawMethod] = useState<WithdrawalMethod>('nsave');
  const [withdrawDest, setWithdrawDest] = useState('nsave-owner-usd');
  const [withdrawNote, setWithdrawNote] = useState('Owner commission withdrawal');

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#111827] p-8 text-center space-y-2">
        <h1 className="font-display text-xl font-bold text-white">{t.title}</h1>
        <p className="text-sm text-slate-400">
          {lang === 'ar'
            ? 'هذه اللوحة مخصصة لمالك المنصة فقط.'
            : 'Restricted to Platform Owner (Admin). Switch to the Admin account via Account modal in Preview Mode.'}
        </p>
      </div>
    );
  }

  // Mandatory TOTP 2FA gate before any admin views/actions
  if (aalLevel !== 'aal2') {
    const handleTotp = async (e: FormEvent) => {
      e.preventDefault();
      setTotpErr('');
      try {
        await verifyTotpMfa(totpCode);
      } catch (err) {
        setTotpErr((err as Error).message);
      }
    };

    return (
      <div className="max-w-md mx-auto rounded-2xl border border-amber-500/30 bg-[#111827] p-6 space-y-4">
        <div className="flex items-center gap-2 text-amber-400">
          <KeyRound className="h-5 w-5" />
          <h1 className="font-display text-lg font-bold text-white">{t.mfaRequiredTitle}</h1>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">{t.mfaRequiredBody}</p>
        {totpErr && <p className="text-xs text-red-400">{totpErr}</p>}
        <form onSubmit={handleTotp} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            required
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            placeholder="Enter 6-digit TOTP code (e.g. 123456 in Preview)"
            className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2.5 text-sm font-mono text-white focus:border-amber-400 focus:outline-none"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            {t.verifyTotpBtn}
          </button>
        </form>
      </div>
    );
  }

  const pendingProducts = products.filter((p) => p.status === 'pending_review');
  const activeProducts = products.filter((p) => p.status === 'approved');

  const runSafe = async (fn: () => Promise<void>, successText: string) => {
    setActionMsg('');
    try {
      await fn();
      setActionMsg(successText);
    } catch (err) {
      setActionMsg((err as Error).message);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">{t.title}</h1>
          <p className="mt-1 text-sm text-slate-400">{t.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => runSafe(exportDatabaseJson, 'Full JSON backup exported.')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 hover:bg-blue-500/20 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.exportJsonBtn}</span>
          </button>
          <button
            type="button"
            onClick={exportLedgerCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-[#111827] px-3 py-2 text-xs font-semibold text-slate-200 hover:border-slate-500 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{t.exportCsvBtn}</span>
          </button>
        </div>
      </div>

      {/* Weekly Backup Reminder */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center justify-between gap-4 text-xs text-amber-200">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{t.backupReminder}</span>
        </div>
        <span className="font-mono text-amber-300 shrink-0">
          Last: {settings.lastBackupExportAt ? settings.lastBackupExportAt.slice(0, 10) : 'Never'}
        </span>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.platformWallet}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-amber-400">
            {formatCents(settings.platformWalletCents)}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.commissionRate}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-white">
            {(settings.commissionBps / 100).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-1">
          <p className="text-xs text-slate-400">{t.holdingPeriod}</p>
          <p className="font-mono text-2xl font-bold tabular-nums text-blue-400">
            {settings.holdingPeriodDays} days
          </p>
        </div>
      </div>

      {actionMsg && (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-2.5 text-xs text-blue-200">
          {actionMsg}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-800 bg-[#111827] p-1">
        {(
          [
            ['queue', `${t.tabQueue} (${pendingProducts.length})`],
            ['orders', `${t.tabOrders} (${orders.length})`],
            ['wallet', t.tabWallet],
            ['users', `${t.tabUsers} (${users.length})`],
            ['reports', `${t.tabReports} (${reports.filter((r) => r.status === 'open').length})`],
            ['audit', t.tabAudit],
          ] as Array<[AdminTab, string]>
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              tab === id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1: Product Review Queue & Instant Takedown */}
      {tab === 'queue' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Pending Review Queue</h2>
            {pendingProducts.length === 0 ? (
              <p className="text-xs text-slate-500">No pending submissions.</p>
            ) : (
              <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#111827]">
                {pendingProducts.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-white">{p.title}</p>
                      <p className="text-xs font-mono text-slate-400">
                        {p.merchantName} · {p.category} · v{p.version} · {formatBytes(p.fileSizeBytes)} · Scan:{' '}
                        {p.scanStatus}
                      </p>
                      <p className="text-xs text-slate-500 font-mono truncate">
                        Storage Key: {p.storageKey}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => runSafe(() => adminApproveProduct(p.id), 'Product approved.')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{t.approve}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => runSafe(() => adminRejectProduct(p.id), 'Product rejected.')}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>{t.reject}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          runSafe(
                            () => adminConfirmMalicious(p.id),
                            'Product removed and merchant automatically suspended.'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <ShieldAlert className="h-3.5 w-3.5" />
                        <span>{t.confirmMalicious}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-white">Live Approved Catalog (Instant Takedown)</h2>
            <div className="divide-y divide-slate-800 rounded-xl border border-slate-800 bg-[#111827]">
              {activeProducts.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{p.title}</p>
                    <p className="text-xs text-slate-400">
                      {p.merchantName} · {formatCents(p.priceCents)} · {p.salesCount} sales
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => runSafe(() => adminTakedownProduct(p.id), 'Product taken down immediately.')}
                    className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
                  >
                    {t.takedown}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Orders, Manual Confirmations & Refunds */}
      {tab === 'orders' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111827]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-start">
                <th className="px-4 py-3 text-start">Order</th>
                <th className="px-4 py-3 text-start">Product / Buyer</th>
                <th className="px-4 py-3 text-start">Reference</th>
                <th className="px-4 py-3 text-end">Gross</th>
                <th className="px-4 py-3 text-end">Fee</th>
                <th className="px-4 py-3 text-start">Status</th>
                <th className="px-4 py-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-slate-300">{o.id}</td>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{o.productTitle}</p>
                    <p className="text-slate-400">{o.buyerEmail}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-amber-300">
                    {o.manualTxReference || o.paymentProviderTxId || '-'}
                  </td>
                  <td className="px-4 py-3 font-mono text-end tabular-nums text-white">
                    {formatCents(o.grossCents)}
                  </td>
                  <td className="px-4 py-3 font-mono text-end tabular-nums text-slate-400">
                    {formatCents(o.commissionCents)}
                  </td>
                  <td className="px-4 py-3 font-mono uppercase text-blue-400">{o.status}</td>
                  <td className="px-4 py-3 text-end">
                    {o.status === 'awaiting_verification' || o.status === 'pending_payment' ? (
                      <button
                        type="button"
                        onClick={() =>
                          runSafe(
                            () => adminConfirmOrder(o.id, o.manualTxReference),
                            'Payment confirmed and balances credited atomically.'
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white"
                      >
                        {t.confirmPayment}
                      </button>
                    ) : o.status === 'confirmed' ? (
                      <button
                        type="button"
                        onClick={() =>
                          runSafe(
                            () => adminRefundOrder(o.id, 'Refund issued by admin'),
                            'Order refunded and ledger reversed.'
                          )
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-red-500/40 px-2.5 py-1 text-xs text-red-300"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>{t.refundOrder}</span>
                      </button>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: Wallet, Commission Config, Owner Withdrawals & Merchant Payouts */}
      {tab === 'wallet' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Config + Owner Withdrawal */}
          <div className="lg:col-span-5 space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const bps = Math.round(Number(commPercent) * 100);
                const days = Math.round(Number(holdDays));
                runSafe(
                  () => adminUpdateSettings(bps, days),
                  'Commission rate & holding period updated.'
                );
              }}
              className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3"
            >
              <h2 className="text-sm font-semibold text-white">Commission & Holding Settings</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Commission (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="50"
                    value={commPercent}
                    onChange={(e) => setCommPercent(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Holding Days</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    value={holdDays}
                    onChange={(e) => setHoldDays(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm font-mono text-white"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2 text-xs font-semibold text-white"
              >
                Save Fee Settings
              </button>
            </form>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                runSafe(
                  () =>
                    adminWithdrawOwnerWallet(
                      Number(withdrawAmt),
                      withdrawMethod,
                      withdrawDest,
                      withdrawNote
                    ),
                  'Owner withdrawal recorded in immutable ledger.'
                );
              }}
              className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3"
            >
              <h2 className="text-sm font-semibold text-white">{t.withdrawOwner}</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={withdrawAmt}
                  onChange={(e) => setWithdrawAmt(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-xs font-mono text-white"
                />
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value as WithdrawalMethod)}
                  className="rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-xs text-white"
                >
                  <option value="nsave">nsave</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>
              <input
                type="text"
                required
                value={withdrawDest}
                onChange={(e) => setWithdrawDest(e.target.value)}
                placeholder="nsave / PayPal destination"
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-xs text-white"
              />
              <input
                type="text"
                value={withdrawNote}
                onChange={(e) => setWithdrawNote(e.target.value)}
                placeholder="Reference note"
                className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-xs text-white"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-amber-500 py-2 text-xs font-semibold text-slate-950"
              >
                {t.withdrawOwner}
              </button>
            </form>
          </div>

          {/* Merchant Payout Requests + Owner Withdrawals */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Merchant Payout Requests</h2>
              <div className="divide-y divide-slate-800 text-xs">
                {payouts.map((pay) => (
                  <div key={pay.id} className="py-3 flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-white">
                        {pay.merchantName} ·{' '}
                        <span className="font-mono text-amber-400">
                          {formatCents(pay.amountCents)}
                        </span>
                      </p>
                      <p className="font-mono text-slate-400">
                        {pay.method} · {pay.destination}
                      </p>
                    </div>
                    {pay.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() =>
                          runSafe(
                            () => adminMarkPayoutPaid(pay.id, 'Transferred via ' + pay.method),
                            'Payout marked paid.'
                          )
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        {t.markPaid}
                      </button>
                    ) : (
                      <span className="font-mono uppercase text-emerald-400">{pay.status}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-3">
              <h2 className="text-sm font-semibold text-white">Owner Withdrawal History</h2>
              <div className="divide-y divide-slate-800 text-xs">
                {ownerWithdrawals.map((w) => (
                  <div key={w.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-white">
                        {formatCents(w.amountCents)} · {w.method}
                      </p>
                      <p className="text-slate-400">{w.destination}</p>
                    </div>
                    <span className="font-mono text-slate-500">{w.createdAt.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Users */}
      {tab === 'users' && (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111827]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 text-start">
                <th className="px-4 py-3 text-start">User</th>
                <th className="px-4 py-3 text-start">Role</th>
                <th className="px-4 py-3 text-end">Available</th>
                <th className="px-4 py-3 text-end">Pending</th>
                <th className="px-4 py-3 text-start">MFA / Strikes</th>
                <th className="px-4 py-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{u.displayName}</p>
                    <p className="text-slate-400 font-mono">{u.email}</p>
                  </td>
                  <td className="px-4 py-3 font-mono uppercase text-amber-400">{u.role}</td>
                  <td className="px-4 py-3 font-mono text-end tabular-nums text-emerald-400">
                    {formatCents(u.availableBalanceCents)}
                  </td>
                  <td className="px-4 py-3 font-mono text-end tabular-nums text-slate-300">
                    {formatCents(u.pendingBalanceCents)}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {u.mfaEnabled ? 'TOTP ON' : 'TOTP OFF'} · Strikes: {u.maliciousStrikeCount}
                  </td>
                  <td className="px-4 py-3 text-end">
                    {u.id !== currentUser.id && (
                      <button
                        type="button"
                        onClick={() =>
                          runSafe(
                            () => adminToggleSuspendUser(u.id, !u.suspended),
                            u.suspended ? 'User unsuspended.' : 'User suspended.'
                          )
                        }
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          u.suspended
                            ? 'bg-emerald-600 text-white'
                            : 'border border-red-500/40 text-red-300'
                        }`}
                      >
                        <Ban className="h-3 w-3" />
                        <span>{u.suspended ? 'Unsuspend' : 'Suspend'}</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 5: Reports */}
      {tab === 'reports' && (
        <div className="rounded-xl border border-slate-800 bg-[#111827] divide-y divide-slate-800">
          {reports.length === 0 ? (
            <p className="p-6 text-xs text-slate-400">No abuse or malware reports submitted.</p>
          ) : (
            reports.map((rep) => (
              <div key={rep.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {rep.productTitle} · <span className="text-red-400 uppercase">{rep.reason}</span>
                  </p>
                  <p className="text-xs text-slate-300">{rep.details}</p>
                  <p className="text-[11px] font-mono text-slate-500">
                    Reported by {rep.reporterEmail} · {rep.status}
                  </p>
                </div>
                {rep.status === 'open' && (
                  <button
                    type="button"
                    onClick={() =>
                      runSafe(
                        () => adminConfirmMalicious(rep.productId, rep.id),
                        'Product removed and merchant suspended.'
                      )
                    }
                    className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    {t.confirmMalicious}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* TAB 6: Immutable Ledger & Audit Logs */}
      {tab === 'audit' && (
        <div className="space-y-6">
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#111827]">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-start">
                  <th className="px-4 py-3 text-start">Ledger Type</th>
                  <th className="px-4 py-3 text-start">Actor</th>
                  <th className="px-4 py-3 text-end">Amount</th>
                  <th className="px-4 py-3 text-start">Note</th>
                  <th className="px-4 py-3 text-start">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 font-mono text-blue-300">{l.entryType}</td>
                    <td className="px-4 py-3 text-white">{l.actorName}</td>
                    <td
                      className={`px-4 py-3 font-mono text-end tabular-nums ${
                        l.amountCents >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {formatCents(l.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{l.note}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{l.createdAt.slice(0, 16)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#111827] p-5 space-y-2">
            <h3 className="text-sm font-semibold text-white">Admin Audit Logs</h3>
            <div className="divide-y divide-slate-800 text-xs">
              {auditLogs.map((a) => (
                <div key={a.id} className="py-2 flex items-center justify-between gap-4 font-mono">
                  <span className="text-amber-300">{a.action}</span>
                  <span className="text-slate-400">
                    {a.targetType}:{a.targetId}
                  </span>
                  <span className="text-slate-500">{a.createdAt.slice(0, 16)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
