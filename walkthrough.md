# Security Summary

**Reviewed Files**: 22
**Issues Resolved**: 2

### Issues Resolved
| Area | File | Line | What Was Happening | Impact | Status | How It Was Fixed |
|---|---|---|---|---|---|---|
| Product Status & Metrics Tampering | `supabase/migrations/001_initial_schema.sql` | 491 | The `products_merchant_or_admin_update` RLS policy allowed merchants to update their product rows without restricting `status`, `featured`, `sales_count`, or `scan_status`. | High | Fixed | Added `guard_product_update()` `BEFORE UPDATE` trigger blocking non-admin edits to protected product status, scan, and metric columns. |
| Direct Client Order Creation | `supabase/migrations/001_initial_schema.sql` | 513 | `orders_buyer_insert_pending` allowed direct PostgREST `INSERT` on `orders` from the client, which could allow client-chosen `gross_cents`. | High | Fixed | Removed direct client `INSERT` policy on `orders`; all orders are created exclusively by the `create-order` Edge Function using authoritative database pricing. |

### Safeguards Verified
| Area | File | How It's Protected |
|---|---|---|
| Secrets & Key Boundaries | `.env.example`, `src/lib/supabase.ts` | Only the public `VITE_SUPABASE_ANON_KEY` is used client-side; `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_WEBHOOK_SECRET`, and `TURNSTILE_SECRET_KEY` remain exclusively in server-side Edge Function secrets. |
| Admin MFA Enforcement | `supabase/functions/admin-actions/index.ts`, `src/components/AdminPanelView.tsx` | Verifies `profile.role === 'admin'` and requires an `aal2` TOTP authenticator session before executing any admin mutation or backup export. |
| Atomic Money & Ledger | `supabase/migrations/001_initial_schema.sql` | Stores all monetary values as integer cents, executes order confirmation, refunds, payouts, and owner withdrawals inside locked Postgres transactions, and records every movement in an immutable append-only `ledger_entries` table. |
| Upload & Malware Protection | `supabase/functions/merchant-upload/index.ts`, `src/lib/sanitize.ts` | Treats product files as opaque binary blobs under random UUID keys (max 50 MB, 10 uploads/hr rate limit), re-encodes screenshots to strip EXIF metadata, verifies image magic bytes, and serves downloads strictly via 60-second signed attachment URLs from Supabase Storage's separate domain. |
| XSS & Injection Defense | `public/_headers`, `src/lib/sanitize.ts`, `src/lib/validation.ts` | Strict Content-Security-Policy, Zod schema validation, NoSQL operator key rejection, CSV formula escaping, and zero use of `dangerouslySetInnerHTML`. |

## PoC Verification

### 1. Merchant Product Approval Bypass via Direct PostgREST Update
#### Summary
| Field | Value |
|---|---|
| Issue Type | Missing Column-Level Protection on RLS Update |
| Impact | High |
| Affected File | `supabase/migrations/001_initial_schema.sql:268` |
| Test Scenario | `PATCH /rest/v1/products?id=eq.<uuid>` with `{ "status": "approved", "scan_status": "clean" }` authenticated as the product's merchant |

#### How It Was Fixed
Added a `BEFORE UPDATE` trigger (`guard_product_update()`) that inspects `auth.uid()` and raises an exception whenever a non-admin caller modifies `status`, `featured`, `sales_count`, `rating_avg`, `rating_count`, `scan_status`, or `merchant_id`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Merchant sends `PATCH` to PostgREST `products` with `status: "approved"` | RLS `USING (merchant_id = auth.uid())` matches |
| 2 | Postgres fires `trg_guard_product_update` -> `guard_product_update()` | `NOT public.is_admin()` evaluates true and `NEW.status IS DISTINCT FROM OLD.status` matches |
| 3 | Trigger executes `RAISE EXCEPTION` | **Transaction Rolled Back (400/403)** |

#### Conclusion
**Fix Verified** - Merchants can edit titles, descriptions, and prices, while product approval, featuring, and security scan statuses remain strictly under Admin/Edge Function control.

---

### 2. Client-Side Order Price Forgery via Direct `orders` Insert
#### Summary
| Field | Value |
|---|---|
| Issue Type | Permissive Client Table Insert Policy |
| Impact | High |
| Affected File | `supabase/migrations/001_initial_schema.sql:505` |
| Test Scenario | `POST /rest/v1/orders` with `{ "buyer_id": "<uid>", "gross_cents": 100, "status": "pending_payment" }` for a `$49.00` product |

#### How It Was Fixed
Removed the `orders_buyer_insert_pending` RLS policy so clients have `SELECT`-only access to `orders`. Order creation runs exclusively through the `create-order` Edge Function (`service_role`), which fetches `price_cents` directly from `products`.

#### Step-by-Step Trace
| Step | What Happens in the Code | Outcome |
|---|---|---|
| 1 | Untrusted client calls `POST /rest/v1/orders` with forged `gross_cents: 100` | Request hits RLS on `public.orders` |
| 2 | No `INSERT` policy exists for `authenticated` role | Postgres denies insert under default-deny RLS |
| 3 | Legitimate client calls `/functions/v1/create-order` | Edge Function queries authoritative `products.price_cents` and creates idempotent order |

#### Conclusion
**Fix Verified** - Order totals and commission splits can never be forged by client payloads.
