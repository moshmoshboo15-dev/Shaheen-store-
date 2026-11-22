import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuditLog,
  Language,
  LedgerEntry,
  Order,
  OwnerWithdrawal,
  PayoutRequest,
  PlatformSettings,
  Product,
  ProductCategory,
  ProductReport,
  ProductReview,
  SupportedPlatform,
  UserProfile,
  UserRole,
  WithdrawalMethod,
} from '../types';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_LEDGER,
  INITIAL_ORDERS,
  INITIAL_OWNER_WITHDRAWALS,
  INITIAL_PAYOUTS,
  INITIAL_PRODUCTS,
  INITIAL_REPORTS,
  INITIAL_REVIEWS,
  INITIAL_SETTINGS,
  PREVIEW_USERS,
} from '../data/initialCatalog';
import { getEdgeFunctionUrl, isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  computeSha256Hex,
  escapeCsvCell,
  sanitizeMultilineText,
  sanitizePlainText,
  sanitizeSafeFilename,
  stripImageMetadataAndReencode,
} from '../lib/sanitize';
import { hasDisallowedOperatorKeys } from '../lib/validation';

interface UploadProductPayload {
  title: string;
  titleAr: string;
  shortTagline: string;
  shortTaglineAr: string;
  description: string;
  descriptionAr: string;
  category: ProductCategory;
  platform: SupportedPlatform;
  version: string;
  priceDollars: number;
  binaryFile: File;
  screenshotFile?: File | null;
  turnstileToken: string;
}

interface MarketplaceContextValue {
  lang: Language;
  setLang: (lang: Language) => void;
  isSupabaseMode: boolean;
  currentUser: UserProfile | null;
  aalLevel: 'aal1' | 'aal2';
  users: UserProfile[];
  products: Product[];
  reviews: ProductReview[];
  orders: Order[];
  ledger: LedgerEntry[];
  payouts: PayoutRequest[];
  ownerWithdrawals: OwnerWithdrawal[];
  reports: ProductReport[];
  auditLogs: AuditLog[];
  wishlistIds: string[];
  settings: PlatformSettings;
  authBusy: boolean;

  // Auth & Role Actions
  signInWithEmail: (email: string, password: string, turnstileToken: string) => Promise<void>;
  signUpWithEmail: (
    email: string,
    password: string,
    displayName: string,
    turnstileToken: string
  ) => Promise<{ needsVerification: boolean }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  selectUserRole: (role: 'buyer' | 'merchant') => Promise<void>;
  switchPreviewUser: (userId: string) => void;
  enrollTotpMfa: () => Promise<{ qrCode: string; secret: string; factorId: string }>;
  verifyTotpMfa: (code: string, factorId?: string) => Promise<void>;

  // Buyer Actions
  toggleWishlist: (productId: string) => Promise<void>;
  createOrder: (params: {
    productId: string;
    idempotencyKey: string;
    paymentMethod: string;
    manualTxReference?: string;
    simulateImmediateWebhook?: boolean;
  }) => Promise<Order>;
  generateDownloadLink: (productId: string) => Promise<{ url: string; filename: string }>;
  submitReview: (productId: string, rating: number, comment: string) => Promise<void>;
  reportProduct: (
    productId: string,
    reason: ProductReport['reason'],
    details: string
  ) => Promise<void>;

  // Merchant Actions
  uploadProduct: (payload: UploadProductPayload) => Promise<Product>;
  pushProductVersion: (params: {
    productId: string;
    versionNumber: string;
    changelog: string;
    binaryFile: File;
  }) => Promise<void>;
  updateProductDetails: (
    productId: string,
    updates: { title: string; shortTagline: string; description: string; priceDollars: number }
  ) => Promise<void>;
  deleteProduct: (productId: string) => Promise<void>;
  requestPayout: (params: {
    amountDollars: number;
    method: WithdrawalMethod;
    destination: string;
  }) => Promise<void>;

  // Admin Actions
  adminApproveProduct: (productId: string) => Promise<void>;
  adminRejectProduct: (productId: string) => Promise<void>;
  adminTakedownProduct: (productId: string) => Promise<void>;
  adminConfirmMalicious: (productId: string, reportId?: string) => Promise<void>;
  adminConfirmOrder: (orderId: string, providerTxId?: string) => Promise<void>;
  adminRefundOrder: (orderId: string, reason: string) => Promise<void>;
  adminUpdateSettings: (commissionBps: number, holdingPeriodDays: number) => Promise<void>;
  adminToggleSuspendUser: (userId: string, suspended: boolean) => Promise<void>;
  adminMarkPayoutPaid: (payoutId: string, note: string) => Promise<void>;
  adminWithdrawOwnerWallet: (
    amountDollars: number,
    method: WithdrawalMethod,
    destination: string,
    note: string
  ) => Promise<void>;
  exportDatabaseJson: () => Promise<void>;
  exportLedgerCsv: () => void;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return ctx;
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');
  const [users, setUsers] = useState<UserProfile[]>(PREVIEW_USERS);
  const [currentUserId, setCurrentUserId] = useState<string | null>('usr-buyer-01');
  const [aalLevel, setAalLevel] = useState<'aal1' | 'aal2'>('aal1');
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [reviews, setReviews] = useState<ProductReview[]>(INITIAL_REVIEWS);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [ledger, setLedger] = useState<LedgerEntry[]>(INITIAL_LEDGER);
  const [payouts, setPayouts] = useState<PayoutRequest[]>(INITIAL_PAYOUTS);
  const [ownerWithdrawals, setOwnerWithdrawals] = useState<OwnerWithdrawal[]>(
    INITIAL_OWNER_WITHDRAWALS
  );
  const [reports, setReports] = useState<ProductReport[]>(INITIAL_REPORTS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [wishlistIds, setWishlistIds] = useState<string[]>(['prod-arch-shaders']);
  const [settings, setSettings] = useState<PlatformSettings>(INITIAL_SETTINGS);
  const [authBusy, setAuthBusy] = useState(false);

  // Sync HTML dir & lang attribute dynamically for English LTR / Arabic RTL
  const setLang = useCallback((next: Language) => {
    setLangState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = next === 'ar' ? 'rtl' : 'ltr';
  }, []);

  // Load real Supabase session and data when configured
  const refreshSupabaseData = useCallback(async () => {
    if (!supabase) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (prof) {
        const mapped: UserProfile = {
          id: prof.id,
          email: prof.email,
          displayName: prof.display_name,
          role: prof.role as UserRole,
          roleSelected: Boolean(prof.role_selected),
          emailVerified: Boolean(session.user.email_confirmed_at),
          mfaEnabled: false,
          suspended: Boolean(prof.suspended),
          maliciousStrikeCount: Number(prof.malicious_strike_count || 0),
          availableBalanceCents: Number(prof.available_balance_cents || 0),
          pendingBalanceCents: Number(prof.pending_balance_cents || 0),
          payoutDestination: prof.payout_destination || undefined,
          createdAt: prof.created_at,
        };
        const { data: factors } = await supabase.auth.mfa.listFactors();
        mapped.mfaEnabled = Boolean(factors?.totp?.some((f) => f.status === 'verified'));

        const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
        setAalLevel(aal?.currentLevel === 'aal2' ? 'aal2' : 'aal1');

        setUsers([mapped]);
        setCurrentUserId(mapped.id);
      }

      const [prodRes, revRes, ordRes, wishRes, setRes] = await Promise.all([
        supabase.from('products').select('*, profiles(display_name)').order('created_at', { ascending: false }),
        supabase.from('reviews').select('*, profiles(display_name)').order('created_at', { ascending: false }),
        supabase.from('orders').select('*, products(title)').order('created_at', { ascending: false }),
        supabase.from('wishlists').select('product_id').eq('buyer_id', session.user.id),
        supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
      ]);

      if (prodRes.data) {
        setProducts(
          prodRes.data.map((p: Record<string, unknown>) => ({
            id: String(p.id),
            merchantId: String(p.merchant_id),
            merchantName: String((p.profiles as { display_name?: string } | null)?.display_name || 'Merchant'),
            title: String(p.title),
            titleAr: String(p.title_ar || ''),
            shortTagline: String(p.short_tagline),
            shortTaglineAr: String(p.short_tagline_ar || ''),
            description: String(p.description),
            descriptionAr: String(p.description_ar || ''),
            category: p.category as ProductCategory,
            platform: p.platform as SupportedPlatform,
            version: String(p.current_version),
            fileSizeBytes: Number(p.file_size_bytes),
            priceCents: Number(p.price_cents),
            screenshots: Array.isArray(p.screenshots) ? (p.screenshots as string[]) : [],
            featured: Boolean(p.featured),
            status: p.status as Product['status'],
            salesCount: Number(p.sales_count || 0),
            ratingAvg: Number(p.rating_avg || 0),
            ratingCount: Number(p.rating_count || 0),
            scanStatus: p.scan_status as Product['scanStatus'],
            storageKey: String(p.storage_key || ''),
            createdAt: String(p.created_at),
            updatedAt: String(p.updated_at),
          }))
        );
      }

      if (revRes.data) {
        setReviews(
          revRes.data.map((r: Record<string, unknown>) => ({
            id: String(r.id),
            productId: String(r.product_id),
            buyerId: String(r.buyer_id),
            buyerName: String((r.profiles as { display_name?: string } | null)?.display_name || 'Buyer'),
            rating: Number(r.rating),
            comment: String(r.comment),
            createdAt: String(r.created_at),
          }))
        );
      }

      if (ordRes.data) {
        setOrders(
          ordRes.data.map((o: Record<string, unknown>) => ({
            id: String(o.id),
            idempotencyKey: String(o.idempotency_key),
            buyerId: String(o.buyer_id),
            buyerEmail: '',
            productId: String(o.product_id),
            productTitle: String((o.products as { title?: string } | null)?.title || 'Digital Item'),
            merchantId: String(o.merchant_id),
            merchantName: '',
            grossCents: Number(o.gross_cents),
            commissionCents: Number(o.commission_cents),
            commissionBps: Number(o.commission_bps),
            merchantNetCents: Number(o.merchant_net_cents),
            paymentMethod: String(o.payment_method),
            paymentProviderTxId: o.payment_provider_tx_id ? String(o.payment_provider_tx_id) : undefined,
            manualTxReference: o.manual_tx_reference ? String(o.manual_tx_reference) : undefined,
            status: o.status as Order['status'],
            holdingReleaseAt: String(o.holding_release_at),
            releasedToAvailable: Boolean(o.released_to_available),
            createdAt: String(o.created_at),
            confirmedAt: o.confirmed_at ? String(o.confirmed_at) : undefined,
          }))
        );
      }

      if (wishRes.data) {
        setWishlistIds(wishRes.data.map((w: { product_id: string }) => w.product_id));
      }

      if (setRes.data) {
        setSettings({
          commissionBps: Number(setRes.data.commission_bps),
          holdingPeriodDays: Number(setRes.data.holding_period_days),
          platformWalletCents: Number(setRes.data.platform_wallet_cents),
          maxUploadBytes: Number(setRes.data.max_upload_bytes),
          lastBackupExportAt: setRes.data.last_backup_export_at || undefined,
        });
      }
    } else {
      setCurrentUserId(null);
      const { data: pubProds } = await supabase
        .from('products')
        .select('*, profiles(display_name)')
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (pubProds) {
        setProducts(
          pubProds.map((p: Record<string, unknown>) => ({
            id: String(p.id),
            merchantId: String(p.merchant_id),
            merchantName: String((p.profiles as { display_name?: string } | null)?.display_name || 'Merchant'),
            title: String(p.title),
            titleAr: String(p.title_ar || ''),
            shortTagline: String(p.short_tagline),
            shortTaglineAr: String(p.short_tagline_ar || ''),
            description: String(p.description),
            descriptionAr: String(p.description_ar || ''),
            category: p.category as ProductCategory,
            platform: p.platform as SupportedPlatform,
            version: String(p.current_version),
            fileSizeBytes: Number(p.file_size_bytes),
            priceCents: Number(p.price_cents),
            screenshots: Array.isArray(p.screenshots) ? (p.screenshots as string[]) : [],
            featured: Boolean(p.featured),
            status: p.status as Product['status'],
            salesCount: Number(p.sales_count || 0),
            ratingAvg: Number(p.rating_avg || 0),
            ratingCount: Number(p.rating_count || 0),
            scanStatus: p.scan_status as Product['scanStatus'],
            createdAt: String(p.created_at),
            updatedAt: String(p.updated_at),
          }))
        );
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    refreshSupabaseData();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSupabaseData();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshSupabaseData]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || null,
    [users, currentUserId]
  );

  const invokeEdgeFunction = useCallback(async (fnName: string, body: unknown) => {
    if (!supabase) throw new Error('Supabase client unavailable');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(getEdgeFunctionUrl(fnName), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Server request failed');
    return data;
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string, turnstileToken: string) => {
      if (!turnstileToken) throw new Error('Complete Turnstile human verification first.');
      setAuthBusy(true);
      try {
        if (supabase) {
          const siteKey = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined)?.trim();
          const useCaptcha = Boolean(siteKey && siteKey !== '1x00000000000000000000AA');
          const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
            ...(useCaptcha ? { options: { captchaToken: turnstileToken } } : {}),
          });
          if (error) throw error;
          await refreshSupabaseData();
          return;
        }
        // Preview mode match
        const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (found) {
          if (found.suspended) throw new Error('Account suspended by administrator.');
          setCurrentUserId(found.id);
          setAalLevel(found.mfaEnabled ? 'aal1' : 'aal1');
        } else {
          const newId = `usr-${crypto.randomUUID().slice(0, 8)}`;
          const newProfile: UserProfile = {
            id: newId,
            email: sanitizePlainText(email, 120),
            displayName: sanitizePlainText(email.split('@')[0], 60) || 'Member',
            role: 'buyer',
            roleSelected: false,
            emailVerified: true,
            mfaEnabled: false,
            suspended: false,
            maliciousStrikeCount: 0,
            availableBalanceCents: 0,
            pendingBalanceCents: 0,
            createdAt: new Date().toISOString(),
          };
          setUsers((prev) => [...prev, newProfile]);
          setCurrentUserId(newId);
        }
      } finally {
        setAuthBusy(false);
      }
    },
    [refreshSupabaseData, users]
  );

  const signUpWithEmail = useCallback(
    async (email: string, password: string, displayName: string, turnstileToken: string) => {
      if (!turnstileToken) throw new Error('Complete Turnstile human verification first.');
      setAuthBusy(true);
      try {
        const cleanName = sanitizePlainText(displayName, 80);
        if (supabase) {
          const { data, error } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { display_name: cleanName },
              emailRedirectTo: window.location.origin,
            },
          });
          if (error) throw error;
          return { needsVerification: !data.session };
        }

        const exists = users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (exists) throw new Error('An account with this email already exists.');

        const newId = `usr-${crypto.randomUUID().slice(0, 8)}`;
        const created: UserProfile = {
          id: newId,
          email: sanitizePlainText(email, 120),
          displayName: cleanName,
          role: 'buyer',
          roleSelected: false,
          emailVerified: true,
          mfaEnabled: false,
          suspended: false,
          maliciousStrikeCount: 0,
          availableBalanceCents: 0,
          pendingBalanceCents: 0,
          createdAt: new Date().toISOString(),
        };
        setUsers((prev) => [...prev, created]);
        setCurrentUserId(newId);
        return { needsVerification: false };
      } finally {
        setAuthBusy(false);
      }
    },
    [users]
  );

  const signInWithGoogle = useCallback(async () => {
    if (supabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      return;
    }
    setCurrentUserId('usr-buyer-01');
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserId(null);
    setAalLevel('aal1');
  }, []);

  const selectUserRole = useCallback(
    async (role: 'buyer' | 'merchant') => {
      if (!currentUser) return;
      if (supabase) {
        const { error } = await supabase
          .from('profiles')
          .update({ role, role_selected: true })
          .eq('id', currentUser.id);
        if (error) throw error;
        await refreshSupabaseData();
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === currentUser.id ? { ...u, role, roleSelected: true } : u))
      );
    },
    [currentUser, refreshSupabaseData]
  );

  const switchPreviewUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    setAalLevel('aal1');
  }, []);

  const enrollTotpMfa = useCallback(async () => {
    if (supabase) {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Shaheen Authenticator',
      });
      if (error) throw error;
      return {
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        factorId: data.id,
      };
    }
    // Preview TOTP enrollment
    const secret = 'SHAHEEN7TOTP2FA4KEY';
    const otpUri = `otpauth://totp/ShaheenStore:${encodeURIComponent(currentUser?.email || 'owner')}?secret=${secret}&issuer=ShaheenStore`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="#fff"/><rect x="12" y="12" width="28" height="28" fill="#090E1A"/><rect x="80" y="12" width="28" height="28" fill="#090E1A"/><rect x="12" y="80" width="28" height="28" fill="#090E1A"/><rect x="50" y="50" width="20" height="20" fill="#2563EB"/><rect x="52" y="18" width="16" height="16" fill="#090E1A"/><rect x="84" y="56" width="20" height="20" fill="#090E1A"/><rect x="56" y="86" width="22" height="16" fill="#090E1A"/></svg>`;
    void otpUri;
    return {
      qrCode: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
      secret,
      factorId: 'preview-totp-factor',
    };
  }, [currentUser]);

  const verifyTotpMfa = useCallback(
    async (code: string, factorId?: string) => {
      const clean = code.replace(/\s+/g, '');
      if (!/^\d{6}$/.test(clean)) {
        throw new Error('Enter a valid 6-digit authenticator code.');
      }
      if (supabase) {
        let targetFactor = factorId;
        if (!targetFactor) {
          const { data: factors } = await supabase.auth.mfa.listFactors();
          targetFactor = factors?.totp?.[0]?.id;
        }
        if (!targetFactor) throw new Error('Enroll TOTP 2FA first.');
        const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({
          factorId: targetFactor,
        });
        if (chalErr) throw chalErr;
        const { error: verErr } = await supabase.auth.mfa.verify({
          factorId: targetFactor,
          challengeId: challenge.id,
          code: clean,
        });
        if (verErr) throw verErr;
        setAalLevel('aal2');
        await refreshSupabaseData();
        return;
      }
      if (currentUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === currentUser.id ? { ...u, mfaEnabled: true } : u))
        );
      }
      setAalLevel('aal2');
    },
    [currentUser, refreshSupabaseData]
  );

  const toggleWishlist = useCallback(
    async (productId: string) => {
      const exists = wishlistIds.includes(productId);
      if (supabase && currentUser) {
        if (exists) {
          await supabase
            .from('wishlists')
            .delete()
            .eq('buyer_id', currentUser.id)
            .eq('product_id', productId);
        } else {
          await supabase
            .from('wishlists')
            .insert({ buyer_id: currentUser.id, product_id: productId });
        }
      }
      setWishlistIds((prev) =>
        exists ? prev.filter((id) => id !== productId) : [...prev, productId]
      );
    },
    [currentUser, wishlistIds]
  );

  const confirmOrderInPreview = useCallback(
    (orderId: string, providerTxId: string, actorId: string): Order => {
      let confirmed!: Order;
      setOrders((prevOrders) => {
        const existing = prevOrders.find((o) => o.id === orderId);
        if (!existing) throw new Error('Order not found');
        if (existing.status === 'confirmed') {
          confirmed = existing;
          return prevOrders;
        }

        const commissionCents = Math.floor(
          (existing.grossCents * settings.commissionBps) / 10000
        );
        const merchantNetCents = existing.grossCents - commissionCents;
        const releaseDate = new Date(
          Date.now() + settings.holdingPeriodDays * 86400 * 1000
        ).toISOString();

        confirmed = {
          ...existing,
          commissionBps: settings.commissionBps,
          commissionCents,
          merchantNetCents,
          paymentProviderTxId: providerTxId,
          status: 'confirmed',
          holdingReleaseAt: releaseDate,
          releasedToAvailable: settings.holdingPeriodDays === 0,
          confirmedAt: new Date().toISOString(),
        };

        // Atomic credit to platform wallet & merchant balance
        setSettings((s) => ({
          ...s,
          platformWalletCents: s.platformWalletCents + commissionCents,
        }));
        setUsers((prevUsers) =>
          prevUsers.map((u) => {
            if (u.id !== existing.merchantId) return u;
            return settings.holdingPeriodDays === 0
              ? { ...u, availableBalanceCents: u.availableBalanceCents + merchantNetCents }
              : { ...u, pendingBalanceCents: u.pendingBalanceCents + merchantNetCents };
          })
        );
        setProducts((prevProds) =>
          prevProds.map((p) =>
            p.id === existing.productId ? { ...p, salesCount: p.salesCount + 1 } : p
          )
        );
        setLedger((prevLedger) => [
          {
            id: `led-${crypto.randomUUID().slice(0, 8)}`,
            orderId: existing.id,
            entryType: 'sale_commission',
            actorId,
            actorName: 'Platform Wallet',
            amountCents: commissionCents,
            commissionCents,
            status: 'posted',
            note: `${(settings.commissionBps / 100).toFixed(2)}% commission on ${existing.productTitle}`,
            createdAt: new Date().toISOString(),
          },
          {
            id: `led-${crypto.randomUUID().slice(0, 8)}`,
            orderId: existing.id,
            entryType: 'merchant_credit',
            actorId: existing.merchantId,
            actorName: existing.merchantName,
            amountCents: merchantNetCents,
            commissionCents,
            status: 'posted',
            note: `Merchant earnings (${settings.holdingPeriodDays}d hold)`,
            createdAt: new Date().toISOString(),
          },
          ...prevLedger,
        ]);

        return prevOrders.map((o) => (o.id === orderId ? confirmed : o));
      });
      return confirmed;
    },
    [settings.commissionBps, settings.holdingPeriodDays]
  );

  const createOrder = useCallback(
    async (params: {
      productId: string;
      idempotencyKey: string;
      paymentMethod: string;
      manualTxReference?: string;
      simulateImmediateWebhook?: boolean;
    }) => {
      if (!currentUser) throw new Error('Please sign in before purchasing.');
      if (currentUser.suspended) throw new Error('Account suspended.');

      if (supabase) {
        const res = await invokeEdgeFunction('create-order', params);
        await refreshSupabaseData();
        return res.order as Order;
      }

      // Idempotency guard in preview mode
      const dup = orders.find((o) => o.idempotencyKey === params.idempotencyKey);
      if (dup) return dup;

      const product = products.find((p) => p.id === params.productId);
      if (!product || product.status !== 'approved') {
        throw new Error('Product is not available for purchase.');
      }

      const commissionCents = Math.floor((product.priceCents * settings.commissionBps) / 10000);
      const merchantNetCents = product.priceCents - commissionCents;
      const cleanRef = params.manualTxReference
        ? sanitizePlainText(params.manualTxReference, 140)
        : undefined;

      const newOrder: Order = {
        id: `ord-${crypto.randomUUID().slice(0, 8)}`,
        idempotencyKey: params.idempotencyKey,
        buyerId: currentUser.id,
        buyerEmail: currentUser.email,
        productId: product.id,
        productTitle: product.title,
        merchantId: product.merchantId,
        merchantName: product.merchantName,
        grossCents: product.priceCents,
        commissionCents,
        commissionBps: settings.commissionBps,
        merchantNetCents,
        paymentMethod: sanitizePlainText(params.paymentMethod, 60),
        manualTxReference: cleanRef,
        status: cleanRef ? 'awaiting_verification' : 'pending_payment',
        holdingReleaseAt: new Date(
          Date.now() + settings.holdingPeriodDays * 86400 * 1000
        ).toISOString(),
        releasedToAvailable: false,
        createdAt: new Date().toISOString(),
      };

      setOrders((prev) => [newOrder, ...prev]);

      if (params.simulateImmediateWebhook) {
        return confirmOrderInPreview(
          newOrder.id,
          `WH-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
          currentUser.id
        );
      }

      return newOrder;
    },
    [
      confirmOrderInPreview,
      currentUser,
      invokeEdgeFunction,
      orders,
      products,
      refreshSupabaseData,
      settings.commissionBps,
      settings.holdingPeriodDays,
    ]
  );

  const generateDownloadLink = useCallback(
    async (productId: string) => {
      if (!currentUser) throw new Error('Sign in required.');
      if (supabase) {
        const res = await invokeEdgeFunction('get-download-url', { productId });
        return { url: res.signedUrl as string, filename: res.filename as string };
      }

      const product = products.find((p) => p.id === productId);
      if (!product || product.status === 'removed' || product.scanStatus === 'flagged') {
        throw new Error('This product file has been disabled.');
      }

      const hasPurchase =
        product.merchantId === currentUser.id ||
        currentUser.role === 'admin' ||
        orders.some(
          (o) =>
            o.buyerId === currentUser.id &&
            o.productId === productId &&
            o.status === 'confirmed'
        );

      if (!hasPurchase) {
        throw new Error('Confirmed purchase required before downloading.');
      }

      const safeFilename = sanitizeSafeFilename(`${product.title}_v${product.version}.bin`);
      // Preview mode creates an opaque binary manifest blob (never executing uploaded code)
      const manifestPayload = new Blob(
        [
          `SHAHEEN_STORE_OPAQUE_RELEASE_MANIFEST\n`,
          `PRODUCT_ID=${product.id}\n`,
          `VERSION=${product.version}\n`,
          `STORAGE_KEY=${product.storageKey || 'random-uuid-key'}\n`,
          `SIGNED_EXPIRES_IN=60s\n`,
          `CONTENT_DISPOSITION=attachment\n`,
        ],
        { type: 'application/octet-stream' }
      );
      const blobUrl = URL.createObjectURL(manifestPayload);
      return { url: blobUrl, filename: safeFilename };
    },
    [currentUser, invokeEdgeFunction, orders, products]
  );

  const submitReview = useCallback(
    async (productId: string, rating: number, comment: string) => {
      if (!currentUser) throw new Error('Sign in required.');
      const cleanComment = sanitizeMultilineText(comment, 2000);
      if (cleanComment.length < 3) throw new Error('Review comment is too short.');

      const hasPurchased = orders.some(
        (o) =>
          o.buyerId === currentUser.id &&
          o.productId === productId &&
          o.status === 'confirmed'
      );
      if (!hasPurchased) throw new Error('Only confirmed buyers can submit a review.');

      if (supabase) {
        const { error } = await supabase.from('reviews').insert({
          product_id: productId,
          buyer_id: currentUser.id,
          rating,
          comment: cleanComment,
        });
        if (error) throw error;
        await refreshSupabaseData();
        return;
      }

      const newRev: ProductReview = {
        id: `rev-${crypto.randomUUID().slice(0, 8)}`,
        productId,
        buyerId: currentUser.id,
        buyerName: currentUser.displayName,
        rating,
        comment: cleanComment,
        createdAt: new Date().toISOString(),
      };

      const nextReviews = [newRev, ...reviews];
      setReviews(nextReviews);

      const prodReviews = nextReviews.filter((r) => r.productId === productId);
      const avg =
        prodReviews.reduce((acc, r) => acc + r.rating, 0) / Math.max(1, prodReviews.length);

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId
            ? { ...p, ratingAvg: Number(avg.toFixed(2)), ratingCount: prodReviews.length }
            : p
        )
      );
    },
    [currentUser, orders, refreshSupabaseData, reviews]
  );

  const reportProduct = useCallback(
    async (productId: string, reason: ProductReport['reason'], details: string) => {
      if (!currentUser) throw new Error('Please sign in to report a product.');
      const cleanDetails = sanitizeMultilineText(details, 2000);
      if (cleanDetails.length < 5) throw new Error('Please provide more details.');

      if (supabase) {
        const { error } = await supabase.from('reports').insert({
          product_id: productId,
          reporter_id: currentUser.id,
          reason,
          details: cleanDetails,
        });
        if (error) throw error;
        return;
      }

      const product = products.find((p) => p.id === productId);
      setReports((prev) => [
        {
          id: `rep-${crypto.randomUUID().slice(0, 8)}`,
          productId,
          productTitle: product?.title || 'Product',
          reporterId: currentUser.id,
          reporterEmail: currentUser.email,
          reason,
          details: cleanDetails,
          status: 'open',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [currentUser, products]
  );

  const uploadProduct = useCallback(
    async (payload: UploadProductPayload) => {
      if (!currentUser || (currentUser.role !== 'merchant' && currentUser.role !== 'admin')) {
        throw new Error('Merchant account required.');
      }
      if (currentUser.suspended) throw new Error('Suspended accounts cannot upload products.');
      if (!payload.turnstileToken) throw new Error('Complete Turnstile human verification.');
      if (payload.binaryFile.size <= 0 || payload.binaryFile.size > settings.maxUploadBytes) {
        throw new Error('File must be between 1 byte and 50 MB.');
      }
      if (hasDisallowedOperatorKeys(payload)) {
        throw new Error('Invalid form payload.');
      }

      let sanitizedScreenshotBlob: Blob | null = null;
      let previewScreenshotUrl = '/src/assets/images/product_dev_compiler_suite_1795340506287.jpg';

      if (payload.screenshotFile) {
        sanitizedScreenshotBlob = await stripImageMetadataAndReencode(payload.screenshotFile);
        previewScreenshotUrl = URL.createObjectURL(sanitizedScreenshotBlob);
      }

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const form = new FormData();
        form.append(
          'metadata',
          JSON.stringify({
            title: sanitizePlainText(payload.title, 120),
            titleAr: sanitizePlainText(payload.titleAr, 120),
            shortTagline: sanitizePlainText(payload.shortTagline, 180),
            shortTaglineAr: sanitizePlainText(payload.shortTaglineAr, 180),
            description: sanitizeMultilineText(payload.description, 8000),
            descriptionAr: sanitizeMultilineText(payload.descriptionAr, 8000),
            category: payload.category,
            platform: payload.platform,
            version: sanitizePlainText(payload.version, 32),
            priceDollars: payload.priceDollars,
            turnstileToken: payload.turnstileToken,
          })
        );
        form.append('file', payload.binaryFile);
        if (sanitizedScreenshotBlob) {
          form.append('screenshot', sanitizedScreenshotBlob, 'screenshot.webp');
        }

        const res = await fetch(getEdgeFunctionUrl('merchant-upload'), {
          method: 'POST',
          headers: {
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');
        await refreshSupabaseData();
        return data.product as Product;
      }

      const sha256Hash = await computeSha256Hex(payload.binaryFile);
      const storageKey = `${currentUser.id}/${crypto.randomUUID()}.bin`;
      const newProd: Product = {
        id: `prod-${crypto.randomUUID().slice(0, 8)}`,
        merchantId: currentUser.id,
        merchantName: currentUser.displayName,
        title: sanitizePlainText(payload.title, 120),
        titleAr: sanitizePlainText(payload.titleAr, 120) || sanitizePlainText(payload.title, 120),
        shortTagline: sanitizePlainText(payload.shortTagline, 180),
        shortTaglineAr:
          sanitizePlainText(payload.shortTaglineAr, 180) ||
          sanitizePlainText(payload.shortTagline, 180),
        description: sanitizeMultilineText(payload.description, 8000),
        descriptionAr:
          sanitizeMultilineText(payload.descriptionAr, 8000) ||
          sanitizeMultilineText(payload.description, 8000),
        category: payload.category,
        platform: payload.platform,
        version: sanitizePlainText(payload.version, 32) || '1.0.0',
        fileSizeBytes: payload.binaryFile.size,
        priceCents: Math.round(payload.priceDollars * 100),
        screenshots: [previewScreenshotUrl],
        featured: false,
        status: 'pending_review',
        salesCount: 0,
        ratingAvg: 0,
        ratingCount: 0,
        scanStatus: 'queued',
        storageKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        versions: [
          {
            id: `ver-${crypto.randomUUID().slice(0, 8)}`,
            productId: '',
            versionNumber: sanitizePlainText(payload.version, 32) || '1.0.0',
            changelog: 'Initial upload queued for admin review.',
            fileSizeBytes: payload.binaryFile.size,
            storageKey,
            sha256Hash,
            scanStatus: 'queued',
            createdAt: new Date().toISOString(),
          },
        ],
      };

      setProducts((prev) => [newProd, ...prev]);
      return newProd;
    },
    [currentUser, refreshSupabaseData, settings.maxUploadBytes]
  );

  const pushProductVersion = useCallback(
    async (params: {
      productId: string;
      versionNumber: string;
      changelog: string;
      binaryFile: File;
    }) => {
      if (!currentUser) throw new Error('Sign in required.');
      if (params.binaryFile.size <= 0 || params.binaryFile.size > settings.maxUploadBytes) {
        throw new Error('File must be 50 MB or smaller.');
      }
      const sha = await computeSha256Hex(params.binaryFile);
      const storageKey = `${currentUser.id}/${crypto.randomUUID()}.bin`;
      const cleanVer = sanitizePlainText(params.versionNumber, 32);
      const cleanLog = sanitizePlainText(params.changelog, 400);

      if (supabase) {
        await supabase.storage
          .from('product-files')
          .upload(storageKey, params.binaryFile, { contentType: 'application/octet-stream' });
        await supabase.from('product_versions').insert({
          product_id: params.productId,
          version_number: cleanVer,
          changelog: cleanLog,
          file_size_bytes: params.binaryFile.size,
          storage_key: storageKey,
          sha256_hash: sha,
        });
        await supabase
          .from('products')
          .update({
            current_version: cleanVer,
            file_size_bytes: params.binaryFile.size,
            storage_key: storageKey,
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.productId);
        await refreshSupabaseData();
        return;
      }

      setProducts((prev) =>
        prev.map((p) => {
          if (p.id !== params.productId || p.merchantId !== currentUser.id) return p;
          return {
            ...p,
            version: cleanVer,
            fileSizeBytes: params.binaryFile.size,
            storageKey,
            updatedAt: new Date().toISOString(),
            versions: [
              {
                id: `ver-${crypto.randomUUID().slice(0, 8)}`,
                productId: p.id,
                versionNumber: cleanVer,
                changelog: cleanLog,
                fileSizeBytes: params.binaryFile.size,
                storageKey,
                sha256Hash: sha,
                scanStatus: 'queued',
                createdAt: new Date().toISOString(),
              },
              ...(p.versions || []),
            ],
          };
        })
      );
    },
    [currentUser, refreshSupabaseData, settings.maxUploadBytes]
  );

  const updateProductDetails = useCallback(
    async (
      productId: string,
      updates: { title: string; shortTagline: string; description: string; priceDollars: number }
    ) => {
      if (!currentUser) return;
      const priceCents = Math.round(updates.priceDollars * 100);
      if (priceCents < 100) throw new Error('Minimum price is $1.00');
      const cleanTitle = sanitizePlainText(updates.title, 120);
      const cleanTag = sanitizePlainText(updates.shortTagline, 180);
      const cleanDesc = sanitizeMultilineText(updates.description, 8000);

      if (supabase) {
        const { error } = await supabase
          .from('products')
          .update({
            title: cleanTitle,
            short_tagline: cleanTag,
            description: cleanDesc,
            price_cents: priceCents,
          })
          .eq('id', productId)
          .eq('merchant_id', currentUser.id);
        if (error) throw error;
        await refreshSupabaseData();
        return;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === productId && (p.merchantId === currentUser.id || currentUser.role === 'admin')
            ? {
                ...p,
                title: cleanTitle,
                shortTagline: cleanTag,
                description: cleanDesc,
                priceCents,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
    },
    [currentUser, refreshSupabaseData]
  );

  const deleteProduct = useCallback(
    async (productId: string) => {
      if (!currentUser) return;
      if (supabase) {
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productId)
          .eq('merchant_id', currentUser.id);
        if (error) throw error;
        await refreshSupabaseData();
        return;
      }
      setProducts((prev) =>
        prev.filter(
          (p) => !(p.id === productId && (p.merchantId === currentUser.id || currentUser.role === 'admin'))
        )
      );
    },
    [currentUser, refreshSupabaseData]
  );

  const requestPayout = useCallback(
    async (params: { amountDollars: number; method: WithdrawalMethod; destination: string }) => {
      if (!currentUser) throw new Error('Sign in required.');
      const amountCents = Math.round(params.amountDollars * 100);
      const cleanDest = sanitizePlainText(params.destination, 160);
      if (amountCents < 500 || cleanDest.length < 3) {
        throw new Error('Minimum payout is $5.00 with a valid nsave or PayPal destination.');
      }

      if (supabase) {
        await invokeEdgeFunction('request-payout', {
          amountCents,
          method: params.method,
          destination: cleanDest,
        });
        await refreshSupabaseData();
        return;
      }

      if (currentUser.availableBalanceCents < amountCents) {
        throw new Error('Insufficient available balance (check holding period).');
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === currentUser.id
            ? { ...u, availableBalanceCents: u.availableBalanceCents - amountCents }
            : u
        )
      );
      setPayouts((prev) => [
        {
          id: `pay-${crypto.randomUUID().slice(0, 8)}`,
          merchantId: currentUser.id,
          merchantName: currentUser.displayName,
          amountCents,
          method: params.method,
          destination: cleanDest,
          status: 'pending',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [currentUser, invokeEdgeFunction, refreshSupabaseData]
  );

  // Admin Guard helper for preview mode
  const assertPreviewAdminMfa = useCallback(() => {
    if (!currentUser || currentUser.role !== 'admin') {
      throw new Error('Admin privileges required.');
    }
    if (aalLevel !== 'aal2') {
      throw new Error('Verify TOTP 2FA code first.');
    }
  }, [aalLevel, currentUser]);

  const recordAudit = useCallback(
    (action: string, targetType: string, targetId: string, metadata: Record<string, string | number | boolean> = {}) => {
      if (!currentUser) return;
      setAuditLogs((prev) => [
        {
          id: `aud-${crypto.randomUUID().slice(0, 8)}`,
          actorId: currentUser.id,
          actorEmail: currentUser.email,
          action,
          targetType,
          targetId,
          metadata,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [currentUser]
  );

  const adminApproveProduct = useCallback(
    async (productId: string) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', { action: 'approve_product', productId });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: 'approved', scanStatus: 'clean' } : p))
      );
      recordAudit('approve_product', 'product', productId);
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, recordAudit, refreshSupabaseData]
  );

  const adminRejectProduct = useCallback(
    async (productId: string) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', { action: 'reject_product', productId });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: 'rejected' } : p))
      );
      recordAudit('reject_product', 'product', productId);
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, recordAudit, refreshSupabaseData]
  );

  const adminTakedownProduct = useCallback(
    async (productId: string) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', { action: 'takedown_product', productId });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, status: 'removed' } : p))
      );
      recordAudit('takedown_product', 'product', productId);
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, recordAudit, refreshSupabaseData]
  );

  const adminConfirmMalicious = useCallback(
    async (productId: string, reportId?: string) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'confirm_malicious',
          productId,
          reportId,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      const targetProd = products.find((p) => p.id === productId);
      if (targetProd) {
        setProducts((prev) =>
          prev.map((p) =>
            p.merchantId === targetProd.merchantId
              ? { ...p, status: 'removed', scanStatus: p.id === productId ? 'flagged' : p.scanStatus }
              : p
          )
        );
        setUsers((prev) =>
          prev.map((u) =>
            u.id === targetProd.merchantId
              ? {
                  ...u,
                  suspended: true,
                  maliciousStrikeCount: u.maliciousStrikeCount + 1,
                }
              : u
          )
        );
      }
      if (reportId) {
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, status: 'confirmed_malicious' } : r))
        );
      }
      recordAudit('confirm_malicious_and_suspend', 'product', productId);
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, products, recordAudit, refreshSupabaseData]
  );

  const adminConfirmOrder = useCallback(
    async (orderId: string, providerTxId?: string) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'confirm_manual_order',
          orderId,
          providerTxId,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      confirmOrderInPreview(
        orderId,
        providerTxId || `ADM-${Date.now()}`,
        currentUser!.id
      );
      recordAudit('confirm_manual_order', 'order', orderId);
    },
    [
      assertPreviewAdminMfa,
      confirmOrderInPreview,
      currentUser,
      invokeEdgeFunction,
      recordAudit,
      refreshSupabaseData,
    ]
  );

  const adminRefundOrder = useCallback(
    async (orderId: string, reason: string) => {
      const cleanReason = sanitizePlainText(reason, 400);
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'refund_order',
          orderId,
          reason: cleanReason,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      const order = orders.find((o) => o.id === orderId);
      if (!order || order.status !== 'confirmed') {
        throw new Error('Only confirmed orders can be refunded.');
      }

      setSettings((s) => ({
        ...s,
        platformWalletCents: Math.max(0, s.platformWalletCents - order.commissionCents),
      }));

      setUsers((prevUsers) =>
        prevUsers.map((u) => {
          if (u.id !== order.merchantId) return u;
          const deductPending = Math.min(u.pendingBalanceCents, order.merchantNetCents);
          const deductAvailable = order.merchantNetCents - deductPending;
          return {
            ...u,
            pendingBalanceCents: u.pendingBalanceCents - deductPending,
            availableBalanceCents: Math.max(0, u.availableBalanceCents - deductAvailable),
          };
        })
      );

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: 'refunded' } : o))
      );

      setLedger((prev) => [
        {
          id: `led-${crypto.randomUUID().slice(0, 8)}`,
          orderId,
          entryType: 'order_refund_commission_reversal',
          actorId: currentUser!.id,
          actorName: 'Platform Wallet',
          amountCents: -order.commissionCents,
          commissionCents: -order.commissionCents,
          status: 'reversed',
          note: cleanReason || 'Order refunded by admin',
          createdAt: new Date().toISOString(),
        },
        {
          id: `led-${crypto.randomUUID().slice(0, 8)}`,
          orderId,
          entryType: 'order_refund_merchant_reversal',
          actorId: order.merchantId,
          actorName: order.merchantName,
          amountCents: -order.merchantNetCents,
          commissionCents: 0,
          status: 'reversed',
          note: cleanReason || 'Order refunded by admin',
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);

      recordAudit('refund_order', 'order', orderId, { reason: cleanReason });
    },
    [assertPreviewAdminMfa, currentUser, invokeEdgeFunction, orders, recordAudit, refreshSupabaseData]
  );

  const adminUpdateSettings = useCallback(
    async (commissionBps: number, holdingPeriodDays: number) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'update_settings',
          commissionBps,
          holdingPeriodDays,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      setSettings((s) => ({ ...s, commissionBps, holdingPeriodDays }));
      recordAudit('update_settings', 'platform_settings', '1', {
        commissionBps,
        holdingPeriodDays,
      });
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, recordAudit, refreshSupabaseData]
  );

  const adminToggleSuspendUser = useCallback(
    async (userId: string, suspended: boolean) => {
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'toggle_suspend_user',
          userId,
          suspended,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      if (userId === currentUser?.id) throw new Error('Cannot suspend active admin.');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, suspended } : u)));
      recordAudit(suspended ? 'suspend_user' : 'unsuspend_user', 'profile', userId);
    },
    [assertPreviewAdminMfa, currentUser, invokeEdgeFunction, recordAudit, refreshSupabaseData]
  );

  const adminMarkPayoutPaid = useCallback(
    async (payoutId: string, note: string) => {
      const cleanNote = sanitizePlainText(note, 240);
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'mark_payout_paid',
          payoutId,
          note: cleanNote,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      const target = payouts.find((p) => p.id === payoutId);
      if (!target || target.status !== 'pending') return;

      setPayouts((prev) =>
        prev.map((p) =>
          p.id === payoutId
            ? { ...p, status: 'paid', adminNote: cleanNote, processedAt: new Date().toISOString() }
            : p
        )
      );
      setLedger((prev) => [
        {
          id: `led-${crypto.randomUUID().slice(0, 8)}`,
          payoutId,
          entryType: 'merchant_payout',
          actorId: target.merchantId,
          actorName: target.merchantName,
          amountCents: -target.amountCents,
          commissionCents: 0,
          status: 'posted',
          note: `Paid via ${target.method}: ${cleanNote}`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      recordAudit('mark_payout_paid', 'payout_request', payoutId, { amountCents: target.amountCents });
    },
    [assertPreviewAdminMfa, invokeEdgeFunction, payouts, recordAudit, refreshSupabaseData]
  );

  const adminWithdrawOwnerWallet = useCallback(
    async (
      amountDollars: number,
      method: WithdrawalMethod,
      destination: string,
      note: string
    ) => {
      const amountCents = Math.round(amountDollars * 100);
      const cleanDest = sanitizePlainText(destination, 160);
      const cleanNote = sanitizePlainText(note, 240);
      if (supabase) {
        await invokeEdgeFunction('admin-actions', {
          action: 'withdraw_owner_wallet',
          amountCents,
          method,
          destination: cleanDest,
          note: cleanNote,
        });
        await refreshSupabaseData();
        return;
      }
      assertPreviewAdminMfa();
      if (amountCents <= 0 || settings.platformWalletCents < amountCents) {
        throw new Error('Insufficient platform wallet balance.');
      }

      setSettings((s) => ({
        ...s,
        platformWalletCents: s.platformWalletCents - amountCents,
      }));

      const w: OwnerWithdrawal = {
        id: `ow-${crypto.randomUUID().slice(0, 8)}`,
        amountCents,
        method,
        destination: cleanDest,
        referenceNote: cleanNote,
        createdAt: new Date().toISOString(),
      };
      setOwnerWithdrawals((prev) => [w, ...prev]);
      setLedger((prev) => [
        {
          id: `led-${crypto.randomUUID().slice(0, 8)}`,
          entryType: 'owner_withdrawal',
          actorId: currentUser!.id,
          actorName: 'Platform Owner',
          amountCents: -amountCents,
          commissionCents: 0,
          status: 'posted',
          note: `Owner withdrawal via ${method} (${cleanDest})`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      recordAudit('owner_withdrawal', 'owner_withdrawal', w.id, { amountCents, method });
    },
    [
      assertPreviewAdminMfa,
      currentUser,
      invokeEdgeFunction,
      recordAudit,
      refreshSupabaseData,
      settings.platformWalletCents,
    ]
  );

  const exportDatabaseJson = useCallback(async () => {
    let payload: unknown;
    if (supabase) {
      payload = await invokeEdgeFunction('admin-actions', { action: 'export_backup_json' });
    } else {
      assertPreviewAdminMfa();
      payload = {
        exportedAt: new Date().toISOString(),
        settings,
        users,
        products,
        orders,
        ledger,
        payouts,
        ownerWithdrawals,
        reports,
        auditLogs,
      };
      setSettings((s) => ({ ...s, lastBackupExportAt: new Date().toISOString() }));
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaheen-store-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    assertPreviewAdminMfa,
    auditLogs,
    invokeEdgeFunction,
    ledger,
    orders,
    ownerWithdrawals,
    payouts,
    products,
    reports,
    settings,
    users,
  ]);

  const exportLedgerCsv = useCallback(() => {
    assertPreviewAdminMfa();
    const headers = [
      'ID',
      'Order ID',
      'Type',
      'Actor',
      'Amount (Cents)',
      'Commission (Cents)',
      'Status',
      'Note',
      'Created At',
    ];
    const rows = ledger.map((l) =>
      [
        l.id,
        l.orderId || '',
        l.entryType,
        l.actorName,
        l.amountCents,
        l.commissionCents,
        l.status,
        l.note,
        l.createdAt,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const csv = [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shaheen-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [assertPreviewAdminMfa, ledger]);

  const value: MarketplaceContextValue = {
    lang,
    setLang,
    isSupabaseMode: isSupabaseConfigured,
    currentUser,
    aalLevel,
    users,
    products,
    reviews,
    orders,
    ledger,
    payouts,
    ownerWithdrawals,
    reports,
    auditLogs,
    wishlistIds,
    settings,
    authBusy,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    selectUserRole,
    switchPreviewUser,
    enrollTotpMfa,
    verifyTotpMfa,
    toggleWishlist,
    createOrder,
    generateDownloadLink,
    submitReview,
    reportProduct,
    uploadProduct,
    pushProductVersion,
    updateProductDetails,
    deleteProduct,
    requestPayout,
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
  };

  return <MarketplaceContext.Provider value={value}>{children}</MarketplaceContext.Provider>;
}
