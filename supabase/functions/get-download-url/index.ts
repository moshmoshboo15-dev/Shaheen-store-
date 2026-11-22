import {
  enforceRateLimit,
  getCorsHeaders,
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
    await enforceRateLimit(adminClient, `download:${user.id}`, 60, 20);

    const body = await req.json();
    const productId = sanitizeText(body.productId, 80);
    if (!productId) {
      return jsonResponse(req, 400, { error: 'Missing productId' });
    }

    const { data: product, error: prodErr } = await adminClient
      .from('products')
      .select('id, title, current_version, storage_key, merchant_id, status, scan_status')
      .eq('id', productId)
      .single();

    if (prodErr || !product) {
      return jsonResponse(req, 404, { error: 'Product not found' });
    }

    if (product.status === 'removed' || product.scan_status === 'flagged') {
      return jsonResponse(req, 403, { error: 'Product file disabled for security review' });
    }

    // Verify confirmed non-refunded purchase (or merchant/admin owner access)
    const isOwnerOrAdmin = product.merchant_id === user.id || profile.role === 'admin';
    if (!isOwnerOrAdmin) {
      const { data: confirmedOrder } = await adminClient
        .from('orders')
        .select('id')
        .eq('buyer_id', user.id)
        .eq('product_id', product.id)
        .eq('status', 'confirmed')
        .limit(1)
        .maybeSingle();

      if (!confirmedOrder) {
        return jsonResponse(req, 403, { error: 'Confirmed purchase required before downloading' });
      }
    }

    const safeName = `${product.title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 48)}_v${product.current_version.replace(/[^a-zA-Z0-9._-]/g, '')}.bin`;

    // Short-lived 60s signed URL served from Supabase Storage domain with Content-Disposition: attachment
    const { data: signed, error: signErr } = await adminClient.storage
      .from('product-files')
      .createSignedUrl(product.storage_key, 60, { download: safeName });

    if (signErr || !signed) {
      throw new Error('Failed to generate signed download URL');
    }

    return jsonResponse(req, 200, {
      signedUrl: signed.signedUrl,
      expiresInSeconds: 60,
      filename: safeName,
    });
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
