import {
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
    const { user, profile, aal, adminClient } = await requireAuth(req);
    if (profile.role !== 'admin') {
      return jsonResponse(req, 403, { error: 'Admin role required' });
    }
    // Enforce TOTP two-factor authentication (aal2) for all admin actions
    if (aal !== 'aal2') {
      return jsonResponse(req, 403, { error: 'TOTP Two-Factor Authentication (AAL2) is mandatory for admin actions' });
    }

    const body = await req.json();
    if (hasDisallowedOperatorKeys(body)) {
      return jsonResponse(req, 400, { error: 'Invalid input payload' });
    }

    const action = sanitizeText(body.action, 60);

    switch (action) {
      case 'approve_product':
      case 'reject_product':
      case 'takedown_product': {
        const productId = sanitizeText(body.productId, 80);
        const nextStatus =
          action === 'approve_product'
            ? 'approved'
            : action === 'reject_product'
            ? 'rejected'
            : 'removed';
        const { error } = await adminClient
          .from('products')
          .update({ status: nextStatus, updated_at: new Date().toISOString() })
          .eq('id', productId);
        if (error) throw error;

        await adminClient.from('audit_logs').insert({
          actor_id: user.id,
          actor_email: profile.email,
          action,
          target_type: 'product',
          target_id: productId,
        });
        return jsonResponse(req, 200, { ok: true });
      }

      case 'confirm_malicious': {
        const productId = sanitizeText(body.productId, 80);
        const reportId = body.reportId ? sanitizeText(body.reportId, 80) : null;
        const { error } = await adminClient.rpc('confirm_malicious_product_atomic', {
          p_product_id: productId,
          p_admin_id: user.id,
          p_report_id: reportId,
        });
        if (error) throw error;
        return jsonResponse(req, 200, { ok: true });
      }

      case 'confirm_manual_order': {
        const orderId = sanitizeText(body.orderId, 80);
        const providerTxId = sanitizeText(body.providerTxId, 140) || `MANUAL-${Date.now()}`;
        const { data, error } = await adminClient.rpc('confirm_order_atomic', {
          p_order_id: orderId,
          p_provider_tx_id: providerTxId,
          p_actor_id: user.id,
        });
        if (error) throw error;
        return jsonResponse(req, 200, { order: data });
      }

      case 'refund_order': {
        const orderId = sanitizeText(body.orderId, 80);
        const reason = sanitizeText(body.reason, 400);
        const { data, error } = await adminClient.rpc('refund_order_atomic', {
          p_order_id: orderId,
          p_admin_id: user.id,
          p_reason: reason,
        });
        if (error) throw error;
        return jsonResponse(req, 200, { order: data });
      }

      case 'update_settings': {
        const commissionBps = Number(body.commissionBps);
        const holdingPeriodDays = Number(body.holdingPeriodDays);
        if (
          !Number.isInteger(commissionBps) ||
          commissionBps < 0 ||
          commissionBps > 5000 ||
          !Number.isInteger(holdingPeriodDays) ||
          holdingPeriodDays < 0 ||
          holdingPeriodDays > 90
        ) {
          return jsonResponse(req, 400, { error: 'Invalid commission or holding period range' });
        }
        const { error } = await adminClient
          .from('platform_settings')
          .update({
            commission_bps: commissionBps,
            holding_period_days: holdingPeriodDays,
            updated_at: new Date().toISOString(),
          })
          .eq('id', 1);
        if (error) throw error;

        await adminClient.from('audit_logs').insert({
          actor_id: user.id,
          actor_email: profile.email,
          action: 'update_settings',
          target_type: 'platform_settings',
          target_id: '1',
          metadata: { commissionBps, holdingPeriodDays },
        });
        return jsonResponse(req, 200, { ok: true });
      }

      case 'toggle_suspend_user': {
        const targetUserId = sanitizeText(body.userId, 80);
        const suspended = Boolean(body.suspended);
        if (targetUserId === user.id) {
          return jsonResponse(req, 400, { error: 'Cannot suspend active admin session' });
        }
        const { error } = await adminClient
          .from('profiles')
          .update({ suspended })
          .eq('id', targetUserId);
        if (error) throw error;

        await adminClient.from('audit_logs').insert({
          actor_id: user.id,
          actor_email: profile.email,
          action: suspended ? 'suspend_user' : 'unsuspend_user',
          target_type: 'profile',
          target_id: targetUserId,
        });
        return jsonResponse(req, 200, { ok: true });
      }

      case 'mark_payout_paid': {
        const payoutId = sanitizeText(body.payoutId, 80);
        const note = sanitizeText(body.note, 240);
        const { data, error } = await adminClient.rpc('mark_payout_paid_atomic', {
          p_payout_id: payoutId,
          p_admin_id: user.id,
          p_note: note,
        });
        if (error) throw error;
        return jsonResponse(req, 200, { payout: data });
      }

      case 'withdraw_owner_wallet': {
        const amountCents = Number(body.amountCents);
        const method = body.method === 'paypal' ? 'paypal' : 'nsave';
        const destination = sanitizeText(body.destination, 160);
        const note = sanitizeText(body.note, 240);
        const { data, error } = await adminClient.rpc('withdraw_owner_wallet_atomic', {
          p_admin_id: user.id,
          p_amount_cents: amountCents,
          p_method: method,
          p_destination: destination,
          p_note: note,
        });
        if (error) throw error;
        return jsonResponse(req, 200, { withdrawal: data });
      }

      case 'export_backup_json': {
        const [profiles, products, orders, ledger, payouts, auditLogs, settings] = await Promise.all([
          adminClient.from('profiles').select('*'),
          adminClient.from('products').select('*'),
          adminClient.from('orders').select('*'),
          adminClient.from('ledger_entries').select('*'),
          adminClient.from('payout_requests').select('*'),
          adminClient.from('audit_logs').select('*').limit(5000),
          adminClient.from('platform_settings').select('*'),
        ]);

        await adminClient
          .from('platform_settings')
          .update({ last_backup_export_at: new Date().toISOString() })
          .eq('id', 1);

        await adminClient.from('audit_logs').insert({
          actor_id: user.id,
          actor_email: profile.email,
          action: 'export_backup_json',
          target_type: 'database',
          target_id: 'full',
        });

        return jsonResponse(req, 200, {
          exportedAt: new Date().toISOString(),
          profiles: profiles.data || [],
          products: products.data || [],
          orders: orders.data || [],
          ledger_entries: ledger.data || [],
          payout_requests: payouts.data || [],
          audit_logs: auditLogs.data || [],
          platform_settings: settings.data || [],
        });
      }

      default:
        return jsonResponse(req, 400, { error: 'Unknown admin action' });
    }
  } catch (err) {
    return jsonResponse(req, 400, { error: (err as Error).message });
  }
});
