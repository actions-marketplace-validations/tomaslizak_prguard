/**
 * PRGuard Pro license validation via Polar.sh.
 *
 * Uses Polar's public customer-portal endpoint, which needs no secret token,
 * so the CLI and GitHub Action can validate a key client-side.
 */

export const POLAR_ORGANIZATION_ID = '543769d7-f394-4c2f-9977-a06a2504be0c';
export const PRO_PURCHASE_URL = 'https://tomaslizak.github.io/prguard/#pricing';
const VALIDATE_URL = 'https://api.polar.sh/v1/customer-portal/license-keys/validate';

export interface LicenseResult {
  valid: boolean;
  reason: string;
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

export function interpretLicenseResponse(status: number, body: any, now: Date = new Date()): LicenseResult {
  if (status === 404 || status === 422) {
    return { valid: false, reason: 'license key not recognised' };
  }
  if (status < 200 || status >= 300) {
    return { valid: false, reason: `license server returned HTTP ${status}` };
  }
  if (body?.status !== 'granted') {
    return { valid: false, reason: `license key is ${body?.status ?? 'not active'}` };
  }
  if (body?.expires_at && new Date(body.expires_at).getTime() < now.getTime()) {
    return { valid: false, reason: `license key expired at ${body.expires_at}` };
  }
  return { valid: true, reason: 'license key active' };
}

export async function validateLicense(
  key: string | undefined,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<LicenseResult> {
  const trimmed = (key ?? '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'no license key provided (set --license-key or PRGUARD_LICENSE_KEY)' };
  }
  try {
    const res = await fetchImpl(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ key: trimmed, organization_id: POLAR_ORGANIZATION_ID }),
    });
    let body: any = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return interpretLicenseResponse(res.status, body);
  } catch (err) {
    return { valid: false, reason: `could not reach license server: ${(err as Error).message}` };
  }
}
