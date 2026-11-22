import { z } from 'zod';

/**
 * Rejects plain objects or NoSQL-style operator payloads inside primitive fields.
 */
export function hasDisallowedOperatorKeys(payload: unknown): boolean {
  if (payload === null || typeof payload !== 'object') return false;
  if (Array.isArray(payload)) {
    return payload.some(hasDisallowedOperatorKeys);
  }
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (key.startsWith('$') || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return true;
    }
    if (hasDisallowedOperatorKeys(value)) return true;
  }
  return false;
}

export const authSignUpSchema = z
  .object({
    email: z.string().email().max(120),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(128)
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    displayName: z.string().min(2).max(80),
    turnstileToken: z.string().min(4),
  })
  .strict();

export const authSignInSchema = z
  .object({
    email: z.string().email().max(120),
    password: z.string().min(6).max(128),
    turnstileToken: z.string().min(4),
  })
  .strict();

export const productCreateSchema = z
  .object({
    title: z.string().min(3).max(120),
    titleAr: z.string().max(120).optional().default(''),
    shortTagline: z.string().min(5).max(180),
    shortTaglineAr: z.string().max(180).optional().default(''),
    description: z.string().min(20).max(8000),
    descriptionAr: z.string().max(8000).optional().default(''),
    category: z.enum(['software', 'apk', 'tools', 'scripts', 'assets']),
    platform: z.enum([
      'Windows',
      'macOS',
      'Linux',
      'Android (APK)',
      'Cross-Platform',
      'Web / Node.js',
    ]),
    version: z.string().min(1).max(32),
    priceDollars: z.number().min(1).max(50000),
    turnstileToken: z.string().min(4),
  })
  .strict();

export const reviewCreateSchema = z
  .object({
    productId: z.string().min(1).max(80),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(3).max(2000),
  })
  .strict();

export const payoutRequestSchema = z
  .object({
    amountDollars: z.number().min(5).max(100000),
    method: z.enum(['nsave', 'paypal']),
    destination: z.string().min(3).max(160),
  })
  .strict();

export const reportProductSchema = z
  .object({
    productId: z.string().min(1).max(80),
    reason: z.enum(['malware', 'copyright', 'broken_file', 'misleading', 'other']),
    details: z.string().min(5).max(2000),
  })
  .strict();
