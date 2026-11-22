import {
  enforceRateLimit,
  getCorsHeaders,
  hasDisallowedOperatorKeys,
  jsonResponse,
  requireAuth,
  sanitizeText,
  verifyTurnstile,
} from '../_shared/security.ts';

const MAX_FILE_BYTES = 52_428_800; // 50 MB Supabase free tier object limit

function isValidImageMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  // PNG: 89 50 4E 47
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  // JPEG: FF D8 FF
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  // WebP: RIFF....WEBP
  const isWebp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return isPng || isJpg || isWebp;
}

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
      return jsonResponse(req, 403, { error: 'Merchant role required to upload products' });
    }

    // Per-user upload rate limit: max 10 uploads per hour
    await enforceRateLimit(adminClient, `merchant_upload:${user.id}`, 3600, 10);

    const form = await req.formData();
    const metadataRaw = form.get('metadata');
    const binaryFile = form.get('file');
    const screenshotFile = form.get('screenshot');

    if (typeof metadataRaw !== 'string' || !(binaryFile instanceof File)) {
      return jsonResponse(req, 400, { error: 'Missing product metadata or opaque binary file' });
    }

    const meta = JSON.parse(metadataRaw);
    if (hasDisallowedOperatorKeys(meta)) {
      return jsonResponse(req, 400, { error: 'Invalid metadata structure' });
    }

    const turnstileOk = await verifyTurnstile(
      sanitizeText(meta.turnstileToken, 2048),
      req.headers.get('cf-connecting-ip')
    );
    if (!turnstileOk) {
      return jsonResponse(req, 403, { error: 'Turnstile verification failed' });
    }

    if (binaryFile.size <= 0 || binaryFile.size > MAX_FILE_BYTES) {
      return jsonResponse(req, 400, { error: 'Product file size must be between 1 byte and 50 MB' });
    }

    // Never trust or store original filename: generate random UUID opaque storage key
    const storageKey = `${user.id}/${crypto.randomUUID()}.bin`;
    const fileBuffer = new Uint8Array(await binaryFile.arrayBuffer());

    // Compute authoritative SHA-256 server-side
    const digest = await crypto.subtle.digest('SHA-256', fileBuffer);
    const sha256Hash = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const { error: uploadErr } = await adminClient.storage
      .from('product-files')
      .upload(storageKey, fileBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (uploadErr) throw uploadErr;

    const screenshots: string[] = [];
    if (screenshotFile instanceof File && screenshotFile.size > 0 && screenshotFile.size <= 5_242_880) {
      const imgBytes = new Uint8Array(await screenshotFile.arrayBuffer());
      if (!isValidImageMagicBytes(imgBytes)) {
        return jsonResponse(req, 400, { error: 'Invalid screenshot image signature' });
      }
      const imgKey = `${user.id}/${crypto.randomUUID()}.webp`;
      const { error: imgErr } = await adminClient.storage
        .from('product-media')
        .upload(imgKey, imgBytes, { contentType: 'image/webp', upsert: false });
      if (!imgErr) {
        const { data: pubUrl } = adminClient.storage.from('product-media').getPublicUrl(imgKey);
        screenshots.push(pubUrl.publicUrl);
      }
    }

    const priceCents = Math.round(Number(meta.priceDollars) * 100);
    if (!Number.isInteger(priceCents) || priceCents < 100) {
      return jsonResponse(req, 400, { error: 'Minimum price is $1.00' });
    }

    const title = sanitizeText(meta.title, 120);
    const shortTagline = sanitizeText(meta.shortTagline, 180);
    const description = sanitizeText(meta.description, 8000);
    const version = sanitizeText(meta.version, 32) || '1.0.0';
    const category = sanitizeText(meta.category, 32);
    const platform = sanitizeText(meta.platform, 40);

    // Optional VirusTotal free hash lookup (non-blocking, respects 4 req/min free tier)
    let scanStatus: 'queued' | 'clean' | 'flagged' = 'queued';
    const vtKey = Deno.env.get('VIRUSTOTAL_API_KEY') || '';
    if (vtKey) {
      try {
        const vtRes = await fetch(`https://www.virustotal.com/api/v3/files/${sha256Hash}`, {
          headers: { 'x-apikey': vtKey },
        });
        if (vtRes.ok) {
          const vtJson = await vtRes.json();
          const malicious = vtJson?.data?.attributes?.last_analysis_stats?.malicious ?? 0;
          scanStatus = malicious > 0 ? 'flagged' : 'clean';
        }
      } catch {
        scanStatus = 'queued';
      }
    }

    const { data: product, error: prodErr } = await adminClient
      .from('products')
      .insert({
        merchant_id: user.id,
        title,
        title_ar: sanitizeText(meta.titleAr, 120),
        short_tagline: shortTagline,
        short_tagline_ar: sanitizeText(meta.shortTaglineAr, 180),
        description,
        description_ar: sanitizeText(meta.descriptionAr, 8000),
        category,
        platform,
        current_version: version,
        file_size_bytes: binaryFile.size,
        price_cents: priceCents,
        screenshots,
        status: scanStatus === 'flagged' ? 'removed' : 'pending_review',
        scan_status: scanStatus,
        storage_key: storageKey,
      })
      .select('*')
      .single();

    if (prodErr) throw prodErr;

    await adminClient.from('product_versions').insert({
      product_id: product.id,
      version_number: version,
      changelog: 'Initial release',
      file_size_bytes: binaryFile.size,
      storage_key: storageKey,
      sha256_hash: sha256Hash,
      scan_status: scanStatus,
    });

    await adminClient.from('upload_logs').insert({
      merchant_id: user.id,
      product_id: product.id,
      storage_key: storageKey,
      file_size_bytes: binaryFile.size,
      sha256_hash: sha256Hash,
    });

    await adminClient.from('malware_scans').insert({
      product_id: product.id,
      storage_key: storageKey,
      sha256_hash: sha256Hash,
      status: scanStatus,
    });

    return jsonResponse(req, 201, { product });
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
