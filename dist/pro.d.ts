import { IssueClusterReport, RepoAuditReport, ScoredPR } from './analyzer.js';
export declare const COMMENT_MARKER = "<!-- prguard:triage -->";
export declare const VERDICT_LABELS: Record<string, {
    name: string;
    color: string;
    description: string;
} | null>;
export type GhRunner = (args: string[], input?: string) => string;
export declare const defaultGh: GhRunner;
export declare function formatClusterComment(repo: string, cluster: IssueClusterReport): string;
/** Create or update the single PRGuard comment on an issue. Returns 'created' | 'updated'. */
export declare function upsertStickyComment(repo: string, issue: number, body: string, gh?: GhRunner): 'created' | 'updated';
export declare function ensureLabels(repo: string, gh?: GhRunner): void;
/** Apply exactly one PRGuard verdict label to a PR, removing stale PRGuard labels. */
export declare function applyVerdictLabel(repo: string, scored: ScoredPR, currentLabels: string[], gh?: GhRunner): string | null;
export declare function fetchPrLabels(repo: string, prNumber: number, gh?: GhRunner): string[];
export declare function formatWebhookText(report: RepoAuditReport): string;
export declare function webhookPayload(url: string, text: string): Record<string, string>;
export declare function sendWebhook(url: string, report: RepoAuditReport): Promise<void>;
