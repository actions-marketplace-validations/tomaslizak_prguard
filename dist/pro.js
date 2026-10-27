/**
 * PRGuard Pro actions: sticky triage comments on issues, verdict labels on
 * PRs, and Slack/Discord webhook summaries. All GitHub writes go through the
 * authenticated `gh` CLI (GH_TOKEN in Actions).
 */
import { execFileSync } from 'node:child_process';
export const COMMENT_MARKER = '<!-- prguard:triage -->';
export const VERDICT_LABELS = {
    RECOMMENDED_WINNER: {
        name: 'prguard: top-contender',
        color: '2ea043',
        description: 'PRGuard: highest-ranked PR for its issue',
    },
    VALID_CONTENDER: null,
    NEEDS_SCRUTINY: {
        name: 'prguard: needs-scrutiny',
        color: 'd29922',
        description: 'PRGuard: duplicate or weak-signal PR, review carefully',
    },
    LIKELY_SLOP: {
        name: 'prguard: likely-slop',
        color: 'cf222e',
        description: 'PRGuard: likely low-effort / duplicate bot submission',
    },
};
const ALL_LABEL_NAMES = Object.values(VERDICT_LABELS)
    .filter((l) => l !== null)
    .map((l) => l.name);
export const defaultGh = (args, input) => execFileSync('gh', args, {
    encoding: 'utf-8',
    input,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
});
export function formatClusterComment(repo, cluster) {
    const lines = [COMMENT_MARKER];
    lines.push(`### 🛡️ PRGuard triage: ${cluster.totalPRs} competing pull requests for #${cluster.issueNumber}`);
    lines.push('');
    if (cluster.recommendedWinner) {
        const w = cluster.recommendedWinner;
        lines.push(`**Review first:** #${w.pr.number} by @${w.pr.user} (score ${w.totalScore}/100, CI \`${w.pr.ciState}\`)`);
        lines.push('');
    }
    lines.push('| Rank | PR | Author | Score | Verdict | CI | Diff | Signals |');
    lines.push('| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |');
    cluster.rankedPRs.forEach((item, idx) => {
        const sig = item.signals.map((s) => `${s.points > 0 ? '+' : ''}${s.points} ${s.code}`).join(', ') || 'baseline';
        lines.push(`| ${idx + 1} | #${item.pr.number} | @${item.pr.user} | ${item.totalScore} | ${item.verdict.replace(/_/g, ' ').toLowerCase()} | ${item.pr.ciState} | +${item.pr.additions}/-${item.pr.deletions} | ${sig} |`);
    });
    lines.push('');
    lines.push(`<sub>Updated ${new Date().toISOString()} by [PRGuard](https://github.com/tomaslizak/prguard) for \`${repo}\`. Scores are heuristics to order review, not a merge decision.</sub>`);
    return lines.join('\n');
}
/** Create or update the single PRGuard comment on an issue. Returns 'created' | 'updated'. */
export function upsertStickyComment(repo, issue, body, gh = defaultGh) {
    const raw = gh(['api', '--paginate', `repos/${repo}/issues/${issue}/comments?per_page=100`, '--jq', '.[] | [.id, .body] | @json']);
    let existingId;
    for (const line of raw.split('\n')) {
        if (!line.trim())
            continue;
        const [id, text] = JSON.parse(line);
        if (typeof text === 'string' && text.includes(COMMENT_MARKER)) {
            existingId = id;
            break;
        }
    }
    const payload = JSON.stringify({ body });
    if (existingId !== undefined) {
        gh(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${existingId}`, '--input', '-'], payload);
        return 'updated';
    }
    gh(['api', '-X', 'POST', `repos/${repo}/issues/${issue}/comments`, '--input', '-'], payload);
    return 'created';
}
export function ensureLabels(repo, gh = defaultGh) {
    for (const l of Object.values(VERDICT_LABELS)) {
        if (!l)
            continue;
        try {
            gh(['api', '-X', 'POST', `repos/${repo}/labels`, '--input', '-'], JSON.stringify({ name: l.name, color: l.color, description: l.description }));
        }
        catch {
            // 422 = label already exists
        }
    }
}
/** Apply exactly one PRGuard verdict label to a PR, removing stale PRGuard labels. */
export function applyVerdictLabel(repo, scored, currentLabels, gh = defaultGh) {
    const want = VERDICT_LABELS[scored.verdict]?.name ?? null;
    for (const name of currentLabels) {
        if (ALL_LABEL_NAMES.includes(name) && name !== want) {
            try {
                gh(['api', '-X', 'DELETE', `repos/${repo}/issues/${scored.pr.number}/labels/${encodeURIComponent(name)}`]);
            }
            catch {
                // already gone
            }
        }
    }
    if (want && !currentLabels.includes(want)) {
        gh(['api', '-X', 'POST', `repos/${repo}/issues/${scored.pr.number}/labels`, '--input', '-'], JSON.stringify({ labels: [want] }));
    }
    return want;
}
export function fetchPrLabels(repo, prNumber, gh = defaultGh) {
    const raw = gh(['api', `repos/${repo}/issues/${prNumber}/labels`, '--jq', '.[].name']);
    return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}
export function formatWebhookText(report) {
    const contested = report.clusters.filter((c) => c.issueNumber !== 'UNLINKED' && c.totalPRs > 1);
    const lines = [
        `PRGuard triage for ${report.repo}: ${report.totalOpenPRs} open PRs, ${report.competingPRCount} competing, ${report.likelySlopCount} likely slop.`,
    ];
    for (const c of contested.slice(0, 10)) {
        const w = c.recommendedWinner;
        lines.push(`• #${c.issueNumber}: ${c.totalPRs} PRs` +
            (w ? `, review first #${w.pr.number} by @${w.pr.user} (${w.totalScore}/100)` : ''));
    }
    return lines.join('\n');
}
export function webhookPayload(url, text) {
    return /discord(app)?\.com\/api\/webhooks/.test(url) ? { content: text.slice(0, 1990) } : { text };
}
export async function sendWebhook(url, report) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload(url, formatWebhookText(report))),
    });
    if (!res.ok) {
        throw new Error(`webhook returned HTTP ${res.status}`);
    }
}
