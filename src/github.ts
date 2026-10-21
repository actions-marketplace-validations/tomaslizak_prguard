import { execFileSync } from 'node:child_process';
import { extractLinkedIssues, PullRequestData } from './analyzer.js';

export function fetchOpenPRs(repo: string, limit = 30): PullRequestData[] {
  const query = `
    query($owner: String!, $name: String!, $limit: Int!) {
      repository(owner: $owner, name: $name) {
        pullRequests(states: OPEN, first: $limit, orderBy: {field: CREATED_AT, direction: DESC}) {
          nodes {
            number
            title
            body
            createdAt
            updatedAt
            url
            isDraft
            additions
            deletions
            changedFiles
            author {
              login
            }
            commits(last: 1) {
              nodes {
                commit {
                  statusCheckRollup {
                    state
                  }
                }
              }
            }
            files(first: 50) {
              nodes {
                path
              }
            }
          }
        }
      }
    }
  `;

  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repository format "${repo}". Expected "owner/repo".`);
  }

  const raw = execFileSync(
    'gh',
    [
      'api',
      'graphql',
      '-f',
      `query=${query}`,
      '-F',
      `owner=${owner}`,
      '-F',
      `name=${name}`,
      '-F',
      `limit=${limit}`,
    ],
    { encoding: 'utf-8', maxBuffer: 20 * 1024 * 1024 }
  );

  const parsed = JSON.parse(raw);
  const nodes = parsed?.data?.repository?.pullRequests?.nodes || [];

  return nodes.map((n: any): PullRequestData => {
    const rollupState = n.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state;
    let ciState: PullRequestData['ciState'] = 'UNKNOWN';
    if (rollupState === 'SUCCESS') ciState = 'SUCCESS';
    else if (rollupState === 'FAILURE' || rollupState === 'ERROR') ciState = 'FAILURE';
    else if (rollupState === 'PENDING' || rollupState === 'EXPECTED') ciState = 'PENDING';

    const files = (n.files?.nodes || []).map((f: any) => f.path as string);
    const linkedIssues = extractLinkedIssues(n.title || '', n.body || '');

    return {
      number: n.number,
      title: n.title || '',
      user: n.author?.login || 'ghost',
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      htmlUrl: n.url,
      body: n.body || '',
      additions: n.additions || 0,
      deletions: n.deletions || 0,
      changedFiles: n.changedFiles || files.length,
      files,
      patchSignatures: files, // Fast fallback; enriched when deep patch inspection is enabled
      linkedIssues,
      ciState,
      isDraft: Boolean(n.isDraft),
    };
  });
}
