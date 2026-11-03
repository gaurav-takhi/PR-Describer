// Runs on Azure DevOps and GitHub. Detects the "create PR" page, injects a button, fills the form.
(() => {
  const BTN_ID = 'pr-describer-btn';
  const INSTANCE = Math.random().toString(36).slice(2);
  document.getElementById(BTN_ID)?.remove(); // drop a button left by a previous (orphaned) script
  let timer;

  function parseContext() {
    const url = new URL(location.href);
    const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

    if (url.hostname === 'dev.azure.com') {
      const gitIdx = parts.indexOf('_git');
      if (gitIdx < 1 || parts[gitIdx + 2] !== 'pullrequestcreate') return null;
      const sourceRef = url.searchParams.get('sourceRef');
      const targetRef = url.searchParams.get('targetRef');
      if (!sourceRef || !targetRef) return null;
      const repo = parts[gitIdx + 1];
      return {
        platform: 'azure',
        org: parts[0],
        project: gitIdx >= 2 ? parts[1] : repo, // dev.azure.com/org/_git/repo => project == repo
        repo,
        sourceBranch: sourceRef.replace(/^refs\/heads\//, ''),
        targetBranch: targetRef.replace(/^refs\/heads\//, ''),
      };
    }

    if (url.hostname === 'github.com' && parts.length >= 4) {
      const [owner, repo, kind, ...rest] = parts;
      if (kind === 'compare' && rest.length) {
        // /compare/base...head, optionally with owner:branch refs
        const [base, head] = rest.join('/').split('...');
        if (!head) return null;
        const clean = (r) => r.split(':').pop();
        return { platform: 'github', owner, repo, sourceBranch: clean(head), targetBranch: clean(base) };
      }
      if (kind === 'pull' && rest[0] === 'new' && rest.length > 1) {
        return { platform: 'github', owner, repo, sourceBranch: rest.slice(1).join('/'), targetBranch: null };
      }
    }
    return null;
  }

  function findFields(platform) {
    if (platform === 'github') {
      return {
        title: document.querySelector('#pull_request_title'),
        body: document.querySelector('#pull_request_body'),
      };
    }
    const visible = (el) => el && el.offsetParent !== null;
    const title = [...document.querySelectorAll('input[type="text"], input:not([type])')].find(
      (el) => visible(el) && /title/i.test(el.getAttribute('aria-label') || el.id || el.placeholder || '')
    );
    const body = [...document.querySelectorAll('textarea')].find(
      (el) => visible(el) && /description/i.test(el.getAttribute('aria-label') || el.id || el.placeholder || '')
    ) || [...document.querySelectorAll('textarea')].find(visible);
    return { title, body };
  }

  // React-controlled inputs ignore plain .value assignment; use the native setter + events.
  function setValue(el, value) {
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const GRADIENT = 'linear-gradient(135deg, #6366f1, #a855f7)';

  function injectStyles() {
    if (document.getElementById('pr-describer-styles')) return;
    const st = document.createElement('style');
    st.id = 'pr-describer-styles';
    st.textContent = `
      #${BTN_ID} { transition: transform .15s ease, box-shadow .15s ease, filter .15s ease; }
      #${BTN_ID}:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(99,102,241,.55); }
      #${BTN_ID}:active:not(:disabled) { transform: translateY(0); }
      #${BTN_ID}:disabled { cursor: progress; filter: saturate(.7); }
      #${BTN_ID} .prd-spin { animation: prd-spin .8s linear infinite; }
      @keyframes prd-spin { to { transform: rotate(360deg); } }
      @keyframes prd-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    `;
    document.head.appendChild(st);
  }

  const ICON_IDLE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>';
  const ICON_BUSY = '<svg class="prd-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-6.2-8.55" /></svg>';

  function setBtn(btn, busy) {
    btn.innerHTML = `${busy ? ICON_BUSY : ICON_IDLE}<span>${busy ? 'Generating\u2026' : 'Generate PR description'}</span>`;
  }

  function toast(msg, isError) {
    const t = document.createElement('div');
    t.setAttribute('role', 'status');
    t.textContent = msg;
    Object.assign(t.style, {
      position: 'fixed', right: '20px', bottom: '76px', zIndex: 2147483647, maxWidth: '380px',
      padding: '12px 16px', borderRadius: '12px', font: '500 13px/1.45 system-ui, -apple-system, sans-serif',
      color: '#fff', background: isError ? '#b42318' : '#1f2037',
      borderLeft: `4px solid ${isError ? '#fda29b' : '#a855f7'}`,
      boxShadow: '0 12px 32px rgba(0,0,0,.35)', animation: 'prd-in .2s ease-out',
    });
    document.body.appendChild(t);
    setTimeout(() => t.remove(), isError ? 9000 : 4500);
  }

  async function onClick(btn) {
    const ctx = parseContext();
    if (!ctx) return;
    if (!chrome.runtime?.id) {
      toast('Extension was reloaded. Refresh this page (Cmd+R) and try again.', true);
      return;
    }
    const fields = findFields(ctx.platform);
    if (!fields.title || !fields.body) {
      toast(
        ctx.platform === 'github'
          ? 'Click "Create pull request" first so the form appears, then try again.'
          : 'Could not find the title/description fields on this page.',
        true
      );
      return;
    }
    btn.disabled = true;
    setBtn(btn, true);
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'generate', ctx });
      if (!resp?.ok) throw new Error(resp?.error || 'Unknown error');
      setValue(fields.title, resp.result.title);
      setValue(fields.body, resp.result.description);
      if (resp.result.warning) toast(resp.result.warning, true);
      else toast(`Filled (${resp.result.source === 'rules' ? 'rule-based' : resp.result.source}). Review and edit before creating.`);
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
      setBtn(btn, false);
    }
  }

  function sync() {
    const existing = document.getElementById(BTN_ID);
    if (!chrome.runtime?.id) {
      // Orphaned after an extension reload: stop and remove only our own button.
      clearInterval(timer);
      if (existing?.dataset.owner === INSTANCE) existing.remove();
      return;
    }
    if (!parseContext()) {
      existing?.remove();
      return;
    }
    if (existing) return;
    const btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.dataset.owner = INSTANCE;
    injectStyles();
    setBtn(btn, false);
    Object.assign(btn.style, {
      position: 'fixed', right: '20px', bottom: '20px', zIndex: 2147483647,
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      padding: '11px 18px', border: 'none', borderRadius: '999px', cursor: 'pointer',
      font: '600 13px system-ui, -apple-system, sans-serif', color: '#fff', background: GRADIENT,
      boxShadow: '0 6px 20px rgba(99,102,241,.45)',
    });
    btn.addEventListener('click', () => onClick(btn));
    document.body.appendChild(btn);
  }

  // Both sites are SPAs; re-check as the URL changes.
  sync();
  timer = setInterval(sync, 1000);
})();
