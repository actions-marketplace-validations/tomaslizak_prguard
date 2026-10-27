const SLOP_PHRASES = [
    /engineered\s*&\s*solved\s*autonomously/i,
    /automated\s+resolution\s+for\s+#\d+/i,
    /all\s+acceptance\s+criteria\s+have\s+been\s+met/i,
    /kindly\s+review\s+and\s+merge/i,
    /this\s+pr\s+comprehensively\s+resolves/i,
    /here\s+is\s+the\s+complete,\s+fully\s+tested\s+implementation/i,
];
const SENSITIVE_PATHS = [
    /^\.github\/workflows\//i,
    /^\.env/i,
    /package-lock\.json$/,
    /pnpm-lock\.yaml$/,
    /yarn\.lock$/,
];
export function extractLinkedIssues(title, body) {
    const combined = `${title}\n${body}`;
    const issues = new Set();
    // Match fixes/closes/resolves #123 or (#123) in title
    const regex = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?|ref|part\s+of)\s+#(\d+)|(?:\(#(\d+)\))|(?:^|\s)#(\d+)\b/gi;
    let match;
    while ((match = regex.exec(combined)) !== null) {
        const numStr = match[1] || match[2] || match[3];
        if (numStr) {
            const n = parseInt(numStr, 10);
            if (n > 0 && n < 1000000)
                issues.add(n);
        }
    }
    return Array.from(issues);
}
export function jaccardSimilarity(a, b) {
    if (a.length === 0 && b.length === 0)
        return 1;
    if (a.length === 0 || b.length === 0)
        return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const item of setA) {
        if (setB.has(item))
            intersection++;
    }
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
export function scorePullRequest(pr, peersInCluster) {
    let score = 60; // Base score
    const signals = [];
    const testFiles = pr.files.filter((f) => /\.(test|spec)\.[jt]sx?$|_test\.go$|_test\.rs$|^tests?\//i.test(f));
    const codeFiles = pr.files.filter((f) => !/\.(md|txt|json|lock|ya?ml)$/i.test(f) && !testFiles.includes(f));
    // 1. Test verification signal
    if (testFiles.length > 0 && codeFiles.length > 0) {
        score += 18;
        signals.push({
            code: 'INCLUDES_TESTS',
            severity: 'POSITIVE',
            points: 18,
            reason: `Includes ${testFiles.length} test file(s) alongside ${codeFiles.length} implementation file(s)`,
        });
    }
    else if (codeFiles.length > 2 && testFiles.length === 0) {
        score -= 15;
        signals.push({
            code: 'MISSING_TESTS',
            severity: 'MEDIUM',
            points: -15,
            reason: `Touches ${codeFiles.length} code files with 0 test files added/updated`,
        });
    }
    // 2. Test-claim hallucination check (claims tests pass in body, but 0 test files & CI not green)
    const claimsTestsPass = /\b(all\s+tests\s+pass|tests\s+passing|verified\s+with\s+unit\s+tests|full\s+test\s+suite\s+passes)\b/i.test(pr.body);
    if (claimsTestsPass && testFiles.length === 0 && pr.ciState === 'FAILURE') {
        score -= 25;
        signals.push({
            code: 'UNVERIFIED_TEST_CLAIM',
            severity: 'HIGH',
            points: -25,
            reason: 'PR body claims tests pass, but CI failed and no test files were modified',
        });
    }
    // 3. CI Status
    if (pr.ciState === 'SUCCESS') {
        score += 15;
        signals.push({
            code: 'CI_GREEN',
            severity: 'POSITIVE',
            points: 15,
            reason: 'GitHub Actions / CI checks passing',
        });
    }
    else if (pr.ciState === 'FAILURE') {
        score -= 20;
        signals.push({
            code: 'CI_RED',
            severity: 'HIGH',
            points: -20,
            reason: 'GitHub Actions / CI checks failing',
        });
    }
    // 4. Bot / AI Slop Template Fingerprints
    for (const pattern of SLOP_PHRASES) {
        if (pattern.test(pr.body)) {
            score -= 18;
            signals.push({
                code: 'BOT_TEMPLATE_FINGERPRINT',
                severity: 'HIGH',
                points: -18,
                reason: `Matches known mass-submission bot phrasing (${pattern.source})`,
            });
            break;
        }
    }
    // 5. Diff Bloat / Lockfile churn
    const totalLines = pr.additions + pr.deletions;
    if (totalLines > 2500) {
        score -= 15;
        signals.push({
            code: 'MASSIVE_DIFF_BLOAT',
            severity: 'MEDIUM',
            points: -15,
            reason: `Overly large diff (${totalLines} lines changed), difficult to audit safely`,
        });
    }
    else if (totalLines > 10 && totalLines <= 400) {
        score += 8;
        signals.push({
            code: 'SURGICAL_SCOPE',
            severity: 'POSITIVE',
            points: 8,
            reason: `Focused, surgical diff (${totalLines} lines across ${pr.changedFiles} files)`,
        });
    }
    // 6. Sensitive / CI workflow tampering
    const touchedWorkflows = pr.files.filter((f) => /^\.github\/workflows\//i.test(f));
    if (touchedWorkflows.length > 0 && !/ci|workflow|action/i.test(pr.title)) {
        score -= 15;
        signals.push({
            code: 'UNSOLICITED_WORKFLOW_EDIT',
            severity: 'HIGH',
            points: -15,
            reason: `Modifies CI workflow (${touchedWorkflows.join(', ')}) without CI being the primary PR topic`,
        });
    }
    // 7. Peer Similarity & First-Mover Advantage in Competing Clusters
    const similarityPeers = [];
    for (const peer of peersInCluster) {
        if (peer.number === pr.number)
            continue;
        const jFiles = jaccardSimilarity(pr.files, peer.files);
        const jPatch = jaccardSimilarity(pr.patchSignatures, peer.patchSignatures);
        if (jFiles >= 0.4 || jPatch >= 0.25) {
            similarityPeers.push({
                prNumber: peer.number,
                jaccardFiles: Math.round(jFiles * 100) / 100,
                jaccardPatch: Math.round(jPatch * 100) / 100,
            });
        }
    }
    if (peersInCluster.length > 1) {
        const sortedByTime = [...peersInCluster].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const rankIndex = sortedByTime.findIndex((p) => p.number === pr.number);
        if (rankIndex === 0) {
            score += 10;
            signals.push({
                code: 'FIRST_RESPONDER',
                severity: 'POSITIVE',
                points: 10,
                reason: `First PR submitted in a competing cluster of ${peersInCluster.length} PRs`,
            });
        }
        else if (rankIndex >= 5) {
            score -= 10;
            signals.push({
                code: 'LATE_DUPLICATE_WAVE',
                severity: 'LOW',
                points: -10,
                reason: `Arrived #${rankIndex + 1} in a crowded cluster of ${peersInCluster.length} competing PRs`,
            });
        }
        const highPatchClone = similarityPeers.find((s) => s.jaccardPatch >= 0.65 &&
            s.prNumber < pr.number // Older PR has lower number
        );
        if (highPatchClone) {
            score -= 25;
            signals.push({
                code: 'NEAR_CLONE_OF_EARLIER_PR',
                severity: 'HIGH',
                points: -25,
                reason: `${Math.round(highPatchClone.jaccardPatch * 100)}% patch-line overlap with earlier PR #${highPatchClone.prNumber}`,
            });
        }
    }
    const clampedScore = Math.max(0, Math.min(100, score));
    const slopProbability = Math.max(0, Math.min(100, 100 - clampedScore));
    let verdict = 'VALID_CONTENDER';
    if (clampedScore < 40) {
        verdict = 'LIKELY_SLOP';
    }
    else if (clampedScore < 60) {
        verdict = 'NEEDS_SCRUTINY';
    }
    return {
        pr,
        totalScore: clampedScore,
        slopProbability,
        verdict,
        signals,
        similarityPeers,
    };
}
export function buildAuditReport(repo, prs) {
    const issueMap = new Map();
    for (const pr of prs) {
        const primaryIssue = pr.linkedIssues.length > 0 ? pr.linkedIssues[0] : 'UNLINKED';
        const list = issueMap.get(primaryIssue) || [];
        list.push(pr);
        issueMap.set(primaryIssue, list);
    }
    const clusters = [];
    let competingPRCount = 0;
    let likelySlopCount = 0;
    for (const [issueNumber, group] of issueMap.entries()) {
        if (issueNumber !== 'UNLINKED' && group.length > 1) {
            competingPRCount += group.length;
        }
        const scored = group
            .map((pr) => scorePullRequest(pr, issueNumber === 'UNLINKED' ? [pr] : group))
            .sort((a, b) => b.totalScore - a.totalScore);
        if (scored.length > 0 && scored[0].totalScore >= 65) {
            scored[0].verdict = 'RECOMMENDED_WINNER';
        }
        for (const s of scored) {
            if (s.verdict === 'LIKELY_SLOP')
                likelySlopCount++;
        }
        clusters.push({
            issueNumber,
            totalPRs: group.length,
            rankedPRs: scored,
            recommendedWinner: scored[0]?.totalScore >= 60 ? scored[0] : undefined,
        });
    }
    // Sort clusters: multi-PR issue clusters first (by size desc), then single-PR issues, then UNLINKED
    clusters.sort((a, b) => {
        if (a.issueNumber === 'UNLINKED')
            return 1;
        if (b.issueNumber === 'UNLINKED')
            return -1;
        return b.totalPRs - a.totalPRs;
    });
    const redundantPRs = prs.length - clusters.length;
    const estimatedMaintainerHoursSaved = Math.round((redundantPRs * 0.35 + likelySlopCount * 0.25) * 10) / 10;
    return {
        repo,
        scannedAt: new Date().toISOString(),
        totalOpenPRs: prs.length,
        competingPRCount,
        likelySlopCount,
        estimatedMaintainerHoursSaved,
        clusters,
    };
}
