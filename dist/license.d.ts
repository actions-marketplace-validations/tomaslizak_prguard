/**
 * PRGuard Pro license validation via Polar.sh.
 *
 * Uses Polar's public customer-portal endpoint, which needs no secret token,
 * so the CLI and GitHub Action can validate a key client-side.
 */
export declare const POLAR_ORGANIZATION_ID = "543769d7-f394-4c2f-9977-a06a2504be0c";
export declare const PRO_PURCHASE_URL = "https://tomaslizak.github.io/prguard/#pricing";
export interface LicenseResult {
    valid: boolean;
    reason: string;
}
type FetchLike = (url: string, init: {
    method: string;
    headers: Record<string, string>;
    body: string;
}) => Promise<{
    ok: boolean;
    status: number;
    json(): Promise<any>;
}>;
export declare function interpretLicenseResponse(status: number, body: any, now?: Date): LicenseResult;
export declare function validateLicense(key: string | undefined, fetchImpl?: FetchLike): Promise<LicenseResult>;
export {};
