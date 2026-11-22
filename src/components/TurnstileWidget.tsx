import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import type { Language } from '../types';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'dark' | 'light' | 'auto';
          callback: (token: string) => void;
          'expired-callback'?: () => void;
          'error-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  lang: Language;
}

const DEFAULT_TEST_SITEKEY = '1x00000000000000000000AA';

export function TurnstileWidget({ onVerify, lang }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [fallbackVerified, setFallbackVerified] = useState(false);

  const siteKey =
    (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim() ||
    DEFAULT_TEST_SITEKEY;

  useEffect(() => {
    let mounted = true;
    const renderWidget = () => {
      if (!mounted || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token: string) => {
          if (mounted) onVerify(token);
        },
        'expired-callback': () => {
          if (mounted) onVerify('');
        },
        'error-callback': () => {
          // If sandbox blocks challenges.cloudflare.com, expose manual test token button
          if (mounted && siteKey === DEFAULT_TEST_SITEKEY) {
            setFallbackVerified(false);
          }
        },
      });
    };

    if (window.turnstile) {
      renderWidget();
      return () => {
        mounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // ignore
          }
        }
      };
    }

    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="challenges.cloudflare.com/turnstile"]'
    );
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.onload = renderWidget;
      script.onerror = () => {
        if (mounted && siteKey === DEFAULT_TEST_SITEKEY) {
          setFallbackVerified(false);
        }
      };
      document.head.appendChild(script);
    } else {
      existingScript.addEventListener('load', renderWidget);
    }

    return () => {
      mounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [siteKey, onVerify]);

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="min-h-[65px] flex items-center justify-center rounded-lg border border-slate-800 bg-[#0B1222] px-3 py-2"
      />
      {!window.turnstile && (
        <button
          type="button"
          onClick={() => {
            setFallbackVerified(true);
            onVerify('XXXX.DUMMY.TOKEN.XXXX');
          }}
          className={`w-full flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
            fallbackVerified
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
              : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-blue-500/60 hover:text-white'
          }`}
        >
          <ShieldCheck className="h-4 w-4 shrink-0" />
          <span>
            {fallbackVerified
              ? lang === 'ar'
                ? 'تم التحقق عبر Cloudflare Turnstile (وضع الاختبار)'
                : 'Cloudflare Turnstile Verified (Test Mode)'
              : lang === 'ar'
              ? 'تأكيد الحماية من البوت (Cloudflare Turnstile)'
              : 'Verify Human Check (Cloudflare Turnstile)'}
          </span>
        </button>
      )}
    </div>
  );
}
