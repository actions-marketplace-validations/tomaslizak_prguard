import { describe, it, expect } from 'vitest';
import {
  extractLinkedIssues,
  jaccardSimilarity,
  scorePullRequest,
  buildAuditReport,
  PullRequestData,
} from './analyzer.js';

describe('PRGuard Anti-Slop Analyzer', () => {
  it('extracts linked issue numbers from PR title and body', () => {
    expect(extractLinkedIssues('fix(api): handle auth (#63)', 'Resolves #63 and ref #12')).toEqual([
      63, 12,
    ]);
    expect(extractLinkedIssues('chore: bump deps', 'No issue linked here')).toEqual([]);
  });

  it('computes Jaccard similarity accurately', () => {
    expect(jaccardSimilarity(['a.ts', 'b.ts'], ['b.ts', 'c.ts'])).toBeCloseTo(1 / 3);
    expect(jaccardSimilarity(['a.ts'], ['a.ts'])).toBe(1);
  });

  it('ranks genuine tested PRs above bot-template clones', () => {
    const winnerPR: PullRequestData = {
      number: 101,
      title: 'feat(worker): add real Temporal time-skipping sandbox (#60)',
      user: 'genuine-dev',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:05:00Z',
      htmlUrl: 'https://github.com/org/repo/pull/101',
      body: 'Fixes #60. Added time-skipping test suite.',
      additions: 120,
      deletions: 15,
      changedFiles: 2,
      files: ['src/worker.ts', 'src/worker.test.ts'],
      patchSignatures: ['src/worker.ts', 'src/worker.test.ts'],
      linkedIssues: [60],
      ciState: 'SUCCESS',
      isDraft: false,
    };

    const slopClonePR: PullRequestData = {
      number: 109,
      title: 'fix: resolve #60',
      user: 'slop-bot-99',
      createdAt: '2026-10-20T14:00:00Z',
      updatedAt: '2026-10-20T14:01:00Z',
      htmlUrl: 'https://github.com/org/repo/pull/109',
      body: 'Automated resolution for #60. Here is the complete, fully tested implementation. All tests pass.',
      additions: 95,
      deletions: 10,
      changedFiles: 3,
      files: ['src/worker.ts', 'src/index.ts', 'src/config.ts'],
      patchSignatures: ['src/worker.ts', 'src/worker.test.ts'],
      linkedIssues: [60],
      ciState: 'FAILURE',
      isDraft: false,
    };

    const report = buildAuditReport('org/repo', [slopClonePR, winnerPR]);
    expect(report.clusters).toHaveLength(1);
    const cluster = report.clusters[0];
    expect(cluster.recommendedWinner?.pr.number).toBe(101);
    expect(cluster.rankedPRs[0].verdict).toBe('RECOMMENDED_WINNER');
    expect(cluster.rankedPRs[1].verdict).toBe('LIKELY_SLOP');
  });
});
