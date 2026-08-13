# GitHub growth and launch plan

## Objective

Create legitimate GitHub-star growth by shipping a repository developers can run, commit, embed, extend, and install in CI.

The goal is not a high star count detached from product use. The goal is a compounding loop:

```text
interesting repository
→ successful scan
→ committed lockfile or graph
→ repository visibility
→ Action installation
→ provider contribution
→ better coverage
→ more useful scans
```

## Star-worthy surfaces

## 1. One-command demo

The README hero must show:

```bash
npx develra scan
```

followed by useful output within seconds.

Requirements:

- no account;
- no API key;
- no config for a common repository;
- no network;
- no package installation into the target repository;
- clear confidence labels;
- obvious artifacts.

## 2. Generated SVG graph

The graph is the most naturally shareable artifact.

It should:

- display the repository at the center;
- group providers by category where useful;
- distinguish confirmed/probable/possible visually without relying only on color;
- remain legible in GitHub Markdown;
- use no external assets;
- include discreet attribution;
- be deterministic;
- be easy to regenerate.

README embed:

```markdown
![External contract map](./develra-graph.svg)
```

Do not create a misleading “health” badge based on incomplete evidence.

## 3. Commit-worthy lockfile

The lockfile creates recurring exposure inside pull requests and repository browsing.

Optimize for:

- stable diffs;
- recognizable provider/operation names;
- minimal noise;
- no machine-specific data;
- useful `check` remediation.

A committed lockfile is a stronger activation than a star.

## 4. GitHub Action

The Action creates native discovery through:

- workflow files;
- Marketplace;
- job summaries;
- reusable examples;
- repository status checks.

Keep core permissions read-only.

## 5. Provider contribution loop

Provider packs should support small pull requests.

Create:

- `_template.yaml`;
- a generator or scaffold command later;
- `providers validate`;
- provider-specific fixtures;
- good-first-issue list for missing providers;
- clear evidence requirements.

API vendors may have an incentive to add official support because it improves detectability.

## 6. Breakage Museum

Create inside the same repository:

```text
examples/breakage-museum/
```

Each case includes:

```text
README.md
before/
after/
expected/
```

Initial categories:

- removed response field;
- optional-to-required request field;
- nullable response change;
- enum expansion;
- webhook event/payload change;
- API version change;
- SDK operation rename;
- MCP tool input-schema change;
- MCP tool output-schema change.

The first release may include a small curated set with synthetic or licensed examples. Never copy proprietary vendor code or terms beyond what is necessary and allowed.

The corpus serves as:

- demonstration;
- regression suite;
- benchmark;
- launch content;
- future community contribution surface.

## Repository presentation

Recommended repository metadata:

**Name:** `develra`

**Description:**

> A local-first lockfile and scanner for external APIs, SDKs, endpoints, webhooks, and MCP servers.

**Topics:**

```text
api
developer-tools
static-analysis
openapi
mcp
github-actions
typescript
python
dependency-management
```

Use only accurate topics.

README sections above the fold:

1. tagline;
2. terminal demo;
3. generated graph;
4. why it exists;
5. one-command quick start;
6. privacy/local-first statement.

Avoid leading with architecture, pricing, or a waitlist.

## README conversion

A reader should answer within 30 seconds:

- What does this do?
- Why is it different?
- Can I try it without signup?
- Does it upload my code?
- What output will I get?
- How do I use it in CI?
- Can I contribute support for my provider?

Place a star request only after demonstrating value:

> If Develra found an external dependency you had forgotten about, consider starring the project.

Do not show the request on every CLI run. At most, display it once after a successful first scan, with a local suppression marker or only under an explicitly interactive condition.

## Launch assets

Prepare before public launch:

- polished README;
- 10–20 second terminal recording;
- sample graph;
- one compelling real or synthetic repository example;
- release notes;
- architecture diagram;
- privacy page;
- provider contribution guide;
- 5–10 good first issues;
- Show HN draft;
- Dev.to/blog technical article;
- concise social demo;
- GitHub Marketplace listing.

## Launch story

Recommended headline:

> Show HN: Develra — a lockfile for every external API your code depends on

Core narrative:

1. package lockfiles know installed code;
2. applications also depend on remote contracts;
3. those contracts are usually invisible in source control;
4. Develra maps them locally;
5. it writes a reviewable lockfile and CI check;
6. no signup or source upload.

Do not lead with future AI summaries or paid monitoring.

## Demonstration repository

Include or maintain a small sample application that uses:

- Stripe;
- OpenAI or Anthropic;
- Slack/Resend;
- one raw HTTP integration;
- one MCP configuration;
- one unknown host.

A scan should produce a visually rich but understandable result.

Keep the sample in the main repository under `examples/` initially rather than splitting star attention.

## Ongoing content loop

After launch, reuse product data and examples for:

- “external contract of the week” releases;
- provider-pack additions;
- Breakage Museum cases;
- before/after scan screenshots;
- technical posts about detection precision;
- benchmark reports;
- public roadmap issues.

Do not manufacture activity with empty releases.

## Ethical constraints

Never:

- buy stars;
- trade stars;
- use star-exchange communities;
- request GitHub permissions that include starring;
- auto-open GitHub star pages;
- gate functionality behind starring;
- misrepresent stars as users;
- spam issues, pull requests, or repository owners;
- scan public repositories and contact maintainers indiscriminately.

Authentic star growth comes from useful artifacts and clear distribution.

## Metrics

Track separately:

### Awareness

- repository views;
- unique visitors;
- stars;
- clones;
- release page views.

### Activation

- successful scans;
- lockfiles written;
- graphs generated;
- repeat scans;
- local checks;
- Action installations.

### Contribution

- provider pull requests;
- provider requests with reproducible fixtures;
- external contributors;
- issue-to-merge time.

### Hosted funnel later

- registry checks;
- hosted repository connections;
- watches created;
- relevant alerts;
- paid organizations.

Do not add default telemetry merely to measure these. Use public GitHub/npm metrics and explicit opt-in hosted events until a privacy-reviewed telemetry design exists.

## Interpreting outcomes

### Many stars, few installs

The concept or README is interesting, but packaging or immediate utility is weak.

### Many scans, few lockfiles

The output is a novelty. Improve stability, review value, and remediation.

### Lockfiles, few Action installs

Static inventory is useful, but recurring enforcement may be unclear or cumbersome.

### Action installs, no hosted interest later

The local product may be sufficient. Hosted differentiation must focus on upstream data and team workflow, not locking local features.

### Modest stars, strong repository adoption

This can still be a strong business. Do not optimize away from actual use merely to improve the star graph.

## Repository concentration

Do not split these into separate public repositories at launch:

- CLI;
- Action;
- provider packs;
- graph renderer;
- Breakage Museum;
- MCP scanner.

One repository concentrates:

- stars;
- issues;
- contributors;
- search authority;
- documentation;
- release attention.

Split only when independent release cadence or governance makes it necessary.
