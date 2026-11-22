-- ==============================================================================
-- Shaheen Store — Complete Postgres Schema, Atomic Transactions & RLS Policies
-- 100% Supabase Free Tier Compatible
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. ENUMS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('buyer', 'merchant', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_category AS ENUM ('software', 'apk', 'tools', 'scripts', 'assets');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('pending_review', 'approved', 'rejected', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('pending_payment', 'awaiting_verification', 'confirmed', 'refunded', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'paid', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE withdrawal_method AS ENUM ('nsave', 'paypal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE malware_scan_status AS ENUM ('queued', 'clean', 'flagged', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------------------------
-- 2. TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  display_name text NOT NULL CHECK (char_length(display_name) BETWEEN 2 AND 80),
  role user_role NOT NULL DEFAULT 'buyer',
  role_selected boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  malicious_strike_count integer NOT NULL DEFAULT 0 CHECK (malicious_strike_count >= 0),
  available_balance_cents bigint NOT NULL DEFAULT 0 CHECK (available_balance_cents >= 0),
  pending_balance_cents bigint NOT NULL DEFAULT 0 CHECK (pending_balance_cents >= 0),
  payout_destination text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  commission_bps integer NOT NULL DEFAULT 250 CHECK (commission_bps BETWEEN 0 AND 5000), -- 250 = 2.5%
  holding_period_days integer NOT NULL DEFAULT 7 CHECK (holding_period_days BETWEEN 0 AND 90),
  platform_wallet_cents bigint NOT NULL DEFAULT 0 CHECK (platform_wallet_cents >= 0),
  max_upload_bytes bigint NOT NULL DEFAULT 52428800 CHECK (max_upload_bytes > 0 AND max_upload_bytes <= 52428800), -- 50 MB free tier limit
  last_backup_export_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.platform_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  title_ar text NOT NULL DEFAULT '',
  short_tagline text NOT NULL CHECK (char_length(short_tagline) BETWEEN 5 AND 180),
  short_tagline_ar text NOT NULL DEFAULT '',
  description text NOT NULL CHECK (char_length(description) BETWEEN 20 AND 8000),
  description_ar text NOT NULL DEFAULT '',
  category product_category NOT NULL,
  platform text NOT NULL CHECK (char_length(platform) BETWEEN 2 AND 40),
  current_version text NOT NULL CHECK (char_length(current_version) BETWEEN 1 AND 32),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
  price_cents bigint NOT NULL CHECK (price_cents >= 100 AND price_cents <= 100000000), -- min $1.00
  screenshots text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  status product_status NOT NULL DEFAULT 'pending_review',
  sales_count integer NOT NULL DEFAULT 0 CHECK (sales_count >= 0),
  rating_avg numeric(3, 2) NOT NULL DEFAULT 0,
  rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  scan_status malware_scan_status NOT NULL DEFAULT 'queued',
  storage_key text NOT NULL, -- Random UUID object key inside private product-files bucket
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_number text NOT NULL CHECK (char_length(version_number) BETWEEN 1 AND 32),
  changelog text NOT NULL DEFAULT '',
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 52428800),
  storage_key text NOT NULL,
  sha256_hash text NOT NULL,
  scan_status malware_scan_status NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  gross_cents bigint NOT NULL CHECK (gross_cents > 0),
  commission_cents bigint NOT NULL CHECK (commission_cents >= 0),
  commission_bps integer NOT NULL CHECK (commission_bps BETWEEN 0 AND 5000),
  merchant_net_cents bigint NOT NULL CHECK (merchant_net_cents >= 0 AND gross_cents = commission_cents + merchant_net_cents),
  payment_method text NOT NULL,
  payment_provider_tx_id text,
  manual_tx_reference text,
  status order_status NOT NULL DEFAULT 'pending_payment',
  holding_release_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  released_to_available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_provider_tx_unique
  ON public.orders (payment_provider_tx_id)
  WHERE payment_provider_tx_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE RESTRICT,
  payout_id uuid,
  entry_type text NOT NULL CHECK (entry_type IN (
    'sale_commission',
    'merchant_credit',
    'order_refund_commission_reversal',
    'order_refund_merchant_reversal',
    'merchant_payout',
    'owner_withdrawal'
  )),
  actor_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL,
  commission_cents bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'reversed')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 500), -- min $5.00 payout
  method withdrawal_method NOT NULL,
  destination text NOT NULL CHECK (char_length(destination) BETWEEN 3 AND 160),
  status payout_status NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.owner_withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  method withdrawal_method NOT NULL,
  destination text NOT NULL CHECK (char_length(destination) BETWEEN 3 AND 160),
  reference_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(comment) BETWEEN 3 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, buyer_id)
);

CREATE TABLE IF NOT EXISTS public.wishlists (
  buyer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (buyer_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('malware', 'copyright', 'broken_file', 'misleading', 'other')),
  details text NOT NULL CHECK (char_length(details) BETWEEN 5 AND 2000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed_malicious', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.upload_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  storage_key text NOT NULL,
  file_size_bytes bigint NOT NULL,
  sha256_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.malware_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_key text NOT NULL,
  sha256_hash text NOT NULL,
  provider text NOT NULL DEFAULT 'virustotal',
  status malware_scan_status NOT NULL DEFAULT 'queued',
  positives integer NOT NULL DEFAULT 0,
  total_engines integer NOT NULL DEFAULT 0,
  scanned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rate_limits (
  rate_key text PRIMARY KEY,
  hit_count integer NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. HELPER FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND suspended = false
  );
$$;

-- Create profile row automatically when a new user registers via Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role, role_selected)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'display_name'), ''), split_part(COALESCE(NEW.email, 'user'), '@', 1)),
    'buyer',
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Guard sensitive profile columns from client-side PostgREST tampering
CREATE OR REPLACE FUNCTION public.guard_profile_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    -- Users may only pick 'buyer' or 'merchant' ONCE when role_selected is false
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      IF OLD.role_selected = true OR NEW.role NOT IN ('buyer', 'merchant') THEN
        RAISE EXCEPTION 'Role modification forbidden';
      END IF;
    END IF;
    -- Never allow non-admins to mutate balances, strikes, or suspension status directly
    IF NEW.available_balance_cents IS DISTINCT FROM OLD.available_balance_cents
       OR NEW.pending_balance_cents IS DISTINCT FROM OLD.pending_balance_cents
       OR NEW.suspended IS DISTINCT FROM OLD.suspended
       OR NEW.malicious_strike_count IS DISTINCT FROM OLD.malicious_strike_count THEN
      RAISE EXCEPTION 'Protected financial or security column cannot be modified directly';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_update ON public.profiles;
CREATE TRIGGER trg_guard_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_update();

-- Guard privileged product status/metrics columns from direct client PostgREST tampering
CREATE OR REPLACE FUNCTION public.guard_product_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.featured IS DISTINCT FROM OLD.featured
       OR NEW.sales_count IS DISTINCT FROM OLD.sales_count
       OR NEW.rating_avg IS DISTINCT FROM OLD.rating_avg
       OR NEW.rating_count IS DISTINCT FROM OLD.rating_count
       OR NEW.scan_status IS DISTINCT FROM OLD.scan_status
       OR NEW.merchant_id IS DISTINCT FROM OLD.merchant_id THEN
      RAISE EXCEPTION 'Protected product status or metric column cannot be modified by merchant';
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_product_update ON public.products;
CREATE TRIGGER trg_guard_product_update
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_product_update();

-- Update product rating aggregates on review insert/update/delete
CREATE OR REPLACE FUNCTION public.refresh_product_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pid uuid;
BEGIN
  v_pid := COALESCE(NEW.product_id, OLD.product_id);
  UPDATE public.products
  SET
    rating_avg = COALESCE((SELECT round(avg(rating)::numeric, 2) FROM public.reviews WHERE product_id = v_pid), 0),
    rating_count = (SELECT count(*) FROM public.reviews WHERE product_id = v_pid),
    updated_at = now()
  WHERE id = v_pid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_product_rating ON public.reviews;
CREATE TRIGGER trg_refresh_product_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.refresh_product_rating();

-- ------------------------------------------------------------------------------
-- 4. ATOMIC FINANCIAL & RATE-LIMIT FUNCTIONS (Invoked strictly by Edge Functions)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  p_key text,
  p_window_seconds integer,
  p_max_hits integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.rate_limits%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.rate_limits WHERE rate_key = p_key FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.rate_limits (rate_key, hit_count, window_start)
    VALUES (p_key, 1, now());
    RETURN true;
  END IF;

  IF v_row.window_start + make_interval(secs => p_window_seconds) < now() THEN
    UPDATE public.rate_limits
    SET hit_count = 1, window_start = now()
    WHERE rate_key = p_key;
    RETURN true;
  END IF;

  IF v_row.hit_count >= p_max_hits THEN
    RETURN false;
  END IF;

  UPDATE public.rate_limits
  SET hit_count = hit_count + 1
  WHERE rate_key = p_key;
  RETURN true;
END;
$$;

-- Atomic order confirmation (idempotent)
CREATE OR REPLACE FUNCTION public.confirm_order_atomic(
  p_order_id uuid,
  p_provider_tx_id text,
  p_actor_id uuid
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_settings public.platform_settings%ROWTYPE;
  v_commission bigint;
  v_merchant_net bigint;
  v_release_at timestamptz;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Idempotency check: if already confirmed, return existing row without double-crediting
  IF v_order.status = 'confirmed' THEN
    RETURN v_order;
  END IF;

  IF v_order.status NOT IN ('pending_payment', 'awaiting_verification') THEN
    RAISE EXCEPTION 'Order cannot be confirmed from status %', v_order.status;
  END IF;

  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1 FOR UPDATE;

  -- Compute integer cents commission cleanly
  v_commission := (v_order.gross_cents * v_settings.commission_bps) / 10000;
  v_merchant_net := v_order.gross_cents - v_commission;
  v_release_at := now() + make_interval(days => v_settings.holding_period_days);

  UPDATE public.orders
  SET
    status = 'confirmed',
    commission_bps = v_settings.commission_bps,
    commission_cents = v_commission,
    merchant_net_cents = v_merchant_net,
    payment_provider_tx_id = COALESCE(NULLIF(p_provider_tx_id, ''), payment_provider_tx_id),
    holding_release_at = v_release_at,
    released_to_available = (v_settings.holding_period_days = 0),
    confirmed_at = now()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  -- Credit platform owner wallet
  UPDATE public.platform_settings
  SET platform_wallet_cents = platform_wallet_cents + v_commission,
      updated_at = now()
  WHERE id = 1;

  -- Credit merchant pending (or available if holding period is 0)
  IF v_settings.holding_period_days = 0 THEN
    UPDATE public.profiles
    SET available_balance_cents = available_balance_cents + v_merchant_net
    WHERE id = v_order.merchant_id;
  ELSE
    UPDATE public.profiles
    SET pending_balance_cents = pending_balance_cents + v_merchant_net
    WHERE id = v_order.merchant_id;
  END IF;

  -- Increment product sales counter
  UPDATE public.products
  SET sales_count = sales_count + 1
  WHERE id = v_order.product_id;

  -- Append immutable ledger entries
  INSERT INTO public.ledger_entries (order_id, entry_type, actor_id, amount_cents, commission_cents, status, note)
  VALUES
    (v_order.id, 'sale_commission', p_actor_id, v_commission, v_commission, 'posted', 'Platform commission credited'),
    (v_order.id, 'merchant_credit', v_order.merchant_id, v_merchant_net, v_commission, 'posted', 'Merchant net earnings credited');

  RETURN v_order;
END;
$$;

-- Atomic order refund reversing owner wallet + merchant balance + ledger
CREATE OR REPLACE FUNCTION public.refund_order_atomic(
  p_order_id uuid,
  p_admin_id uuid,
  p_reason text
)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_merchant public.profiles%ROWTYPE;
  v_deduct_pending bigint;
  v_deduct_available bigint;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status = 'refunded' THEN
    RETURN v_order;
  END IF;

  IF v_order.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed orders can be refunded';
  END IF;

  SELECT * INTO v_merchant FROM public.profiles WHERE id = v_order.merchant_id FOR UPDATE;

  -- Reverse platform commission
  UPDATE public.platform_settings
  SET platform_wallet_cents = GREATEST(0, platform_wallet_cents - v_order.commission_cents),
      updated_at = now()
  WHERE id = 1;

  -- Reverse merchant net from pending first, then available
  v_deduct_pending := LEAST(v_merchant.pending_balance_cents, v_order.merchant_net_cents);
  v_deduct_available := v_order.merchant_net_cents - v_deduct_pending;

  IF v_merchant.available_balance_cents < v_deduct_available THEN
    RAISE EXCEPTION 'Insufficient merchant balance to cover refund';
  END IF;

  UPDATE public.profiles
  SET
    pending_balance_cents = pending_balance_cents - v_deduct_pending,
    available_balance_cents = available_balance_cents - v_deduct_available
  WHERE id = v_order.merchant_id;

  UPDATE public.orders
  SET status = 'refunded'
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO public.ledger_entries (order_id, entry_type, actor_id, amount_cents, commission_cents, status, note)
  VALUES
    (v_order.id, 'order_refund_commission_reversal', p_admin_id, -v_order.commission_cents, -v_order.commission_cents, 'reversed', COALESCE(p_reason, 'Admin order refund')),
    (v_order.id, 'order_refund_merchant_reversal', v_order.merchant_id, -v_order.merchant_net_cents, 0, 'reversed', COALESCE(p_reason, 'Admin order refund'));

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, metadata)
  SELECT id, email, 'refund_order', 'order', v_order.id::text, jsonb_build_object('reason', COALESCE(p_reason, ''), 'gross_cents', v_order.gross_cents)
  FROM public.profiles WHERE id = p_admin_id;

  RETURN v_order;
END;
$$;

-- Mature holding-period balances for a merchant
CREATE OR REPLACE FUNCTION public.mature_merchant_balances(p_merchant_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_matured bigint := 0;
BEGIN
  SELECT COALESCE(SUM(merchant_net_cents), 0) INTO v_matured
  FROM public.orders
  WHERE merchant_id = p_merchant_id
    AND status = 'confirmed'
    AND released_to_available = false
    AND holding_release_at <= now();

  IF v_matured > 0 THEN
    UPDATE public.orders
    SET released_to_available = true
    WHERE merchant_id = p_merchant_id
      AND status = 'confirmed'
      AND released_to_available = false
      AND holding_release_at <= now();

    UPDATE public.profiles
    SET
      pending_balance_cents = GREATEST(0, pending_balance_cents - v_matured),
      available_balance_cents = available_balance_cents + v_matured
    WHERE id = p_merchant_id;
  END IF;

  RETURN v_matured;
END;
$$;

-- Atomic merchant payout request
CREATE OR REPLACE FUNCTION public.request_merchant_payout_atomic(
  p_merchant_id uuid,
  p_amount_cents bigint,
  p_method withdrawal_method,
  p_destination text
)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_payout public.payout_requests%ROWTYPE;
BEGIN
  PERFORM public.mature_merchant_balances(p_merchant_id);

  SELECT * INTO v_profile FROM public.profiles WHERE id = p_merchant_id FOR UPDATE;
  IF NOT FOUND OR v_profile.suspended THEN
    RAISE EXCEPTION 'Merchant account unavailable';
  END IF;

  IF p_amount_cents < 500 OR v_profile.available_balance_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient available balance (minimum $5.00)';
  END IF;

  UPDATE public.profiles
  SET available_balance_cents = available_balance_cents - p_amount_cents
  WHERE id = p_merchant_id;

  INSERT INTO public.payout_requests (merchant_id, amount_cents, method, destination, status)
  VALUES (p_merchant_id, p_amount_cents, p_method, p_destination, 'pending')
  RETURNING * INTO v_payout;

  RETURN v_payout;
END;
$$;

-- Atomic admin mark payout paid
CREATE OR REPLACE FUNCTION public.mark_payout_paid_atomic(
  p_payout_id uuid,
  p_admin_id uuid,
  p_note text
)
RETURNS public.payout_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payout public.payout_requests%ROWTYPE;
BEGIN
  SELECT * INTO v_payout FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout request not found';
  END IF;
  IF v_payout.status <> 'pending' THEN
    RETURN v_payout;
  END IF;

  UPDATE public.payout_requests
  SET status = 'paid', admin_note = p_note, processed_at = now()
  WHERE id = p_payout_id
  RETURNING * INTO v_payout;

  INSERT INTO public.ledger_entries (payout_id, entry_type, actor_id, amount_cents, commission_cents, status, note)
  VALUES (v_payout.id, 'merchant_payout', v_payout.merchant_id, -v_payout.amount_cents, 0, 'posted', COALESCE(p_note, 'Payout marked paid'));

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, metadata)
  SELECT id, email, 'mark_payout_paid', 'payout_request', v_payout.id::text, jsonb_build_object('amount_cents', v_payout.amount_cents, 'method', v_payout.method)
  FROM public.profiles WHERE id = p_admin_id;

  RETURN v_payout;
END;
$$;

-- Atomic owner withdrawal (nsave / PayPal)
CREATE OR REPLACE FUNCTION public.withdraw_owner_wallet_atomic(
  p_admin_id uuid,
  p_amount_cents bigint,
  p_method withdrawal_method,
  p_destination text,
  p_note text
)
RETURNS public.owner_withdrawals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.platform_settings%ROWTYPE;
  v_withdrawal public.owner_withdrawals%ROWTYPE;
BEGIN
  SELECT * INTO v_settings FROM public.platform_settings WHERE id = 1 FOR UPDATE;
  IF p_amount_cents <= 0 OR v_settings.platform_wallet_cents < p_amount_cents THEN
    RAISE EXCEPTION 'Insufficient platform wallet balance';
  END IF;

  UPDATE public.platform_settings
  SET platform_wallet_cents = platform_wallet_cents - p_amount_cents,
      updated_at = now()
  WHERE id = 1;

  INSERT INTO public.owner_withdrawals (admin_id, amount_cents, method, destination, reference_note)
  VALUES (p_admin_id, p_amount_cents, p_method, p_destination, COALESCE(p_note, ''))
  RETURNING * INTO v_withdrawal;

  INSERT INTO public.ledger_entries (entry_type, actor_id, amount_cents, commission_cents, status, note)
  VALUES ('owner_withdrawal', p_admin_id, -p_amount_cents, 0, 'posted', 'Owner withdrawal via ' || p_method::text);

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, metadata)
  SELECT id, email, 'owner_withdrawal', 'owner_withdrawal', v_withdrawal.id::text, jsonb_build_object('amount_cents', p_amount_cents, 'method', p_method)
  FROM public.profiles WHERE id = p_admin_id;

  RETURN v_withdrawal;
END;
$$;

-- Atomic confirmed malicious takedown + automatic merchant suspension
CREATE OR REPLACE FUNCTION public.confirm_malicious_product_atomic(
  p_product_id uuid,
  p_admin_id uuid,
  p_report_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant_id uuid;
BEGIN
  UPDATE public.products
  SET status = 'removed', scan_status = 'flagged', updated_at = now()
  WHERE id = p_product_id
  RETURNING merchant_id INTO v_merchant_id;

  IF v_merchant_id IS NOT NULL THEN
    -- Automatically suspend merchant and remove all active listings on confirmed malicious upload
    UPDATE public.profiles
    SET malicious_strike_count = malicious_strike_count + 1,
        suspended = true
    WHERE id = v_merchant_id;

    UPDATE public.products
    SET status = 'removed', updated_at = now()
    WHERE merchant_id = v_merchant_id;
  END IF;

  IF p_report_id IS NOT NULL THEN
    UPDATE public.reports SET status = 'confirmed_malicious' WHERE id = p_report_id;
  END IF;

  INSERT INTO public.audit_logs (actor_id, actor_email, action, target_type, target_id, metadata)
  SELECT id, email, 'confirm_malicious_and_suspend', 'product', p_product_id::text, jsonb_build_object('merchant_id', v_merchant_id)
  FROM public.profiles WHERE id = p_admin_id;
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (Least-Privilege Policies on Every Table)
-- ------------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.malware_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- PROFILES
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "profiles_update_own_non_privileged" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_admin())
  WITH CHECK (auth.uid() = id OR public.is_admin());

-- PLATFORM SETTINGS (Public can read non-sensitive fee/limit rates; only admin updates)
CREATE POLICY "settings_select_all" ON public.platform_settings
  FOR SELECT USING (true);

CREATE POLICY "settings_admin_update" ON public.platform_settings
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- PRODUCTS (Approved products public; merchants see their own; admin sees all)
CREATE POLICY "products_select_policy" ON public.products
  FOR SELECT USING (
    status = 'approved'
    OR merchant_id = auth.uid()
    OR public.is_admin()
  );

CREATE POLICY "products_merchant_insert" ON public.products
  FOR INSERT WITH CHECK (
    merchant_id = auth.uid()
    AND status = 'pending_review'
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'merchant' AND suspended = false
    )
  );

CREATE POLICY "products_merchant_or_admin_update" ON public.products
  FOR UPDATE USING (merchant_id = auth.uid() OR public.is_admin())
  WITH CHECK (merchant_id = auth.uid() OR public.is_admin());

CREATE POLICY "products_merchant_or_admin_delete" ON public.products
  FOR DELETE USING (merchant_id = auth.uid() OR public.is_admin());

-- PRODUCT VERSIONS
CREATE POLICY "versions_select_policy" ON public.product_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id
        AND (p.status = 'approved' OR p.merchant_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "versions_merchant_insert" ON public.product_versions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND p.merchant_id = auth.uid()
    )
  );

-- ORDERS (Buyer sees own orders, merchant sees orders for their products, admin sees all; ALL inserts/updates via Edge Functions only)
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT USING (
    buyer_id = auth.uid()
    OR merchant_id = auth.uid()
    OR public.is_admin()
  );

-- LEDGER ENTRIES (Immutable: SELECT only for actor or admin; NO INSERT/UPDATE/DELETE from client)
CREATE POLICY "ledger_select_actor_or_admin" ON public.ledger_entries
  FOR SELECT USING (actor_id = auth.uid() OR public.is_admin());

-- PAYOUT REQUESTS (Merchant reads own, inserts via Edge Function; admin reads/updates)
CREATE POLICY "payouts_select_own_or_admin" ON public.payout_requests
  FOR SELECT USING (merchant_id = auth.uid() OR public.is_admin());

-- OWNER WITHDRAWALS (Admin only)
CREATE POLICY "owner_withdrawals_admin_only" ON public.owner_withdrawals
  FOR SELECT USING (public.is_admin());

-- REVIEWS (Public read; verified confirmed buyers only can post reviews)
CREATE POLICY "reviews_select_all" ON public.reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_confirmed_buyer_insert" ON public.reviews
  FOR INSERT WITH CHECK (
    buyer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.buyer_id = auth.uid()
        AND o.product_id = product_id
        AND o.status = 'confirmed'
    )
  );

-- WISHLISTS
CREATE POLICY "wishlists_own_all" ON public.wishlists
  FOR ALL USING (buyer_id = auth.uid()) WITH CHECK (buyer_id = auth.uid());

-- REPORTS
CREATE POLICY "reports_insert_authenticated" ON public.reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports_select_own_or_admin" ON public.reports
  FOR SELECT USING (reporter_id = auth.uid() OR public.is_admin());

CREATE POLICY "reports_admin_update" ON public.reports
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- UPLOAD LOGS, MALWARE SCANS, AUDIT LOGS (Admin or owner merchant read-only; no client writes)
CREATE POLICY "upload_logs_select_own_or_admin" ON public.upload_logs
  FOR SELECT USING (merchant_id = auth.uid() OR public.is_admin());

CREATE POLICY "malware_scans_select_admin" ON public.malware_scans
  FOR SELECT USING (public.is_admin());

CREATE POLICY "audit_logs_admin_only" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- RATE LIMITS (No client access at all; Edge Function service_role only)
CREATE POLICY "rate_limits_deny_all" ON public.rate_limits
  FOR ALL USING (false);

-- ------------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKETS & POLICIES
-- ------------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('product-files', 'product-files', false, 52428800), -- 50 MB opaque private binaries
  ('product-media', 'product-media', true, 5242880)    -- 5 MB sanitized screenshots
ON CONFLICT (id) DO NOTHING;

-- Private product-files: NEVER publicly readable; downloads ONLY via Edge Function short-lived signed URLs
CREATE POLICY "product_files_merchant_upload_only" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "product_files_deny_direct_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-files' AND public.is_admin());

CREATE POLICY "product_media_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'product-media');

CREATE POLICY "product_media_merchant_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'product-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
