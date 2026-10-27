import { describe, it, expect } from 'vitest';
import { interpretLicenseResponse, validateLicense } from './license.js';
import {
  COMMENT_MARKER,
  applyVerdictLabel,
  formatClusterComment,
  upsertStickyComment,
  webhookPayload,
  GhRunner,
} from './pro.js';
import { IssueClusterReport, ScoredPR } from './analyzer.js';

function scored(number: number, verdict: ScoredPR['verdict'], score = 50): ScoredPR {
  return {
    pr: {
      number,
      title: `PR ${number}`,
      user: `user${number}`,
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-20T10:00:00Z',
      htmlUrl: `https://github.com/o/r/pull/${number}`,
      body: '',
      additions: 10,
      deletions: 1,
      changedFiles: 1,
      files: ['a.ts'],
      patchSignatures: ['a.ts'],
      linkedIssues: [7],
      ciState: 'SUCCESS',
      isDraft: false,
    },
    totalScore: score,
    slopProbability: 100 - score,
    verdict,
    signals: [],
    similarityPeers: [],
  };
}

function recorder(responses: Record<string, string> = {}): { gh: GhRunner; calls: { args: string[]; input?: string }[] } {
  const calls: { args: string[]; input?: string }[] = [];
  const gh: GhRunner = (args, input) => {
    calls.push({ args, input });
    const key = Object.keys(responses).find((k) => args.join(' ').includes(k));
    return key ? responses[key] : '';
  };
  return { gh, calls };
}

describe('license validation', () => {
  it('accepts a granted, non-expired key', () => {
    expect(interpretLicenseResponse(200, { status: 'granted', expires_at: null }).valid).toBe(true);
  });
  it('rejects revoked, expired, and unknown keys', () => {
    expect(interpretLicenseResponse(200, { status: 'revoked' }).valid).toBe(false);
    expect(
      interpretLicenseResponse(200, { status: 'granted', expires_at: '2020-01-01T00:00:00Z' }, new Date('2026-01-01')).valid
    ).toBe(false);
    expect(interpretLicenseResponse(404, { detail: 'Not found' }).valid).toBe(false);
  });
  it('fails closed without a key or when the server is unreachable', async () => {
    expect((await validateLicense('')).valid).toBe(false);
    const boom = async () => {
      throw new Error('offline');
    };
    expect((await validateLicense('PRGUARD-x', boom)).valid).toBe(false);
  });
});

describe('Pro GitHub actions', () => {
  const cluster: IssueClusterReport = {
    issueNumber: 7,
    totalPRs: 2,
    rankedPRs: [scored(11, 'RECOMMENDED_WINNER', 90), scored(12, 'LIKELY_SLOP', 20)],
  };
  cluster.recommendedWinner = cluster.rankedPRs[0];

  it('formats a comment carrying the sticky marker and the ranking', () => {
    const body = formatClusterComment('o/r', cluster);
    expect(body.startsWith(COMMENT_MARKER)).toBe(true);
    expect(body).toContain('**Review first:** #11 by @user11');
    expect(body).toContain('| 2 | #12 |');
  });

  it('creates a comment when none exists and updates it afterwards', () => {
    const fresh = recorder({ 'issues/7/comments?': JSON.stringify([1, 'unrelated']) + '\n' });
    expect(upsertStickyComment('o/r', 7, 'hello', fresh.gh)).toBe('created');
    expect(fresh.calls.at(-1)!.args).toContain('repos/o/r/issues/7/comments');

    const existing = recorder({ 'issues/7/comments?': JSON.stringify([99, `${COMMENT_MARKER}\nold`]) + '\n' });
    expect(upsertStickyComment('o/r', 7, 'hello', existing.gh)).toBe('updated');
    expect(existing.calls.at(-1)!.args).toContain('repos/o/r/issues/comments/99');
    expect(JSON.parse(existing.calls.at(-1)!.input!)).toEqual({ body: 'hello' });
  });

  it('swaps stale PRGuard labels for the current verdict and leaves others alone', () => {
    const { gh, calls } = recorder();
    const applied = applyVerdictLabel('o/r', scored(12, 'LIKELY_SLOP'), ['prguard: top-contender', 'bug'], gh);
    expect(applied).toBe('prguard: likely-slop');
    const joined = calls.map((c) => c.args.join(' '));
    expect(joined.some((j) => j.includes('DELETE') && j.includes(encodeURIComponent('prguard: top-contender')))).toBe(true);
    expect(joined.some((j) => j.includes('DELETE') && j.includes('bug'))).toBe(false);
    expect(calls.at(-1)!.input).toBe(JSON.stringify({ labels: ['prguard: likely-slop'] }));
  });

  it('removes PRGuard labels from plain contenders without adding one', () => {
    const { gh, calls } = recorder();
    expect(applyVerdictLabel('o/r', scored(13, 'VALID_CONTENDER'), ['prguard: likely-slop'], gh)).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain('DELETE');
  });

  it('shapes webhook payloads for Discord and Slack', () => {
    expect(webhookPayload('https://discord.com/api/webhooks/1/abc', 'hi')).toEqual({ content: 'hi' });
    expect(webhookPayload('https://hooks.slack.com/services/T/B/X', 'hi')).toEqual({ text: 'hi' });
  });
});
