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
    const { user, profile, adminClient } = await requireAuth(req);
    if (profile.role !== 'merchant' && profile.role !== 'admin') {
      return jsonResponse(req, 403, { error: 'Merchant role required' });
    }

    await enforceRateLimit(adminClient, `payout_req:${user.id}`, 3600, 5);

    const body = await req.json();
    if (hasDisallowedOperatorKeys(body)) {
      return jsonResponse(req, 400, { error: 'Invalid input' });
    }

    const amountCents = Number(body.amountCents);
    const method = body.method === 'paypal' ? 'paypal' : 'nsave';
    const destination = sanitizeText(body.destination, 160);

    if (!Number.isInteger(amountCents) || amountCents < 500 || destination.length < 3) {
      return jsonResponse(req, 400, { error: 'Minimum payout is $5.00 with a valid destination' });
    }

    const { data, error } = await adminClient.rpc('request_merchant_payout_atomic', {
      p_merchant_id: user.id,
      p_amount_cents: amountCents,
      p_method: method,
      p_destination: destination,
    });

    if (error) throw error;
    return jsonResponse(req, 201, { payout: data });
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
