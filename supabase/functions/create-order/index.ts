import {
  enforceRateLimit,
  getCorsHeaders,
  hasDisallowedOperatorKeys,
  jsonResponse,
  requireAuth,
  sanitizeText,
} from '../_shared/security.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, 405, { error: 'Method not allowed' });
  }

  try {
    const { user, adminClient } = await requireAuth(req);
    await enforceRateLimit(adminClient, `create_order:${user.id}`, 60, 15);

    const body = await req.json();
    if (hasDisallowedOperatorKeys(body)) {
      return jsonResponse(req, 400, { error: 'Invalid input payload' });
    }

    const productId = sanitizeText(body.productId, 80);
    const idempotencyKey = sanitizeText(body.idempotencyKey, 120);
    const paymentMethod = sanitizeText(body.paymentMethod, 60);
    const manualTxReference = sanitizeText(body.manualTxReference, 140);

    if (!productId || !idempotencyKey || !paymentMethod) {
      return jsonResponse(req, 400, { error: 'Missing required order fields' });
    }

    // Check idempotency key first
    const { data: existingOrder } = await adminClient
      .from('orders')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingOrder) {
      if (existingOrder.buyer_id !== user.id) {
        return jsonResponse(req, 403, { error: 'Idempotency key mismatch' });
      }
      return jsonResponse(req, 200, { order: existingOrder });
    }

    // Always read authoritative price from DB (never trust client price)
    const { data: product, error: prodErr } = await adminClient
      .from('products')
      .select('id, merchant_id, price_cents, status, scan_status')
      .eq('id', productId)
      .single();

    if (prodErr || !product || product.status !== 'approved' || product.scan_status === 'flagged') {
      return jsonResponse(req, 404, { error: 'Product is not available for purchase' });
    }

    const { data: settings } = await adminClient
      .from('platform_settings')
      .select('commission_bps, holding_period_days')
      .eq('id', 1)
      .single();

    const commissionBps = settings?.commission_bps ?? 250;
    const grossCents = Number(product.price_cents);
    const commissionCents = Math.floor((grossCents * commissionBps) / 10000);
    const merchantNetCents = grossCents - commissionCents;
    const status = manualTxReference ? 'awaiting_verification' : 'pending_payment';

    const { data: order, error: orderErr } = await adminClient
      .from('orders')
      .insert({
        idempotency_key: idempotencyKey,
        buyer_id: user.id,
        product_id: product.id,
        merchant_id: product.merchant_id,
        gross_cents: grossCents,
        commission_cents: commissionCents,
        commission_bps: commissionBps,
        merchant_net_cents: merchantNetCents,
        payment_method: paymentMethod,
        manual_tx_reference: manualTxReference || null,
        status,
      })
      .select('*')
      .single();

    if (orderErr) throw orderErr;

    return jsonResponse(req, 201, { order });
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
