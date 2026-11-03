export async function fetchGitHub(ctx, settings) {
  const { owner, repo, sourceBranch, targetBranch } = ctx;
  const headers = { Accept: 'application/vnd.github+json' };
  if (settings.githubPat) headers.Authorization = `Bearer ${settings.githubPat}`;

  const url =
    `https://api.github.com/repos/${owner}/${repo}/compare/` +
    `${encodeURIComponent(targetBranch)}...${encodeURIComponent(sourceBranch)}`;
  const res = await fetch(url, { headers });
  if (res.status === 404 || res.status === 403) {
    throw new Error(
      `GitHub API ${res.status}. For private repos (or rate limits) add a GitHub token in settings.`
    );
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();

  const commits = (data.commits || []).map((c) => {
    const [subject, ...rest] = c.commit.message.split('\n');
    return { sha: c.sha, subject, body: rest.join('\n').trim() };
  });
  const files = (data.files || []).map((f) => ({ path: f.filename, status: f.status, patch: f.patch }));
  return { commits, files };
}

export async function defaultBranch(owner, repo, settings) {
  const headers = { Accept: 'application/vnd.github+json' };
  if (settings.githubPat) headers.Authorization = `Bearer ${settings.githubPat}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  return (await res.json()).default_branch;
}
