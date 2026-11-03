export const SYSTEM_PROMPT = `You write pull request titles and descriptions.
Rules:
- Title: imperative mood, under 72 characters, no trailing period.
- Description: GitHub-flavored markdown. Explain WHAT changed and WHY, grouped logically. Do not just repeat commit messages.
- Only state what the commits and diff support. Never invent features, tickets, or test results.
- Keep ticket IDs found in the branch name or commits.
Respond with ONLY a JSON object: {"title": string, "description": string}.`;

export function buildUserPrompt({ sourceBranch, targetBranch, commits, files, diffText, draft, template, customInstructions, maxChars }) {
  const parts = [];
  parts.push(`Branch: ${sourceBranch} -> ${targetBranch}`);
  parts.push(
    'Commits:\n' +
      commits.map((c) => `- ${c.subject}${c.body ? `\n    ${c.body.trim().replace(/\n/g, '\n    ')}` : ''}`).join('\n')
  );
  parts.push('Changed files:\n' + files.slice(0, 100).map((f) => `- ${f.status} ${f.path}`).join('\n'));
  if (diffText) parts.push(`Diff (may be truncated):\n${diffText}`);
  parts.push(`Rule-based draft to improve on:\nTITLE: ${draft.title}\n${draft.description}`);
  if (maxChars) parts.push(`HARD LIMIT: the description must be under ${maxChars} characters. Be concise and summarize large groups of commits instead of listing each one.`);
  if (template) parts.push(`Use this PR template structure:\n${template}`);
  if (customInstructions) parts.push(`Extra instructions from the user:\n${customInstructions}`);
  return parts.join('\n\n');
}

export function parseLLMJson(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  const obj = JSON.parse(cleaned.slice(start, end + 1));
  if (typeof obj.title !== 'string' || typeof obj.description !== 'string') {
    throw new Error('LLM response missing title/description');
  }
  return { title: obj.title.trim(), description: obj.description.trim() };
}
