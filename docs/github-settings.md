# GitHub repository settings

How the GitHub repo is configured so that `main` is always deployable and
every change goes through a reviewed, squash-merged pull request. These
settings live on GitHub, not in the repo; this file records them so they can
be checked or recreated.

## Branch ruleset: `main`

**Settings → Rules → Rulesets**, one ruleset named `main`.

| Setting | Value | Why |
|---|---|---|
| Enforcement status | **Active** | A new ruleset can start as Disabled, which enforces nothing. |
| Target branches | Default branch (`main`) | |
| Bypass list | **Empty** | See [Bypass list](#bypass-list). |
| Restrict deletions | On | `main` can't be deleted by accident. |
| Block force pushes | On | `main`'s history can't be rewritten. |
| Require a pull request before merging | On | No direct pushes to `main`. |
| Required approvals | **0** | GitHub doesn't let you approve your own PR. Review happens when the maintainer chooses to merge. |
| Allowed merge methods | **Squash** only | One commit per story on `main`. |
| Require status checks to pass | On: the CI `test` job | `main` stays green. Added once the check had run (Story 2). Since 2026-11-20 `test` is a final job that passes only when every other CI job (checks, E2E per browser) passed, so splitting CI into more jobs never changes this setting. |

### Bypass list
On a repo owned by a personal account, individual users can't be added to
the bypass list; the **Repository admin** role is the only way to bypass.

We leave it empty:
- The owner is the admin and can always edit or disable the ruleset, so
  there's no risk of being locked out.
- Claude Code pushes with the owner's GitHub login, so anything the owner can
  bypass, Claude can too. With an empty list, an accidental
  `git push origin main` is rejected by GitHub.

If a bypass is ever needed, add **Repository admin** with mode **"For pull
requests only"** (not "Always"), so direct pushes stay blocked.

## Pull request settings

**Settings → General → Pull Requests**:

| Setting | Value |
|---|---|
| Allow merge commits | Off |
| Allow squash merging | On |
| Allow rebase merging | Off |
| Automatically delete head branches | On (a deleted branch can be restored from its PR) |

When squash-merging, check the commit message GitHub pre-fills; use the
approved commit message.

## Checking the settings

With the [GitHub CLI](https://cli.github.com), from the repo:

```sh
# Rulesets: expect one, "main", enforcement "active"
gh api repos/{owner}/{repo}/rulesets --jq '.[] | {id, name, enforcement}'

# Ruleset details: bypass list, rules, merge methods, required checks
gh api repos/{owner}/{repo}/rulesets/<id> --jq '{enforcement, bypass_actors, rules}'

# Merge settings
gh api repos/{owner}/{repo} \
  --jq '{allow_squash_merge, allow_merge_commit, allow_rebase_merge, delete_branch_on_merge}'
```

`gh` fills in `{owner}` and `{repo}` from the current repo's remote.
