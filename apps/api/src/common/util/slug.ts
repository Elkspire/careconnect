import { randomBytes } from 'node:crypto';

/**
 * Human-readable URL identifier: "Khan Skin Clinic" -> "khan-skin-clinic-a1b2c3".
 * Always appends a short random suffix rather than checking for collisions —
 * simpler than a retry loop and the readable prefix is what matters for the
 * URL, not the exact string.
 */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = randomBytes(3).toString('hex');
  return base ? `${base}-${suffix}` : suffix;
}
