import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { ActiveRoute } from '../types';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';

interface LegalPagesViewProps {
  doc: 'terms' | 'privacy' | 'refund' | 'contact';
  onNavigate: (route: ActiveRoute) => void;
}

export function LegalPagesView({ doc, onNavigate }: LegalPagesViewProps) {
  const { lang } = useMarketplace();
  const [contactSent, setContactSent] = useState(false);

  const titles: Record<typeof doc, { en: string; ar: string }> = {
    terms: { en: 'Terms of Service (Draft Template)', ar: 'شروط الاستخدام (مسودة قابلة للتعديل)' },
    privacy: { en: 'Privacy Policy (Draft Template)', ar: 'سياسة الخصوصية (مسودة قابلة للتعديل)' },
    refund: { en: 'Refund Policy (Draft Template)', ar: 'سياسة الاسترداد (مسودة قابلة للتعديل)' },
    contact: { en: 'Contact Shaheen Store', ar: 'اتصل بمتجر شاهين' },
  };

  return (
    <div className="max-w-3xl space-y-6">
      <button
        type="button"
        onClick={() => onNavigate({ page: 'home' })}
        className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white"
      >
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        <span>{TRANSLATIONS[lang].product.backToStore}</span>
      </button>

      <div className="rounded-2xl border border-slate-800 bg-[#111827] p-6 sm:p-8 space-y-4">
        <h1 className="font-display text-2xl font-bold text-white">
          {lang === 'ar' ? titles[doc].ar : titles[doc].en}
        </h1>

        {doc === 'terms' && (
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              1. Marketplace Role: Shaheen Store operates as a global digital marketplace connecting independent merchants with buyers. Digital files (software, Android APKs, scripts, tools, and creative assets) are authored and maintained by their respective merchants.
            </p>
            <p>
              2. Security & Acceptable Use: Uploading malware, trojans, unauthorized cracked software, or infringing assets results in immediate takedown and permanent merchant account suspension.
            </p>
            <p>
              3. Platform Fee: Shaheen Store deducts the configured platform commission (default 2.5%) on confirmed sales and holds merchant earnings for the configured holding window prior to withdrawal.
            </p>
          </div>
        )}

        {doc === 'privacy' && (
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              1. Data Collected: We collect only essential account credentials (email, display name, role) via Supabase Auth, order records, and security audit logs required to deliver downloads and prevent fraud.
            </p>
            <p>
              2. Metadata Protection: Uploaded screenshots are re-encoded to strip EXIF metadata, and product binaries are stored under random identifiers inside isolated private storage.
            </p>
            <p>
              3. Global Access: We do not restrict access by country or sell user data to third parties.
            </p>
          </div>
        )}

        {doc === 'refund' && (
          <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
            <p>
              1. Holding Window: Merchant proceeds remain in a holding balance (default 7 days) so eligible buyer refunds can be processed cleanly before funds become withdrawable.
            </p>
            <p>
              2. Eligible Refunds: Buyers may request a refund if a digital package is corrupted, materially misrepresented, or flagged for security violations. Confirmed refunds reverse both platform commission and merchant earnings in the immutable ledger.
            </p>
          </div>
        )}

        {doc === 'contact' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setContactSent(true);
            }}
            className="space-y-4"
          >
            <p className="text-sm text-slate-300">
              For support, DMCA notices, or payment verification questions, use the form below or configure your support email address in <code>src/components/LegalPagesView.tsx</code>.
            </p>
            <input
              type="email"
              required
              placeholder="your-email@example.com"
              className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
            />
            <textarea
              required
              rows={4}
              placeholder="How can we help?"
              className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white"
            />
            {contactSent && (
              <p className="text-xs text-emerald-400">
                Inquiry recorded. Connect your support webhook or email address before launch.
              </p>
            )}
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
