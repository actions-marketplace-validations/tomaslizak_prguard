---
name: prguard
description: Anti-slop PR & bounty triage engine for GitHub repositories. Clusters competing pull requests by issue, detects duplicate/copycat bot PRs via Jaccard file/patch similarity, verifies test/CI claims, and ranks the best merge candidate automatically.
---

# PRGuard Skill (`prguard`)

Use this skill when triaging open-source repositories, bounty issues (Algora, Opire, Polar.sh), or high-volume pull request queues flooded by competing AI agents.

## Capabilities
- **Issue-Cluster Grouping:** Automatically links open PRs to target issues (`Fixes #N`, `Closes #N`, title references).
- **Copycat & Near-Clone Detection:** Computes pairwise Jaccard similarity across touched file sets and diff hunks to flag cloned PRs.
- **Anti-Slop Heuristics:** Scores PRs (0–100) on test coverage, CI check status, diff surgicality vs. bloat, and unverified test claims in PR descriptions.
- **Automated Maintainer Actions (Pro):** Posts sticky ranked triage tables (`--comment`), applies verdict labels (`--label`), and sends Slack/Discord webhook digests (`--webhook`).

## Quick Start

```bash
# Run a live triage scan on any GitHub repository
npx prguard scan <owner/repo> --limit 50

# Export JSON or Markdown triage report
npx prguard scan <owner/repo> --json > triage-report.json

# Maintainer Pro automation (sticky comment + labels + webhook)
PRGUARD_PRO_KEY=PRGUARD-XXXX npx prguard scan <owner/repo> --comment --label --webhook https://hooks.slack.com/...
```

## Links
- **Live Web Scanner:** https://tomaslizak.github.io/prguard/
- **Repository:** https://github.com/tomaslizak/prguard
- **Pro License ($19/mo or $190/yr):** https://buy.polar.sh/polar_cl_Dx0gfwQa9dlI4lWMAwFANsUaFQQk6STAWCVSC2O5wSL
