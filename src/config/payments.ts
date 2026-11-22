/**
 * Central Payment Provider Configuration — Shaheen Store
 * Swap providers in this single file without touching checkout or webhook UI logic.
 * Supports:
 *   1. Automatic Webhook Confirmation (e.g., Lemon Squeezy / Paddle / PayTabs / NOWPayments)
 *   2. Universal Manual Confirmation Flow (Buyer submits Transaction ID -> Admin approves)
 * Zero geo-blocking or payment-type restrictions: buyers from any country can pay.
 */

export interface PaymentMethodOption {
  id: string;
  label: string;
  labelAr: string;
  type: 'gateway_checkout' | 'manual_transfer';
  instructions: string;
  instructionsAr: string;
  accountDetails?: string;
}

export const PAYMENT_CONFIG = {
  providerName: import.meta.env.VITE_PAYMENT_PROVIDER || 'manual_and_webhook',
  // Hosted checkout base URL (e.g., Lemon Squeezy / Paddle / PayTabs payment link).
  // Append ?checkout[custom][order_id]=... automatically when set.
  hostedCheckoutBaseUrl: import.meta.env.VITE_PAYMENT_CHECKOUT_URL || '',
  webhookEndpointPath: '/functions/v1/payment-webhook',
  webhookSignatureHeader: 'x-shaheen-signature',
  currency: 'USD',
  globalAccessAllowed: true, // No country or IP restrictions

  availableMethods: [
    {
      id: 'global_card_link',
      label: 'Global Card / Apple Pay / Wallet Link',
      labelAr: 'بطاقة بنكية عالمية / محفظة إلكترونية',
      type: 'gateway_checkout',
      instructions:
        'Complete checkout on the provider page or enter the provider confirmation reference if paying via direct link.',
      instructionsAr:
        'أكمل الدفع عبر رابط مزود الخدمة أو أدخل رقم المرجع بعد إتمام التحويل.',
    },
    {
      id: 'paypal_direct',
      label: 'PayPal Transfer',
      labelAr: 'تحويل PayPal',
      type: 'manual_transfer',
      accountDetails: 'payments@shaheen-store.example',
      instructions:
        'Send the exact USD total to the PayPal address above and submit your PayPal Transaction ID below for instant admin verification.',
      instructionsAr:
        'أرسل المبلغ الإجمالي بالدولار إلى حساب PayPal أعلاه ثم أدخل رقم عملية التحويل للتحقق والموافقة.',
    },
    {
      id: 'nsave_transfer',
      label: 'nsave / International Bank / USD Transfer',
      labelAr: 'تحويل nsave / تحويل دولي بالدولار',
      type: 'manual_transfer',
      accountDetails: 'nsave USD Account · Ref: SHAHEEN-STORE',
      instructions:
        'Transfer from any country using nsave, Wise, or wire transfer and paste your transaction reference ID.',
      instructionsAr:
        'حوّل من أي دولة عبر nsave أو تحويل بنكي دولي وأدخل رقم مرجع الحوالة.',
    },
    {
      id: 'usdt_trc20',
      label: 'USDT (TRC20 / Polygon)',
      labelAr: 'عملة رقمية USDT',
      type: 'manual_transfer',
      accountDetails: 'Configure your wallet address in src/config/payments.ts',
      instructions:
        'Send exact USD value in USDT and paste the on-chain Transaction Hash (TxID).',
      instructionsAr:
        'أرسل القيمة المحددة بعملة USDT وألصق معرّف المعاملة (TxID).',
    },
  ] as PaymentMethodOption[],
} as const;
