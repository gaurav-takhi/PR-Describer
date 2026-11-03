function globToRegex(glob) {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`(^|/)${escaped}$`);
}

export function filterFiles(files, ignoreText) {
  const patterns = ignoreText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(globToRegex);
  return files.filter((f) => !patterns.some((re) => re.test(f.path.replace(/^\//, ''))));
}

// Concatenate per-file patches until the character budget is spent.
export function buildDiffText(files, maxChars) {
  let out = '';
  for (const f of files) {
    if (!f.patch) continue;
    const chunk = `--- ${f.path} (${f.status})\n${f.patch}\n`;
    if (out.length + chunk.length > maxChars) {
      const room = maxChars - out.length;
      if (room > 200) out += chunk.slice(0, room) + '\n[truncated]\n';
      break;
    }
    out += chunk;
  }
  return out;
}
