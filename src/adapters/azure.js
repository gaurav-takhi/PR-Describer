// Azure DevOps: PR doesn't exist yet, so we compare branches directly.

const API = 'api-version=7.1';

function authInit(settings) {
  if (settings.azurePat) {
    return { headers: { Authorization: 'Basic ' + btoa(':' + settings.azurePat) }, credentials: 'omit' };
  }
  return { headers: {}, credentials: 'include' }; // reuse the logged-in browser session
}

async function azureFetch(settings, url, init = {}) {
  const auth = authInit(settings);
  const res = await fetch(url, {
    ...init,
    credentials: auth.credentials,
    headers: { 'Content-Type': 'application/json', ...auth.headers, ...(init.headers || {}) },
  });
  if (res.status === 401 || res.status === 203) {
    throw new Error('Azure DevOps auth failed. Log in to Azure DevOps in this browser, or add a PAT in settings.');
  }
  if (!res.ok) throw new Error(`Azure DevOps ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const STATUS = { add: 'added', edit: 'modified', delete: 'deleted', rename: 'renamed' };

export async function fetchAzure(ctx, settings) {
  const { org, project, repo, sourceBranch, targetBranch } = ctx;
  const base = `https://dev.azure.com/${org}/${project}/_apis/git/repositories/${repo}`;

  const diffRes = await azureFetch(
    settings,
    `${base}/diffs/commits?baseVersion=${encodeURIComponent(targetBranch)}&baseVersionType=branch` +
      `&targetVersion=${encodeURIComponent(sourceBranch)}&targetVersionType=branch&$top=500&${API}`
  );

  // commitsbatch direction semantics are unclear, so fetch both orders and use the
  // diff's aheadCount (commits in source not in target) to pick the correct one.
  const batch = async (item, compare) => {
    const res = await azureFetch(settings, `${base}/commitsbatch?${API}`, {
      method: 'POST',
      body: JSON.stringify({
        itemVersion: { versionType: 'branch', version: item },
        compareVersion: { versionType: 'branch', version: compare },
        $top: 500,
      }),
    });
    return (res.value || []).map((c) => {
      const [subject, ...rest] = (c.comment || '').split('\n');
      return { sha: c.commitId, subject, body: rest.join('\n').trim() };
    });
  };
  const [a, b] = await Promise.all([batch(sourceBranch, targetBranch), batch(targetBranch, sourceBranch)]);
  const ahead = diffRes.aheadCount;
  let picked;
  if (typeof ahead === 'number') {
    picked = Math.abs(a.length - ahead) <= Math.abs(b.length - ahead) ? a : b;
  } else {
    picked = a.length ? a : b;
  }
  const commits = picked.slice().reverse(); // oldest first
  const files = (diffRes.changes || [])
    .filter((c) => c.item && !c.item.isFolder)
    .map((c) => ({
      path: c.item.path,
      status: STATUS[String(c.changeType).split(',')[0].trim().toLowerCase()] || String(c.changeType),
      // Azure has no unified-patch endpoint; patch text is not available in v0.1.
    }));

  return { commits, files };
}
