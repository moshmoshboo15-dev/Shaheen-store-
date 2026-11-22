export type Language = 'en' | 'ar';

export type UserRole = 'buyer' | 'merchant' | 'admin';

export type ProductCategory =
  | 'software'
  | 'apk'
  | 'tools'
  | 'scripts'
  | 'assets';

export type SupportedPlatform =
  | 'Windows'
  | 'macOS'
  | 'Linux'
  | 'Android (APK)'
  | 'Cross-Platform'
  | 'Web / Node.js';

export type ProductStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'removed';

export type OrderStatus =
  | 'pending_payment'
  | 'awaiting_verification'
  | 'confirmed'
  | 'refunded'
  | 'failed';

export type PayoutStatus = 'pending' | 'paid' | 'rejected';

export type WithdrawalMethod = 'nsave' | 'paypal';

export type MalwareScanStatus = 'queued' | 'clean' | 'flagged' | 'skipped';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  roleSelected: boolean;
  emailVerified: boolean;
  mfaEnabled: boolean;
  suspended: boolean;
  maliciousStrikeCount: number;
  availableBalanceCents: number;
  pendingBalanceCents: number;
  payoutDestination?: string;
  createdAt: string;
}

export interface ProductVersion {
  id: string;
  productId: string;
  versionNumber: string;
  changelog: string;
  fileSizeBytes: number;
  storageKey: string;
  sha256Hash: string;
  scanStatus: MalwareScanStatus;
  createdAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  buyerId: string;
  buyerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Product {
  id: string;
  merchantId: string;
  merchantName: string;
  title: string;
  titleAr: string;
  shortTagline: string;
  shortTaglineAr: string;
  description: string;
  descriptionAr: string;
  category: ProductCategory;
  platform: SupportedPlatform;
  version: string;
  fileSizeBytes: number;
  priceCents: number;
  screenshots: string[];
  featured: boolean;
  status: ProductStatus;
  salesCount: number;
  ratingAvg: number;
  ratingCount: number;
  scanStatus: MalwareScanStatus;
  storageKey?: string;
  createdAt: string;
  updatedAt: string;
  versions?: ProductVersion[];
}

export interface Order {
  id: string;
  idempotencyKey: string;
  buyerId: string;
  buyerEmail: string;
  productId: string;
  productTitle: string;
  merchantId: string;
  merchantName: string;
  grossCents: number;
  commissionCents: number;
  commissionBps: number;
  merchantNetCents: number;
  paymentMethod: string;
  paymentProviderTxId?: string;
  manualTxReference?: string;
  status: OrderStatus;
  holdingReleaseAt: string;
  releasedToAvailable: boolean;
  createdAt: string;
  confirmedAt?: string;
}

export interface LedgerEntry {
  id: string;
  orderId?: string;
  payoutId?: string;
  entryType:
    | 'sale_commission'
    | 'merchant_credit'
    | 'order_refund_commission_reversal'
    | 'order_refund_merchant_reversal'
    | 'merchant_payout'
    | 'owner_withdrawal';
  actorId: string;
  actorName: string;
  amountCents: number;
  commissionCents: number;
  status: 'posted' | 'reversed';
  note: string;
  createdAt: string;
}

export interface PayoutRequest {
  id: string;
  merchantId: string;
  merchantName: string;
  amountCents: number;
  method: WithdrawalMethod;
  destination: string;
  status: PayoutStatus;
  adminNote?: string;
  createdAt: string;
  processedAt?: string;
}

export interface OwnerWithdrawal {
  id: string;
  amountCents: number;
  method: WithdrawalMethod;
  destination: string;
  referenceNote: string;
  createdAt: string;
}

export interface ProductReport {
  id: string;
  productId: string;
  productTitle: string;
  reporterId: string;
  reporterEmail: string;
  reason: 'malware' | 'copyright' | 'broken_file' | 'misleading' | 'other';
  details: string;
  status: 'open' | 'confirmed_malicious' | 'dismissed';
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface PlatformSettings {
  commissionBps: number; // 250 = 2.5%
  holdingPeriodDays: number;
  platformWalletCents: number;
  maxUploadBytes: number; // 50 MB = 52428800
  lastBackupExportAt?: string;
}

export type ActiveRoute =
  | { page: 'home' }
  | { page: 'product'; productId: string }
  | { page: 'library' }
  | { page: 'wishlist' }
  | { page: 'merchant' }
  | { page: 'admin' }
  | { page: 'account' }
  | { page: 'legal'; doc: 'terms' | 'privacy' | 'refund' | 'contact' }
  | { page: 'deploy-guide' };
