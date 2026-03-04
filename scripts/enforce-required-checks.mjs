#!/usr/bin/env node

import { execSync } from "node:child_process";

const API_BASE = "https://api.github.com";
const API_VERSION = "2022-11-28";

function parseArg(name, fallback = "") {
  const prefixed = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefixed));
  return match ? match.slice(prefixed.length) : fallback;
}

function parseCsvArg(name, fallback) {
  const value = parseArg(name, "");
  if (!value) return fallback;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function inferOwnerRepoFromGitRemote() {
  const remote = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
  const normalized = remote.replace(/\.git$/, "");
  const match = normalized.match(/github\.com[:/](.+)\/(.+)$/);
  if (!match) {
    throw new Error("Unable to infer owner/repo from git remote.");
  }
  return { owner: match[1], repo: match[2] };
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "Content-Type": "application/json",
  };
}

async function ghRequest(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: ghHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 204) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.message ?? `GitHub API request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function mergeChecks(existingProtection, requiredChecks) {
  const existingContexts = new Set();
  const requiredStatusChecks = existingProtection?.required_status_checks;

  for (const context of requiredStatusChecks?.contexts ?? []) {
    existingContexts.add(context);
  }

  for (const check of requiredStatusChecks?.checks ?? []) {
    if (check?.context) existingContexts.add(check.context);
  }

  for (const check of requiredChecks) {
    existingContexts.add(check);
  }

  return Array.from(existingContexts).sort();
}

function normalizeUsers(entries = []) {
  return entries.map((entry) => entry.login).filter(Boolean);
}

function normalizeTeams(entries = []) {
  return entries.map((entry) => entry.slug).filter(Boolean);
}

function normalizeApps(entries = []) {
  return entries.map((entry) => entry.slug).filter(Boolean);
}

function protectionPayload(existingProtection, requiredChecks) {
  const checks = mergeChecks(existingProtection, requiredChecks);
  const requiredStatusChecks = existingProtection?.required_status_checks;
  const prReviews = existingProtection?.required_pull_request_reviews;
  const restrictions = existingProtection?.restrictions;

  return {
    required_status_checks: {
      strict: requiredStatusChecks?.strict ?? true,
      contexts: checks,
    },
    enforce_admins: existingProtection?.enforce_admins?.enabled ?? false,
    required_pull_request_reviews: prReviews
      ? {
          dismissal_restrictions: {
            users: normalizeUsers(prReviews.dismissal_restrictions?.users),
            teams: normalizeTeams(prReviews.dismissal_restrictions?.teams),
            apps: normalizeApps(prReviews.dismissal_restrictions?.apps),
          },
          dismiss_stale_reviews: prReviews.dismiss_stale_reviews ?? false,
          require_code_owner_reviews: prReviews.require_code_owner_reviews ?? false,
          required_approving_review_count: prReviews.required_approving_review_count ?? 0,
          require_last_push_approval: prReviews.require_last_push_approval ?? false,
          bypass_pull_request_allowances: {
            users: normalizeUsers(prReviews.bypass_pull_request_allowances?.users),
            teams: normalizeTeams(prReviews.bypass_pull_request_allowances?.teams),
            apps: normalizeApps(prReviews.bypass_pull_request_allowances?.apps),
          },
        }
      : null,
    restrictions: restrictions
      ? {
          users: normalizeUsers(restrictions.users),
          teams: normalizeTeams(restrictions.teams),
          apps: normalizeApps(restrictions.apps),
        }
      : null,
    required_linear_history: existingProtection?.required_linear_history?.enabled ?? false,
    allow_force_pushes: existingProtection?.allow_force_pushes?.enabled ?? false,
    allow_deletions: existingProtection?.allow_deletions?.enabled ?? false,
    block_creations: existingProtection?.block_creations?.enabled ?? false,
    required_conversation_resolution:
      existingProtection?.required_conversation_resolution?.enabled ?? false,
    lock_branch: existingProtection?.lock_branch?.enabled ?? false,
    allow_fork_syncing: existingProtection?.allow_fork_syncing?.enabled ?? false,
  };
}

async function upsertBranchProtection({ owner, repo, branch, token, requiredChecks }) {
  let existingProtection = null;

  try {
    existingProtection = await ghRequest(
      `/repos/${owner}/${repo}/branches/${branch}/protection`,
      { token },
    );
  } catch (error) {
    if (error.status !== 404) throw error;
  }

  const payload = protectionPayload(existingProtection, requiredChecks);

  await ghRequest(`/repos/${owner}/${repo}/branches/${branch}/protection`, {
    method: "PUT",
    token,
    body: payload,
  });
}

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(
      "Missing GITHUB_TOKEN. Provide a token with repository administration:write permission.",
    );
  }

  const inferred = inferOwnerRepoFromGitRemote();
  const owner = parseArg("owner", inferred.owner);
  const repo = parseArg("repo", inferred.repo);
  const branches = parseCsvArg("branches", ["main", "develop"]);
  const requiredChecks = parseCsvArg("checks", ["workspace-dependency-guard"]);

  if (!branches.length) throw new Error("No branches supplied.");
  if (!requiredChecks.length) throw new Error("No required checks supplied.");

  for (const branch of branches) {
    await upsertBranchProtection({
      owner,
      repo,
      branch,
      token,
      requiredChecks,
    });
    console.log(
      `Updated branch protection for ${owner}/${repo}:${branch} with required checks: ${requiredChecks.join(", ")}`,
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to enforce required checks: ${message}`);
  process.exit(1);
});
