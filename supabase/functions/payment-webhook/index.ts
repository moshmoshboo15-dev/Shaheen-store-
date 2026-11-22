import {
  getCorsHeaders,
  getServiceClient,
  hasDisallowedOperatorKeys,
  jsonResponse,
  sanitizeText,
} from '../_shared/security.ts';

async function verifyHmacSha256(secret: string, rawBody: string, signatureHex: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const computedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  if (computedHex.length !== signatureHex.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHex.length; i++) {
    diff |= computedHex.charCodeAt(i) ^ signatureHex.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  if (req.method !== 'POST') {
    return jsonResponse(req, 405, { error: 'Method not allowed' });
  }

  try {
    const webhookSecret = Deno.env.get('PAYMENT_WEBHOOK_SECRET') || '';
    if (!webhookSecret) {
      return jsonResponse(req, 503, { error: 'Webhook secret not configured on server' });
    }

    const rawBody = await req.text();
    const signature = (req.headers.get('x-shaheen-signature') || '').trim().toLowerCase();
    const valid = await verifyHmacSha256(webhookSecret, rawBody, signature);
    if (!valid) {
      return jsonResponse(req, 401, { error: 'Invalid webhook signature' });
    }

    const payload = JSON.parse(rawBody);
    if (hasDisallowedOperatorKeys(payload)) {
      return jsonResponse(req, 400, { error: 'Invalid webhook payload' });
    }

    const orderId = sanitizeText(payload.order_id, 80);
    const providerTxId = sanitizeText(payload.provider_tx_id, 140);
    const paidAmountCents = Number(payload.amount_cents);

    if (!orderId || !providerTxId || !Number.isInteger(paidAmountCents)) {
      return jsonResponse(req, 400, { error: 'Missing required webhook attributes' });
    }

    const adminClient = getServiceClient();
    const { data: order } = await adminClient
      .from('orders')
      .select('id, buyer_id, gross_cents, status')
      .eq('id', orderId)
      .single();

    if (!order) return jsonResponse(req, 404, { error: 'Order not found' });
    if (paidAmountCents < Number(order.gross_cents)) {
      return jsonResponse(req, 400, { error: 'Paid amount is less than order total' });
    }

    const { data: confirmedOrder, error: confirmErr } = await adminClient.rpc('confirm_order_atomic', {
      p_order_id: order.id,
      p_provider_tx_id: providerTxId,
      p_actor_id: order.buyer_id,
    });

    if (confirmErr) throw confirmErr;
    return jsonResponse(req, 200, { ok: true, order: confirmedOrder });
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
