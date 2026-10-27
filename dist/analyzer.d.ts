export interface PullRequestData {
    number: number;
    title: string;
    user: string;
    createdAt: string;
    updatedAt: string;
    htmlUrl: string;
    body: string;
    additions: number;
    deletions: number;
    changedFiles: number;
    files: string[];
    patchSignatures: string[];
    linkedIssues: number[];
    ciState: 'SUCCESS' | 'FAILURE' | 'PENDING' | 'UNKNOWN';
    isDraft: boolean;
}
export interface SlopSignal {
    code: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW' | 'POSITIVE';
    points: number;
    reason: string;
}
export interface ScoredPR {
    pr: PullRequestData;
    totalScore: number;
    slopProbability: number;
    verdict: 'RECOMMENDED_WINNER' | 'VALID_CONTENDER' | 'NEEDS_SCRUTINY' | 'LIKELY_SLOP';
    signals: SlopSignal[];
    duplicateClusterId?: string;
    similarityPeers: {
        prNumber: number;
        jaccardFiles: number;
        jaccardPatch: number;
    }[];
}
export interface IssueClusterReport {
    issueNumber: number | 'UNLINKED';
    totalPRs: number;
    rankedPRs: ScoredPR[];
    recommendedWinner?: ScoredPR;
}
export interface RepoAuditReport {
    repo: string;
    scannedAt: string;
    totalOpenPRs: number;
    competingPRCount: number;
    likelySlopCount: number;
    estimatedMaintainerHoursSaved: number;
    clusters: IssueClusterReport[];
}
export declare function extractLinkedIssues(title: string, body: string): number[];
export declare function jaccardSimilarity(a: string[], b: string[]): number;
export declare function scorePullRequest(pr: PullRequestData, peersInCluster: PullRequestData[]): ScoredPR;
export declare function buildAuditReport(repo: string, prs: PullRequestData[]): RepoAuditReport;
