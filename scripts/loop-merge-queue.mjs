import { execFileSync } from "node:child_process";

const defaultRequiredChecks = ["lint", "typecheck", "test", "build-smoke", "audit"];

function readArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index === process.argv.length - 1) {
    return null;
  }
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function parseCsv(value) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readRepoFromGit() {
  const remote = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf8" }).trim();
  const httpsMatch = remote.match(/^https:\/\/github\.com\/(.+?)\/(.+?)(?:\.git)?$/);
  if (httpsMatch) {
    return `${httpsMatch[1]}/${httpsMatch[2]}`;
  }
  const sshMatch = remote.match(/^git@github\.com:(.+?)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return `${sshMatch[1]}/${sshMatch[2]}`;
  }
  throw new Error(`Unsupported GitHub remote: ${remote}`);
}

function readTokenFromGitCredential() {
  try {
    const credential = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8"
    });
    return credential.match(/^password=(.+)$/m)?.[1] ?? null;
  } catch {
    return null;
  }
}

function assertToken(token) {
  if (!token) {
    throw new Error("Missing GitHub token. Set GITHUB_TOKEN/GH_TOKEN or configure git credential for github.com.");
  }
}

async function github(repo, token, path, options = {}) {
  const response = await fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "loop-merge-queue",
      ...(options.headers ?? {})
    }
  });
  const text = await response.text();
  let body = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text };
    }
  }
  return {
    body,
    ok: response.ok,
    status: response.status
  };
}

async function getPullRequest(repo, token, number) {
  const result = await github(repo, token, `/pulls/${number}`);
  if (!result.ok) {
    throw new Error(`Failed to fetch PR #${number}: ${result.status} ${result.body.message ?? ""}`);
  }
  return result.body;
}

async function getCheckRuns(repo, token, sha) {
  const result = await github(repo, token, `/commits/${sha}/check-runs`);
  if (!result.ok) {
    throw new Error(`Failed to fetch check runs for ${sha}: ${result.status} ${result.body.message ?? ""}`);
  }
  return result.body.check_runs ?? [];
}

async function waitForMergeable(repo, token, number) {
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    const pr = await getPullRequest(repo, token, number);
    if (pr.mergeable !== null) {
      return pr;
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  return getPullRequest(repo, token, number);
}

async function patchBase(repo, token, number, base) {
  return github(repo, token, `/pulls/${number}`, {
    method: "PATCH",
    body: JSON.stringify({ base })
  });
}

async function mergePullRequest(repo, token, number, sha, method) {
  return github(repo, token, `/pulls/${number}/merge`, {
    method: "PUT",
    body: JSON.stringify({
      commit_title: `Merge PR #${number}`,
      merge_method: method,
      sha
    })
  });
}

function summarizeChecks(checkRuns, requiredChecks) {
  return requiredChecks.map((name) => {
    const run = checkRuns.find((item) => item.name === name);
    return {
      conclusion: run?.conclusion ?? null,
      name,
      status: run?.status ?? "missing"
    };
  });
}

function requiredChecksGreen(checkRuns, requiredChecks) {
  return requiredChecks.every((name) =>
    checkRuns.some((run) => run.name === name && run.status === "completed" && run.conclusion === "success")
  );
}

async function main() {
  const repo = readArg("--repo") ?? process.env.GITHUB_REPOSITORY ?? readRepoFromGit();
  const queue = parseCsv(readArg("--queue") ?? process.env.LOOP_PR_QUEUE ?? "");
  const targetBase = readArg("--target-base") ?? process.env.LOOP_TARGET_BASE ?? "main";
  const mergeMethod = readArg("--merge-method") ?? process.env.LOOP_MERGE_METHOD ?? "merge";
  const requiredChecks = parseCsv(readArg("--required-checks") ?? process.env.LOOP_REQUIRED_CHECKS ?? defaultRequiredChecks.join(","));
  const apply = hasFlag("--apply") || process.env.LOOP_APPLY === "1";
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? process.env.GITHUB_PAT ?? readTokenFromGitCredential();

  assertToken(token);
  if (queue.length === 0) {
    throw new Error("Missing queue. Use --queue 28,29,31 or LOOP_PR_QUEUE=28,29,31.");
  }

  const events = [];

  for (const rawNumber of queue) {
    const number = Number(rawNumber);
    if (!Number.isInteger(number) || number <= 0) {
      throw new Error(`Invalid PR number: ${rawNumber}`);
    }

    let pr = await waitForMergeable(repo, token, number);

    if (pr.state === "closed") {
      events.push({
        action: "skip_closed",
        base: pr.base?.ref,
        head: pr.head?.ref,
        merged: pr.merged,
        pr: number
      });
      continue;
    }

    if (pr.base.ref !== targetBase) {
      if (!apply) {
        events.push({
          action: "would_patch_base",
          currentBase: pr.base.ref,
          pr: number,
          targetBase
        });
      } else {
        const patch = await patchBase(repo, token, number, targetBase);
        events.push({
          action: "patch_base",
          currentBase: pr.base.ref,
          message: patch.body.message ?? null,
          ok: patch.ok,
          pr: number,
          status: patch.status,
          targetBase
        });
        if (!patch.ok) {
          break;
        }
        pr = await waitForMergeable(repo, token, number);
      }
    }

    const checkRuns = await getCheckRuns(repo, token, pr.head.sha);
    const requiredGreen = requiredChecksGreen(checkRuns, requiredChecks);

    events.push({
      action: "pre_merge",
      base: pr.base.ref,
      checks: summarizeChecks(checkRuns, requiredChecks),
      head: pr.head.ref,
      mergeable: pr.mergeable,
      mergeableState: pr.mergeable_state,
      pr: number,
      requiredGreen,
      sha: pr.head.sha,
      state: pr.state
    });

    if (pr.mergeable !== true || pr.mergeable_state === "dirty" || !requiredGreen) {
      events.push({
        action: "blocked",
        pr: number,
        reason: "not_mergeable_or_required_checks_not_green"
      });
      break;
    }

    if (!apply) {
      events.push({
        action: "would_merge",
        pr: number,
        sha: pr.head.sha
      });
      continue;
    }

    const merged = await mergePullRequest(repo, token, number, pr.head.sha, mergeMethod);
    events.push({
      action: "merge",
      message: merged.body.message ?? null,
      merged: merged.body.merged ?? false,
      ok: merged.ok,
      pr: number,
      sha: merged.body.sha ?? null,
      status: merged.status
    });

    if (!merged.ok) {
      events.push({
        action: "blocked",
        pr: number,
        reason: merged.body.message ?? "merge_failed"
      });
      break;
    }
  }

  console.log(
    JSON.stringify(
      {
        apply,
        queue,
        repo,
        requiredChecks,
        targetBase,
        events
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : String(error),
        ok: false
      },
      null,
      2
    )
  );
  process.exitCode = 1;
});
