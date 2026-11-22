import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  const allowedEnv = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map((s) => s.trim()).filter(Boolean);
  const isAllowed =
    allowedEnv.includes(origin) ||
    /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin) ||
    /^http:\/\/localhost:\d+$/i.test(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedEnv[0] || 'https://shaheen-store.pages.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-shaheen-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };
}

export function jsonResponse(req: Request, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(req),
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

export function getServiceClient() {
  const url = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function hasDisallowedOperatorKeys(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  if (Array.isArray(payload)) return payload.some(hasDisallowedOperatorKeys);
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (hasDisallowedOperatorKeys(value)) return true;
  }
  return false;
}

export function sanitizeText(input: unknown, maxLen = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, maxLen);
}

export async function verifyTurnstile(token: string, remoteIp?: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY') || '';
  if (!secret) {
    // Allow Cloudflare's official test token during initial setup if secret not yet set
    return token.length > 0;
  }
  const form = new URLSearchParams();
  form.set('secret', secret);
  form.set('response', token);
  if (remoteIp) form.set('remoteip', remoteIp);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form,
  });
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export async function requireAuth(req: Request) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Error('Unauthorized: missing bearer token');

  const adminClient = getServiceClient();
  const { data, error } = await adminClient.auth.getUser(token);
  if (error || !data.user) {
    throw new Error('Unauthorized: invalid session token');
  }

  // Decode JWT payload to inspect MFA AAL claim
  let aal = 'aal1';
  try {
    const payloadSegment = token.split('.')[1];
    if (payloadSegment) {
      const decoded = JSON.parse(atob(payloadSegment.replace(/-/g, '+').replace(/_/g, '/')));
      if (typeof decoded.aal === 'string') aal = decoded.aal;
    }
  } catch {
    aal = 'aal1';
  }

  const { data: profile, error: profErr } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profErr || !profile) throw new Error('Profile not found');
  if (profile.suspended) throw new Error('Account suspended');

  return { user: data.user, profile, aal, adminClient };
}

export async function enforceRateLimit(
  adminClient: ReturnType<typeof getServiceClient>,
  key: string,
  windowSeconds: number,
  maxHits: number
): Promise<void> {
  const { data: allowed, error } = await adminClient.rpc('check_and_increment_rate_limit', {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max_hits: maxHits,
  });
  if (error || !allowed) {
    throw new Error('Rate limit exceeded. Please wait and try again.');
  }
}
