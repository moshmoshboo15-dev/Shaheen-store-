import { useState } from 'react';
import { ArrowLeft, CheckSquare, Square, ShieldCheck } from 'lucide-react';
import type { ActiveRoute } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';

const SECURITY_CHECKLIST = [
  'Promote your owner profile to admin in Supabase SQL Editor (`UPDATE profiles SET role = \'admin\', role_selected = true WHERE email = \'...\';`) and enroll TOTP 2FA.',
  'Confirm RLS is enabled on all 15 tables in Supabase Database > Policies and `product-files` bucket is Private.',
  'Verify `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`, and `PAYMENT_WEBHOOK_SECRET` are set ONLY via `supabase secrets set` (never `VITE_*`).',
  'Replace Cloudflare Turnstile test key `1x00000000000000000000AA` with your real free Turnstile Site Key + Secret Key.',
  'Configure your `VITE_PAYMENT_CHECKOUT_URL` and payment account details in `src/config/payments.ts`.',
  'Verify CSP header in `public/_headers` includes your exact `*.supabase.co` project domain.',
  'Test an end-to-end order, webhook/manual confirmation, 60-second signed download URL, and refund reversal before opening.',
  'Schedule a weekly calendar reminder to click "Export Full JSON Backup" and "Export Ledger CSV" in the Admin Panel.',
];

export function DeploymentGuideView({ onNavigate }: { onNavigate: (route: ActiveRoute) => void }) {
  const { lang } = useMarketplace();
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (idx: number) =>
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }));

  return (
    <div className="max-w-4xl space-y-8">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        <span>{TRANSLATIONS[lang].product.backToStore}</span>
      </button>

      <div className="space-y-2">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white">
          100% Free-Tier Deployment &amp; Security Guide
        </h1>
        <p className="text-sm text-slate-400">
          Zero credit card required: Supabase Free Plan + Cloudflare Pages (*.pages.dev) + Cloudflare Turnstile Free.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4 text-sm text-slate-300">
        <h2 className="font-display text-lg font-bold text-amber-400">
          Step 1 — Supabase Backend Setup (Free Plan)
        </h2>
        <ol className="list-decimal ps-5 space-y-2 text-xs sm:text-sm leading-relaxed">
          <li>Create a free project at supabase.com (no card required).</li>
          <li>
            Open <strong>SQL Editor</strong> and run the entire file{' '}
            <code className="font-mono text-blue-300">supabase/migrations/001_initial_schema.sql</code>.
          </li>
          <li>
            In <strong>Authentication → Providers</strong>, enable Email (with Confirm Email ON) and Google OAuth. In <strong>Authentication → Multi-Factor</strong>, enable TOTP.
          </li>
          <li>
            Deploy Edge Functions using the Supabase CLI:
            <pre className="mt-2 overflow-x-auto rounded-lg bg-[#090E1A] p-3 font-mono text-xs text-slate-200">
{`supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set TURNSTILE_SECRET_KEY=your_secret PAYMENT_WEBHOOK_SECRET=your_hmac_secret VIRUSTOTAL_API_KEY=optional_free_key
supabase functions deploy create-order payment-webhook get-download-url merchant-upload admin-actions request-payout`}
            </pre>
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4 text-sm text-slate-300">
        <h2 className="font-display text-lg font-bold text-amber-400">
          Step 2 — Cloudflare Turnstile &amp; Cloudflare Pages (Free *.pages.dev)
        </h2>
        <ol className="list-decimal ps-5 space-y-2 text-xs sm:text-sm leading-relaxed">
          <li>Push this repository to a GitHub repository.</li>
          <li>Create a free Cloudflare Turnstile widget (add your <code>*.pages.dev</code> hostname) and copy the Site Key and Secret Key.</li>
          <li>
            In Cloudflare Dashboard → <strong>Workers &amp; Pages → Create → Connect to Git</strong>:
            Build command: <code className="font-mono text-blue-300">npm run build</code>, Output directory:{' '}
            <code className="font-mono text-blue-300">dist</code>.
          </li>
          <li>
            Add Environment Variables in Cloudflare Pages:{' '}
            <code className="font-mono text-blue-300">VITE_SUPABASE_URL</code>,{' '}
            <code className="font-mono text-blue-300">VITE_SUPABASE_ANON_KEY</code>,{' '}
            <code className="font-mono text-blue-300">VITE_TURNSTILE_SITE_KEY</code>,{' '}
            <code className="font-mono text-blue-300">VITE_PAYMENT_CHECKOUT_URL</code>.
          </li>
        </ol>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#111827] p-6 space-y-4 text-sm text-slate-300">
        <h2 className="font-display text-lg font-bold text-amber-400">
          Step 3 — Payment Provider Settings to Fill In
        </h2>
        <ul className="list-disc ps-5 space-y-2 text-xs sm:text-sm">
          <li>
            <strong>Swappable Config File:</strong> Edit{' '}
            <code className="font-mono text-blue-300">src/config/payments.ts</code> to enter your PayPal email, nsave USD tag, or USDT address.
          </li>
          <li>
            <strong>Hosted Checkout Link (Optional):</strong> Set{' '}
            <code className="font-mono text-blue-300">VITE_PAYMENT_CHECKOUT_URL</code> to your Lemon Squeezy / Paddle / PayTabs product link, and point the provider webhook to{' '}
            <code className="font-mono text-blue-300">https://YOUR_REF.supabase.co/functions/v1/payment-webhook</code> with header{' '}
            <code className="font-mono text-blue-300">x-shaheen-signature</code> (HMAC-SHA256 using <code className="font-mono text-blue-300">PAYMENT_WEBHOOK_SECRET</code>).
          </li>
          <li>
            <strong>Manual Verification Flow:</strong> Works immediately with zero external API keys — buyers submit a transaction reference and you approve it inside Admin → Orders.
          </li>
        </ul>
      </section>

      <section className="rounded-2xl border border-blue-500/30 bg-[#111827] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-blue-400" />
          <h2 className="font-display text-lg font-bold text-white">
            Pre-Launch Security Checklist
          </h2>
        </div>
        <div className="space-y-2.5">
          {SECURITY_CHECKLIST.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => toggle(idx)}
              className="w-full flex items-start gap-3 rounded-lg border border-slate-800 bg-[#090E1A] p-3 text-start text-xs text-slate-300 hover:border-slate-700"
            >
              {checked[idx] ? (
                <CheckSquare className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <Square className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
              )}
              <span className={checked[idx] ? 'line-through text-slate-500' : ''}>{item}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
