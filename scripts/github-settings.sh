#!/usr/bin/env bash
# Applies punchline's GitHub repository settings: merge strategy, security features,
# Actions hardening and the ruleset protecting the default branch.
#
# Usage: scripts/github-settings.sh [owner/repo]
# Needs:  gh (authenticated as a repo admin). Safe to re-run.
#
# Env:    REQUIRED_APPROVALS  approvals needed to merge (default 0 while there is a single
#                             maintainer; GitHub doesn't let you approve your own PR. Set 1
#                             once colleagues can review.)
set -euo pipefail

REPO="${1:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}"
REQUIRED_APPROVALS="${REQUIRED_APPROVALS:-0}"
RULESET_NAME="Protect default branch"
GITHUB_ACTIONS_APP_ID=15368

# Job names of the checks that must pass before merging (see .github/workflows/).
REQUIRED_CHECKS=(
  "Lint, test, build"
  "Secret scan (gitleaks)"
  "Dependency & misconfig scan (Trivy)"
  "Analyze (javascript-typescript)"
  "Analyze (actions)"
  "Dependency review"
)

failures=0
step() {
  local name="$1"
  shift
  if out=$("$@" 2>&1); then
    echo "✔ ${name}"
  else
    echo "✖ ${name}"
    echo "${out}" | sed 's/^/    /' | head -5
    failures=$((failures + 1))
  fi
}
api() { gh api -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

visibility=$(gh repo view "${REPO}" --json visibility -q .visibility)
echo "Configuring ${REPO} (${visibility,,})"
if [[ "${visibility}" != "PUBLIC" ]]; then
  echo "  Note: on a private repo, rulesets need GitHub Pro and secret scanning, code scanning,"
  echo "  dependency review and private vulnerability reporting need paid plans or public"
  echo "  visibility. Those steps may fail below; everything else is still applied."
fi
echo

# --- Merging: squash only, PR title as commit title, tidy branches -----------------------
step "Merge settings (squash only, delete branches)" \
  api --method PATCH "repos/${REPO}" --silent --input - <<'EOF'
{
  "allow_squash_merge": true,
  "allow_merge_commit": false,
  "allow_rebase_merge": false,
  "squash_merge_commit_title": "PR_TITLE",
  "squash_merge_commit_message": "PR_BODY",
  "delete_branch_on_merge": true,
  "allow_update_branch": true,
  "has_wiki": false,
  "has_projects": false
}
EOF

# --- Security features ---------------------------------------------------------------------
step "Dependabot alerts" api --method PUT "repos/${REPO}/vulnerability-alerts" --silent
# Renovate opens the security update PRs; Dependabot only reports.
step "Dependabot security update PRs off (Renovate handles them)" \
  api --method DELETE "repos/${REPO}/automated-security-fixes" --silent
step "Secret scanning + push protection" \
  api --method PATCH "repos/${REPO}" --silent --input - <<'EOF'
{
  "security_and_analysis": {
    "secret_scanning": { "status": "enabled" },
    "secret_scanning_push_protection": { "status": "enabled" }
  }
}
EOF
step "Private vulnerability reporting" \
  api --method PUT "repos/${REPO}/private-vulnerability-reporting" --silent

# --- GitHub Actions hardening ---------------------------------------------------------------
step "Actions: only allowlisted actions, SHA pinning required" \
  api --method PUT "repos/${REPO}/actions/permissions" --silent --input - <<'EOF'
{ "enabled": true, "allowed_actions": "selected", "sha_pinning_required": true }
EOF
step "Actions: allowlist (GitHub-owned, Trivy, Scorecard)" \
  api --method PUT "repos/${REPO}/actions/permissions/selected-actions" --silent --input - <<'EOF'
{
  "github_owned_allowed": true,
  "verified_allowed": false,
  "patterns_allowed": [
    "aquasecurity/trivy-action@*",
    "aquasecurity/setup-trivy@*",
    "ossf/scorecard-action@*"
  ]
}
EOF
step "Actions: read-only GITHUB_TOKEN, no PR approvals by Actions" \
  api --method PUT "repos/${REPO}/actions/permissions/workflow" --silent --input - <<'EOF'
{ "default_workflow_permissions": "read", "can_approve_pull_request_reviews": false }
EOF
if [[ "${visibility}" == "PUBLIC" ]]; then
  step "Actions: approval required for all outside contributors' workflows" \
    api --method PUT "repos/${REPO}/actions/permissions/fork-pr-contributor-approval" \
    --silent -f approval_policy=all_external_contributors
else
  # Scorecard can only publish results for public repositories.
  step "Disable Scorecard workflow (repo is private)" \
    gh workflow disable scorecard.yml --repo "${REPO}"
fi

# --- Ruleset for the default branch ---------------------------------------------------------
# No required_signatures rule: commits pushed by Claude sessions are unsigned, which blocked
# every PR. Squash merges made on GitHub are signed by GitHub, so main stays signed anyway.
checks_json=$(printf '%s\n' "${REQUIRED_CHECKS[@]}" |
  jq -R --argjson app "${GITHUB_ACTIONS_APP_ID}" '{context: ., integration_id: $app}' | jq -s .)

ruleset=$(jq -n \
  --arg name "${RULESET_NAME}" \
  --argjson approvals "${REQUIRED_APPROVALS}" \
  --argjson checks "${checks_json}" '{
  name: $name,
  target: "branch",
  enforcement: "active",
  conditions: { ref_name: { include: ["~DEFAULT_BRANCH"], exclude: [] } },
  bypass_actors: [],
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    { type: "required_linear_history" },
    { type: "pull_request", parameters: {
        required_approving_review_count: $approvals,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
        require_last_push_approval: ($approvals > 0),
        required_review_thread_resolution: true,
        allowed_merge_methods: ["squash"]
    } },
    { type: "required_status_checks", parameters: {
        strict_required_status_checks_policy: true,
        do_not_enforce_on_create: false,
        required_status_checks: $checks
    } },
    { type: "code_scanning", parameters: { code_scanning_tools: [
        { tool: "CodeQL", security_alerts_threshold: "high_or_higher", alerts_threshold: "errors" }
    ] } }
  ]
}')

existing_id=$(api "repos/${REPO}/rulesets" --jq ".[] | select(.name == \"${RULESET_NAME}\") | .id" 2>/dev/null || true)
if [[ -n "${existing_id}" ]]; then
  step "Ruleset '${RULESET_NAME}' (updated)" \
    api --method PUT "repos/${REPO}/rulesets/${existing_id}" --silent --input - <<<"${ruleset}"
else
  step "Ruleset '${RULESET_NAME}' (created)" \
    api --method POST "repos/${REPO}/rulesets" --silent --input - <<<"${ruleset}"
fi

echo
if ((failures > 0)); then
  echo "${failures} step(s) failed. See messages above; most are plan or visibility limits."
  exit 1
fi
echo "All settings applied. Remaining manual step: install the Renovate GitHub App for this repo."
