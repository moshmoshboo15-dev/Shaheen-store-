import { useState, type FormEvent } from 'react';
import { X, ShieldCheck, KeyRound, UserCheck, Store, ShoppingBag } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { TRANSLATIONS } from '../i18n/translations';
import { TurnstileWidget } from './TurnstileWidget';
import { authSignInSchema, authSignUpSchema } from '../lib/validation';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const {
    lang,
    isSupabaseMode,
    currentUser,
    aalLevel,
    users,
    authBusy,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signOut,
    selectUserRole,
    switchPreviewUser,
    enrollTotpMfa,
    verifyTotpMfa,
  } = useMarketplace();

  const t = TRANSLATIONS[lang].auth;
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // TOTP enrollment state
  const [totpSetup, setTotpSetup] = useState<{
    qrCode: string;
    secret: string;
    factorId: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');
    try {
      if (mode === 'signup') {
        const parsed = authSignUpSchema.safeParse({
          email,
          password,
          displayName,
          turnstileToken,
        });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message || 'Check your registration fields.');
          return;
        }
        const res = await signUpWithEmail(email, password, displayName, turnstileToken);
        if (res.needsVerification) {
          setInfoMsg(
            lang === 'ar'
              ? 'تم إرسال رابط تأكيد البريد الإلكتروني. تحقق من بريدك قبل تسجيل الدخول.'
              : 'Verification email sent. Please confirm your email address to activate your account.'
          );
        }
      } else {
        const parsed = authSignInSchema.safeParse({ email, password, turnstileToken });
        if (!parsed.success) {
          setErrorMsg(parsed.error.issues[0]?.message || 'Check your sign-in credentials.');
          return;
        }
        await signInWithEmail(email, password, turnstileToken);
        onClose();
      }
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleEnrollMfa = async () => {
    setErrorMsg('');
    try {
      const data = await enrollTotpMfa();
      setTotpSetup(data);
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  const handleVerifyTotp = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      await verifyTotpMfa(totpCode, totpSetup?.factorId);
      setTotpSetup(null);
      setTotpCode('');
      setInfoMsg(
        lang === 'ar' ? 'تم تفعيل وتأكيد التحقق الثنائي TOTP (AAL2).' : 'TOTP 2FA verified (AAL2 active).'
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-800 bg-[#111827] p-6 text-slate-100">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close modal"
          className="absolute top-4 end-4 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step A: Post-Registration Role Selection if user hasn't picked Buyer/Merchant yet */}
        {currentUser && !currentUser.roleSelected ? (
          <div className="space-y-5">
            <div>
              <h2 className="font-display text-xl font-bold text-white">{t.chooseRoleTitle}</h2>
              <p className="mt-1 text-sm text-slate-400">{t.chooseRoleSubtitle}</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={async () => {
                  await selectUserRole('buyer');
                  onClose();
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-[#090E1A] p-4 text-start hover:border-blue-500 transition-colors"
              >
                <ShoppingBag className="h-5 w-5 text-blue-400" />
                <span className="font-semibold text-white">{t.roleBuyer}</span>
                <span className="text-xs text-slate-400">{t.roleBuyerDesc}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  await selectUserRole('merchant');
                  onClose();
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-slate-700 bg-[#090E1A] p-4 text-start hover:border-amber-400 transition-colors"
              >
                <Store className="h-5 w-5 text-amber-400" />
                <span className="font-semibold text-white">{t.roleMerchant}</span>
                <span className="text-xs text-slate-400">{t.roleMerchantDesc}</span>
              </button>
            </div>
          </div>
        ) : currentUser ? (
          /* Step B: Signed-In Account & TOTP Security Center */
          <div className="space-y-6">
            <div>
              <h2 className="font-display text-xl font-bold text-white">{currentUser.displayName}</h2>
              <p className="mt-1 text-xs text-slate-400 font-mono">
                {currentUser.email} · {currentUser.role.toUpperCase()} · {aalLevel.toUpperCase()}
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {infoMsg}
              </div>
            )}

            {/* TOTP Two-Factor Authentication Section */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-white">
                    {lang === 'ar' ? 'التحقق الثنائي (TOTP 2FA)' : 'TOTP Two-Factor Authentication'}
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  {aalLevel === 'aal2'
                    ? 'AAL2 Verified'
                    : currentUser.mfaEnabled
                    ? 'Enrolled (Verify Code)'
                    : 'Not Enrolled'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {lang === 'ar'
                  ? 'إلزامي لحساب المالك، وموصى به للتجار قبل طلبات السحب.'
                  : 'Mandatory for Admin/Owner operations and recommended for Merchants.'}
              </p>

              {!totpSetup && aalLevel !== 'aal2' && (
                <div className="flex flex-wrap gap-2">
                  {!currentUser.mfaEnabled && (
                    <button
                      type="button"
                      onClick={handleEnrollMfa}
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
                    >
                      {lang === 'ar' ? 'إعداد تطبيق المصادقة TOTP' : 'Setup TOTP Authenticator'}
                    </button>
                  )}
                </div>
              )}

              {totpSetup && (
                <div className="space-y-3 rounded-xl border border-slate-800 bg-[#090E1A] p-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={totpSetup.qrCode}
                      alt="TOTP Authenticator QR Code"
                      className="h-24 w-24 rounded-lg bg-white p-1"
                    />
                    <div className="text-xs space-y-1">
                      <p className="text-slate-300">
                        {lang === 'ar'
                          ? 'امسح الرمز بتطبيق Google Authenticator أو Authy:'
                          : 'Scan with Google Authenticator or 2FAS:'}
                      </p>
                      <p className="font-mono text-amber-300 break-all">{totpSetup.secret}</p>
                    </div>
                  </div>
                </div>
              )}

              {(totpSetup || (currentUser.mfaEnabled && aalLevel !== 'aal2')) && (
                <form onSubmit={handleVerifyTotp} className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    placeholder="6-digit TOTP code"
                    className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm font-mono text-white focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 transition-colors"
                  >
                    {lang === 'ar' ? 'تحقق' : 'Verify'}
                  </button>
                </form>
              )}
            </div>

            {/* Preview Quick Role Switcher when Supabase env keys are not yet connected */}
            {!isSupabaseMode && (
              <div className="space-y-2 border-t border-slate-800 pt-4">
                <p className="text-xs font-medium text-slate-400">{t.previewQuickRoles}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchPreviewUser(u.id);
                        onClose();
                      }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs transition-colors ${
                        u.id === currentUser.id
                          ? 'border-blue-500 bg-blue-500/15 text-white'
                          : 'border-slate-800 bg-[#090E1A] text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <span className="truncate font-medium">{u.displayName}</span>
                      <span className="font-mono text-[11px] text-amber-400 uppercase ms-2">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  onClose();
                }}
                className="rounded-lg border border-red-500/40 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10 transition-colors"
              >
                {lang === 'ar' ? 'تسجيل الخروج' : 'Sign Out'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 transition-colors"
              >
                {lang === 'ar' ? 'إغلاق' : 'Done'}
              </button>
            </div>
          </div>
        ) : (
          /* Step C: Sign In / Sign Up Form */
          <div className="space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setErrorMsg('');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'signin'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.signInTitle}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setErrorMsg('');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  mode === 'signup'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {t.signUpTitle}
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                {infoMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.displayName}
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.email}
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {t.password}
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-[#090E1A] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <TurnstileWidget lang={lang} onVerify={setTurnstileToken} />

              <button
                type="submit"
                disabled={authBusy}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
              >
                {authBusy
                  ? '...'
                  : mode === 'signin'
                  ? t.signInTitle
                  : t.signUpTitle}
              </button>
            </form>

            <div className="relative flex items-center justify-center py-1">
              <div className="h-px w-full bg-slate-800" />
              <span className="bg-[#111827] px-3 text-[11px] text-slate-500 uppercase">OR</span>
              <div className="h-px w-full bg-slate-800" />
            </div>

            <button
              type="button"
              onClick={async () => {
                await signInWithGoogle();
                if (!isSupabaseMode) onClose();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-[#090E1A] py-2.5 text-xs font-semibold text-slate-200 hover:border-slate-500 transition-colors"
            >
              <UserCheck className="h-4 w-4 text-amber-400" />
              <span>{t.continueGoogle}</span>
            </button>

            {!isSupabaseMode && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                  <span>{t.previewQuickRoles}</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {users.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        switchPreviewUser(u.id);
                        onClose();
                      }}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#090E1A] px-2.5 py-2 text-xs text-slate-300 hover:border-blue-500 transition-colors"
                    >
                      <span className="truncate">{u.displayName}</span>
                      <span className="font-mono text-[10px] text-amber-400 uppercase">
                        {u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
