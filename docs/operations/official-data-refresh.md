# Official data refresh runbook

This runbook defines the production-safe operator path for refreshing Beriday's official waste dataset and producing a verified release artifact.

## Scope

The refresh is intentionally separated from application builds. Production builds must consume the last reviewed and verified official dataset already committed to `main`.

Do not add temporary `push`, `pull_request`, `issue_comment`, or other ad-hoc triggers to bypass `workflow_dispatch`.

## Preconditions

Before starting a refresh:

1. `main` CI must be green.
2. Repository Actions secret `DATA_GO_KR_API_KEY` must exist and contain a valid public-data API credential.
3. `.github/workflows/refresh-official-data.yml` must still use `workflow_dispatch` as its execution trigger.
4. The operator must have permission to run GitHub Actions workflows and review/merge the generated PR.
5. No other official-data refresh should be running. The workflow concurrency group prevents overlapping refresh jobs, but operators should still inspect the Actions page first.

## Start a refresh

### GitHub Actions UI

1. Open the repository on GitHub.
2. Open **Actions**.
3. Select **Refresh official waste data**.
4. Select **Run workflow**.
5. Confirm the branch is `main`.
6. Run the workflow.

### GitHub CLI

From an authenticated GitHub CLI session:

```bash
gh workflow run refresh-official-data.yml \
  --repo BloomBouquet/beriday \
  --ref main
```

Then inspect the newest run:

```bash
gh run list \
  --repo BloomBouquet/beriday \
  --workflow refresh-official-data.yml \
  --limit 5
```

To watch one run until completion:

```bash
gh run watch <run-id> \
  --repo BloomBouquet/beriday \
  --exit-status
```

## What a successful refresh must do

The workflow must complete these gates in order:

1. Check out `main`.
2. Install dependencies.
3. Generate a UTC `IMPORTED_AT` timestamp.
4. Fetch official Open API data with `DATA_GO_KR_API_KEY` injected only through the environment.
5. Generate `public/data/official-data.json` and `data/reports/official-data-validation.json` from the same refresh result.
6. Run `npm run verify:production-data`.
7. Run Domain tests, UI tests, TypeScript typecheck, and production build.
8. Upload the generated asset and validation report as review artifacts.
9. Create `data/official-refresh-<run-id>` only after all previous gates pass.
10. Open a PR against `main` using the repository PR format.

A failed validation, API error, test failure, typecheck failure, or build failure must prevent creation of the data branch and PR.

## Review the generated data PR

Do not merge the generated data PR only because the workflow is green. Review the validation report and confirm at least the following values are plausible for the source refresh:

- `importedAt`
- `sourceUpdatedAt`
- source row count
- accepted row count
- rejected row count
- ambiguous row count
- selectable region count
- rule count
- warnings
- critical errors

`criticalErrors` must be empty. The production preflight also recomputes critical conditions from the deployable bundle, so a forged clean report must still be rejected.

Confirm that the PR changes are limited to the expected production data pair unless an intentionally reviewed workflow change is included separately:

- `public/data/official-data.json`
- `data/reports/official-data-validation.json`

After review, merge the PR and wait for `main` CI to succeed.

## Build the production release artifact

Only after the refreshed data PR is merged and `main` CI is green, run **Build production release** from GitHub Actions.

GitHub CLI equivalent:

```bash
gh workflow run build-production-release.yml \
  --repo BloomBouquet/beriday \
  --ref main
```

The release workflow must:

1. Check out `main`.
2. Run `npm run verify:production-data`.
3. Run repository tests and typecheck.
4. Build the production app.
5. Verify `dist/data/official-data.json` is byte-for-byte identical to `public/data/official-data.json`.
6. Record the actual checked-out commit SHA with `git rev-parse HEAD` in `release-metadata.json`.
7. Upload `dist/`, release metadata, and the validation report as one workflow artifact.

## Failure handling

If the refresh workflow fails:

- Do not manually copy partial output into production paths.
- Do not weaken validation rules to force the refresh through.
- Inspect the failed step and validation report artifact if one exists.
- Fix code or source-contract handling through a normal branch and PR.
- Re-run the manual refresh only after the fix is merged to `main` and `main` CI is green.

If a generated data PR contains suspicious count drift, unexpected region loss, unexpected rule loss, or new critical errors, close the PR without merging and investigate the source or adapter behavior.

## Security boundaries

- API credentials must remain in GitHub Actions secrets or local environment variables and must never be committed, printed, added to PR bodies, or passed as CLI arguments to the refresh script.
- Production data refresh must remain PR-based; the workflow must not commit directly to `main`.
- Release artifact creation must use read-only repository permissions.
- Do not add temporary workflow triggers merely to make remote automation easier to invoke.
- Treat both the deployable asset and validation report as one atomic production data pair.
