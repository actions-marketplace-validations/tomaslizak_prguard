# 🛡️ PRGuard — Anti-Slop PR & Bounty Triage Engine

**Stop drowning in 30+ duplicate AI-generated Pull Requests per bounty or `help wanted` issue.**

**PRGuard** is a fast CLI, GitHub Action, and interactive triage dashboard that automatically:
1. **Clusters competing Pull Requests** targeting the same GitHub Issue (`Fixes #61`, `(#61)`).
2. **Detects Near-Clones & Late Duplicate Waves** using Jaccard file/patch similarity and submission timestamps.
3. **Verifies Engineering Signals** (`INCLUDES_TESTS`, `CI_GREEN`, `SURGICAL_SCOPE`) while penalizing `MASSIVE_DIFF_BLOAT` (e.g., 148,000-line accidental lockfile/artifact dumps), `UNSOLICITED_WORKFLOW_EDIT` (`.github/workflows/*` tampering), and known mass-bot prompt templates.
4. **Crowns the Recommended Winner** so maintainers can review the best PR first and close redundant noise in seconds.

🔗 **Live Web Dashboard & Case Studies:** [https://tomaslizak.github.io/prguard/](https://tomaslizak.github.io/prguard/)

---

## 🚀 Quick Start (CLI)

Scan any public or private repository using your `gh` CLI authentication:

```bash
git clone https://github.com/tomaslizak/prguard.git
cd prguard
npm install && npm run build

# Scan open PRs in any repository:
node ./dist/cli.js scan oll4com/spaceapp -l 35 -o audit_report.md
```

---

## 📊 Real-World Live Audit Example (`oll4com/spaceapp`)

When `oll4com/spaceapp` posted funded bounties (`#60`–`#65`), **35 open PRs** accumulated across 7 clusters. Running `prguard scan oll4com/spaceapp` produced this instant triage breakdown in **< 4 seconds**:

- **Issue #61 (9 Competing PRs):** Identified **PR #217** (`@AK-Lmn`, Score **100/100**, `INCLUDES_TESTS` + `CI_GREEN` + `FIRST_RESPONDER`) as the top merge candidate, while flagging **PR #224** for `-25 NEAR_CLONE_OF_EARLIER_PR` and **PR #221** for `-15 MASSIVE_DIFF_BLOAT` (+5,963 lines).
- **Issue #60 (8 Competing PRs):** Flagged **PR #229** (+148,785 lines across 69 files!) and **PR #233** (`LIKELY SLOP`, failing CI + late duplicate wave), surfacing **PR #209** and **PR #245** as the clean winners.
- **Issue #63 (2 Competing PRs):** Flagged **PR #246** (`20/100 LIKELY SLOP`) as a near-clone of **PR #241** with unsolicited workflow modifications and zero test files.

---

## 🤖 GitHub Action Usage

Add `.github/workflows/prguard.yml` to your repository to generate an automated Anti-Slop Triage Summary on every Pull Request:

```yaml
name: PRGuard Anti-Slop Triage
on:
  pull_request_target:
    types: [opened, synchronize, reopened]
  workflow_dispatch:

permissions:
  pull-requests: read
  contents: read

jobs:
  triage:
    runs-on: ubuntu-latest
    steps:
      - uses: tomaslizak/prguard@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          limit: '40'
```

---

## 💼 Maintainer Pro Plans (Powered by Polar.sh)

- **Community (Free Forever):** Full open-source CLI & GitHub Action summary reports.
- **Maintainer Pro ($19/mo or $190/yr):** Sticky ranked triage comments on contested issues (`--comment`), automatic PR verdict labeling (`--label`: `prguard: top-contender`, `prguard: needs-scrutiny`, `prguard: likely-slop`), and Slack/Discord webhook alerts (`--webhook`).
- **Get Instant License Key:** [Buy via Polar.sh Checkout](https://buy.polar.sh/polar_cl_Dx0gfwQa9dlI4lWMAwFANsUaFQQk6STAWCVSC2O5wSL) (`PRGUARD-*` license key issued immediately upon checkout; validate locally with `prguard license <KEY>`).

---

## 📜 License

MIT © [tomaslizak](https://github.com/tomaslizak)
