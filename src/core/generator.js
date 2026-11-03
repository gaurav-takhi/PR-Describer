// Rule-based title/description generator. No network, no key.

const TYPE_LABELS = {
  feat: 'Features',
  fix: 'Bug fixes',
  perf: 'Performance',
  refactor: 'Refactoring',
  docs: 'Documentation',
  test: 'Tests',
  build: 'Build',
  ci: 'CI',
  style: 'Style',
  chore: 'Chores',
  revert: 'Reverts',
  other: 'Other changes',
};
const TYPE_ORDER = Object.keys(TYPE_LABELS);

const CONVENTIONAL = /^(\w+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;
const TICKET = /\b[A-Z][A-Z0-9]+-\d+\b/g;
const ISSUE_REF = /(?:^|\s)#(\d+)\b/g;

export function parseCommit(commit) {
  const subject = commit.subject.trim();
  const m = subject.match(CONVENTIONAL);
  const type = m && TYPE_LABELS[m[1].toLowerCase()] ? m[1].toLowerCase() : 'other';
  return {
    ...commit,
    type,
    scope: m && type !== 'other' ? m[2] || '' : '',
    text: m && type !== 'other' ? m[4] : subject,
    isMerge: /^Merge (branch|pull request|remote-tracking)/i.test(subject),
  };
}

function ticketsFrom(strings) {
  const found = new Set();
  for (const s of strings) {
    for (const t of s.match(TICKET) || []) found.add(t);
    for (const m of s.matchAll(ISSUE_REF)) found.add(`#${m[1]}`);
  }
  return [...found];
}

function humanizeBranch(branch) {
  const name = branch
    .replace(/^(feature|feat|fix|bugfix|hotfix|chore|refactor|docs|task)\//i, '')
    .replace(TICKET, '')
    .replace(/[-_/]+/g, ' ')
    .trim();
  return name;
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

function pickPrimary(commits) {
  return (
    commits.find((c) => c.type === 'feat') ||
    commits.find((c) => c.type === 'fix') ||
    commits[0]
  );
}

function groupFilesByFolder(files) {
  const groups = new Map();
  for (const f of files) {
    const parts = f.path.replace(/^\//, '').split('/');
    const folder = parts.length > 1 ? parts[0] + '/' : '(root)';
    groups.set(folder, (groups.get(folder) || 0) + 1);
  }
  return [...groups.entries()].sort((a, b) => b[1] - a[1]);
}

export function generateDraft({ commits, files, sourceBranch, targetBranch, maxChars = 60000 }) {
  const parsed = commits.map(parseCommit).filter((c) => !c.isMerge);
  const usable = parsed.length ? parsed : commits.map(parseCommit);
  const tickets = ticketsFrom([sourceBranch, ...commits.map((c) => `${c.subject}\n${c.body || ''}`)]);
  const branchTicket = (sourceBranch.match(TICKET) || [])[0];

  // Title
  let title = '';
  const branchWords = humanizeBranch(sourceBranch);
  if (usable.length === 1) {
    title = capitalize(usable[0].text);
  } else if (branchWords.split(/\s+/).length >= 2) {
    title = capitalize(branchWords);
  } else if (usable.length) {
    title = capitalize(pickPrimary(usable).text);
  } else {
    title = capitalize(branchWords) || sourceBranch;
  }
  if (branchTicket && !title.includes(branchTicket)) title = `${branchTicket}: ${title}`;

  // Description, rendered progressively tighter until it fits maxChars.
  const render = ({ bodies, perGroup }) => {
    const lines = [];
    lines.push('## Summary');
    lines.push(`Merges \`${sourceBranch}\` into \`${targetBranch}\` (${commits.length} commit${commits.length === 1 ? '' : 's'}).`);
    lines.push('');
    lines.push('## Changes');
    for (const type of TYPE_ORDER) {
      const group = usable.filter((c) => c.type === type);
      if (!group.length) continue;
      if (usable.some((c) => c.type !== type)) lines.push(`**${TYPE_LABELS[type]}** (${group.length})`);
      for (const c of group.slice(0, perGroup)) {
        const text = c.text.length > 100 ? c.text.slice(0, 97) + '...' : c.text;
        lines.push(`- ${c.scope ? `**${c.scope}:** ` : ''}${text}`);
        if (bodies) {
          const body = (c.body || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 3);
          for (const l of body) lines.push(`  - ${l.replace(/^[-*]\s*/, '')}`);
        }
      }
      if (group.length > perGroup) lines.push(`- ...and ${group.length - perGroup} more`);
      lines.push('');
    }
    if (files.length) {
      lines.push('## Files changed');
      lines.push(`${files.length} file${files.length === 1 ? '' : 's'}: ` +
        groupFilesByFolder(files).slice(0, 6).map(([f, n]) => `\`${f}\` (${n})`).join(', '));
      lines.push('');
    }
    if (tickets.length) {
      lines.push('## Related');
      lines.push(tickets.slice(0, 20).map((t) => `- ${t}`).join('\n'));
      lines.push('');
    }
    return lines.join('\n').trim();
  };

  let description = '';
  for (const opts of [
    { bodies: true, perGroup: Infinity },
    { bodies: false, perGroup: Infinity },
    { bodies: false, perGroup: 15 },
    { bodies: false, perGroup: 8 },
    { bodies: false, perGroup: 4 },
  ]) {
    description = render(opts);
    if (description.length <= maxChars) break;
  }
  if (description.length > maxChars) description = description.slice(0, maxChars - 20).trimEnd() + '\n...(truncated)';

  return { title, description };
}
