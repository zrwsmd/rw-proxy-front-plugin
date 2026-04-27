import * as vscode from 'vscode';

export function getWebviewHtml(webview: vscode.Webview, nonce: string): string {
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>rw-proxy</title>
</head>
<body>
  <div id="app">Loading...</div>
  <script nonce="${nonce}">
    ${getWebviewScript()}
  </script>
</body>
</html>`;
}

function getWebviewScript(): string {
  return `
    (function () {
      const vscode = acquireVsCodeApi();
      const previous = vscode.getState() || {};
      const app = document.getElementById('app');

      const state = {
        role: 'Architect',
        hasApiKey: false,
        serviceUrl: 'http://127.0.0.1:3000',
        connectionStatus: 'disconnected',
        connectionError: '',
        models: [],
        selectedModel: '',
        recentTasks: [],
        messages: Array.isArray(previous.messages) ? previous.messages : [],
        input: previous.input || '',
        accountOpen: !!previous.accountOpen,
        loading: false,
        requestId: '',
        showAllTasks: !!previous.showAllTasks,
      };

      const styles = \`
        :root {
          --bg: #131517;
          --panel: #191c1f;
          --panel-alt: #111315;
          --panel-soft: #1e2227;
          --text: #eef2f6;
          --muted: #8d97a5;
          --line: rgba(255,255,255,0.07);
          --brand: #4aa6ff;
          --brand-strong: #0f6fcb;
          --success: #24c56d;
          --danger: #ef5350;
          --warning: #fbbf24;
          --chip: #20252b;
          --shadow: 0 16px 38px rgba(0,0,0,0.34);
        }

        * { box-sizing: border-box; }

        html, body {
          margin: 0;
          height: 100%;
          background: radial-gradient(circle at top right, rgba(35, 76, 135, 0.28), transparent 28%), var(--bg);
          color: var(--text);
          font-family: Consolas, 'Segoe UI', sans-serif;
        }

        #app {
          height: 100%;
        }

        body {
          padding: 0;
          overflow: hidden;
        }

        button, input, textarea, select {
          font: inherit;
        }

        .shell {
          height: 100vh;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden;
        }

        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px 10px;
        }

        .brand-inline {
          font-size: 12px;
          letter-spacing: 0.16em;
          color: #dfe7f3;
          opacity: 0.92;
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .icon-btn {
          border: 1px solid transparent;
          background: transparent;
          color: var(--muted);
          width: 30px;
          height: 30px;
          border-radius: 10px;
          cursor: pointer;
          transition: 140ms ease;
        }

        .icon-btn:hover {
          color: var(--text);
          border-color: var(--line);
          background: rgba(255,255,255,0.04);
        }

        .version-pill {
          border: 1px solid var(--line);
          border-radius: 999px;
          padding: 7px 11px;
          font-size: 11px;
          color: var(--muted);
          background: rgba(255,255,255,0.02);
        }

        .content {
          flex: 1 1 auto;
          min-height: 0;
          padding: 8px 22px 18px;
          overflow-y: auto;
        }

        .hero {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 26px 0 18px;
        }

        .logo-grid {
          width: 54px;
          height: 54px;
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 2px;
          align-content: start;
        }

        .logo-grid span {
          width: 7px;
          height: 7px;
          border-radius: 2px;
          background: linear-gradient(135deg, #eef6ff 0%, #9ecdf7 100%);
          opacity: 0.95;
        }

        .logo-grid span.void {
          opacity: 0;
        }

        .hero-title {
          font-size: 19px;
          font-weight: 700;
          margin: 0 0 2px;
        }

        .hero-subtitle {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
        }

        .connection-banner {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 14px 16px;
          background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01));
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-bottom: 18px;
        }

        .connection-banner strong {
          display: block;
          margin-bottom: 4px;
          font-size: 13px;
        }

        .connection-banner p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }

        .primary-btn, .secondary-btn, .ghost-btn, .danger-btn {
          border: 0;
          border-radius: 12px;
          padding: 10px 14px;
          cursor: pointer;
          transition: 140ms ease;
        }

        .primary-btn {
          background: linear-gradient(135deg, var(--brand), var(--brand-strong));
          color: white;
          box-shadow: 0 10px 24px rgba(24, 112, 208, 0.28);
        }

        .primary-btn:hover {
          transform: translateY(-1px);
        }

        .secondary-btn {
          background: rgba(255,255,255,0.05);
          color: var(--text);
          border: 1px solid var(--line);
        }

        .ghost-btn {
          background: transparent;
          color: var(--muted);
          padding-left: 0;
          padding-right: 0;
        }

        .danger-btn {
          background: rgba(239,83,80,0.14);
          color: #ffb3b2;
          border: 1px solid rgba(239,83,80,0.22);
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin: 14px 0 12px;
        }

        .section-header h2 {
          margin: 0;
          font-size: 14px;
          font-weight: 700;
          color: #d7dde7;
        }

        .section-link {
          border: 0;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          padding: 0;
        }

        .recent-list {
          display: grid;
          gap: 10px;
        }

        .task-card {
          border: 1px solid var(--line);
          background: rgba(0,0,0,0.18);
          border-radius: 18px;
          padding: 16px;
          cursor: pointer;
          transition: 140ms ease;
        }

        .task-card:hover {
          border-color: rgba(74,166,255,0.45);
          background: rgba(255,255,255,0.03);
        }

        .task-card strong {
          display: block;
          font-size: 15px;
          margin-bottom: 8px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .task-meta {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          color: var(--muted);
          font-size: 12px;
        }

        .empty-card {
          border: 1px dashed var(--line);
          border-radius: 18px;
          padding: 18px;
          color: var(--muted);
          background: rgba(255,255,255,0.02);
          font-size: 12px;
          line-height: 1.6;
        }

        .messages {
          margin-top: 16px;
          display: grid;
          gap: 12px;
          padding-bottom: 4px;
        }

        .message {
          border-radius: 18px;
          padding: 14px 16px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
        }

        .message.user {
          background: rgba(74,166,255,0.12);
          border-color: rgba(74,166,255,0.22);
        }

        .message.assistant {
          background: rgba(255,255,255,0.03);
        }

        .message.error {
          background: rgba(239,83,80,0.11);
          border-color: rgba(239,83,80,0.22);
        }

        .message-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 8px;
          font-size: 11px;
          color: var(--muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .message-body {
          white-space: pre-wrap;
          line-height: 1.6;
          font-size: 13px;
          word-break: break-word;
        }

        .composer-shell {
          position: relative;
          flex: 0 0 auto;
          padding: 0 22px 18px;
          background: linear-gradient(180deg, rgba(19,21,23,0), rgba(19,21,23,0.92) 22%, rgba(19,21,23,1) 42%);
        }

        .composer-card {
          border: 1px solid rgba(74,166,255,0.45);
          background: rgba(19, 22, 25, 0.94);
          box-shadow: var(--shadow);
          border-radius: 18px;
          padding: 12px;
        }

        .composer {
          display: grid;
          gap: 12px;
        }

        .composer textarea {
          width: 100%;
          min-height: 88px;
          max-height: 220px;
          resize: vertical;
          border: 0;
          outline: none;
          background: transparent;
          color: var(--text);
          font-size: 15px;
          line-height: 1.6;
        }

        .composer textarea::placeholder,
        .muted-copy {
          color: var(--muted);
        }

        .composer-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }

        .chip-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
        }

        .chip {
          border-radius: 999px;
          background: var(--chip);
          border: 1px solid var(--line);
          color: #d8e1ec;
          padding: 8px 11px;
          font-size: 12px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .chip.good {
          color: #91e7b4;
          border-color: rgba(36,197,109,0.2);
          background: rgba(36,197,109,0.1);
        }

        .chip.bad {
          color: #ffb3b2;
          border-color: rgba(239,83,80,0.2);
          background: rgba(239,83,80,0.1);
        }

        .model-select {
          background: var(--chip);
          color: var(--text);
          border: 1px solid var(--line);
          border-radius: 12px;
          padding: 8px 10px;
          min-width: 180px;
        }

        .composer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }

        .send-btn {
          min-width: 110px;
        }

        .drawer-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.42);
          opacity: 0;
          pointer-events: none;
          transition: 160ms ease;
        }

        .drawer-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }

        .drawer {
          position: fixed;
          top: 0;
          right: 0;
          width: min(92vw, 360px);
          height: 100vh;
          background: #171a1d;
          border-left: 1px solid var(--line);
          box-shadow: var(--shadow);
          transform: translateX(100%);
          transition: 180ms ease;
          display: flex;
          flex-direction: column;
          z-index: 5;
        }

        .drawer.open {
          transform: translateX(0);
        }

        .drawer-body {
          padding: 26px 18px 20px;
          overflow-y: auto;
          display: grid;
          gap: 20px;
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .account-card {
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 16px;
          background: rgba(255,255,255,0.02);
        }

        .account-card h3 {
          margin: 0 0 12px;
          font-size: 18px;
        }

        .field {
          display: grid;
          gap: 8px;
          margin-bottom: 14px;
        }

        .field label {
          font-size: 12px;
          color: var(--muted);
        }

        .field input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: rgba(255,255,255,0.03);
          color: var(--text);
          padding: 11px 12px;
          outline: none;
        }

        .field input:focus {
          border-color: rgba(74,166,255,0.55);
        }

        .hint {
          color: var(--muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .inline-status {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: var(--muted);
          font-size: 12px;
          margin-bottom: 10px;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          display: inline-block;
          background: var(--muted);
          margin-right: 8px;
        }

        .dot.connected { background: var(--success); }
        .dot.loading { background: var(--warning); }
        .dot.error { background: var(--danger); }

        .drawer-actions {
          display: grid;
          gap: 10px;
        }

        .toast {
          position: fixed;
          left: 22px;
          right: 22px;
          top: 58px;
          padding: 12px 14px;
          border-radius: 14px;
          background: rgba(239,83,80,0.92);
          color: white;
          box-shadow: var(--shadow);
          transform: translateY(-10px);
          opacity: 0;
          pointer-events: none;
          transition: 150ms ease;
          z-index: 10;
        }

        .toast.show {
          opacity: 1;
          transform: translateY(0);
        }

        .loading-dots::after {
          content: '...';
          display: inline-block;
          width: 1.2em;
          animation: dots 1s steps(3, end) infinite;
          overflow: hidden;
          vertical-align: bottom;
        }

        @keyframes dots {
          from { width: 0; }
          to { width: 1.2em; }
        }
      \`;

      const mark = [
        '', '', '', '', '',
        '', '', '', '', '',
        'void', 'void', '', 'void', 'void',
        'void', 'void', '', 'void', 'void',
        'void', 'void', '', 'void', 'void'
      ].map((name) => '<span class="' + name + '"></span>').join('');

      app.innerHTML = \`
        <style>\${styles}</style>
        <div class="shell">
          <div class="toast" id="toast"></div>
          <div class="topbar">
            <div class="brand-inline">RW-PROXY</div>
            <div class="top-actions">
              <button class="icon-btn" id="newChatBtn" title="New Chat">✎</button>
              <button class="icon-btn" id="refreshBtn" title="Refresh Models">⟳</button>
              <button class="icon-btn" id="accountBtn" title="Account">◉</button>
              <div class="version-pill">v0.0.1</div>
            </div>
          </div>

          <div class="content" id="content">
            <section class="hero">
              <div class="logo-grid">\${mark}</div>
              <div>
                <h1 class="hero-title">rw-proxy</h1>
                <p class="hero-subtitle">My AI Superpower</p>
              </div>
            </section>

            <section id="connectionBannerWrap"></section>

            <section id="recentTasksSection"></section>

            <section class="messages" id="messages"></section>
          </div>

          <div class="composer-shell">
            <div class="composer-card">
              <div class="composer">
                <textarea id="composerInput" placeholder="Type your task here..."></textarea>
                <div class="muted-copy">(@ to add context, / for commands, hold shift to drag in files/images)</div>
                <div class="composer-toolbar">
                  <div class="chip-row">
                    <span class="chip" id="roleChip">🏗 \${state.role}</span>
                    <select id="modelSelect" class="model-select"></select>
                    <span class="chip" id="statusChip">Disconnected</span>
                  </div>
                  <div class="composer-actions">
                    <button class="secondary-btn" id="openGatewayBtn">Visit rw-proxy</button>
                    <button class="primary-btn send-btn" id="sendBtn">Send Task</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="drawer-backdrop" id="drawerBackdrop"></div>
          <aside class="drawer" id="drawer">
            <div class="drawer-body">
              <div class="drawer-header">
                <div>
                  <div class="brand-inline">Account</div>
                  <h2 style="margin: 8px 0 0; font-size: 20px;">rw-proxy</h2>
                </div>
                <button class="icon-btn" id="closeDrawerBtn" title="Close">✕</button>
              </div>

              <div class="account-card">
                <div class="inline-status">
                  <span><span class="dot" id="drawerStatusDot"></span><span id="drawerStatusText">Disconnected</span></span>
                  <span id="drawerStatusMeta"></span>
                </div>

                <div class="field">
                  <label for="apiKeyInput">API Key</label>
                  <input id="apiKeyInput" type="password" placeholder="Paste your rw-proxy API key" />
                </div>

                <div class="field">
                  <label for="serviceUrlInput">Gateway URL</label>
                  <input id="serviceUrlInput" type="text" placeholder="http://127.0.0.1:3000" />
                </div>

                <div class="hint">First version assumption: one API key, one rw-proxy gateway, many models behind it.</div>
              </div>

              <div class="drawer-actions">
                <button class="primary-btn" id="connectBtn">Connect</button>
                <button class="secondary-btn" id="drawerVisitBtn">Visit rw-proxy</button>
                <button class="secondary-btn" id="drawerBackBtn">Back to Chat</button>
                <button class="danger-btn" id="disconnectBtn">Disconnect</button>
              </div>
            </div>
          </aside>
        </div>
      \`;

      const toastEl = document.getElementById('toast');
      const connectionBannerWrap = document.getElementById('connectionBannerWrap');
      const recentTasksSection = document.getElementById('recentTasksSection');
      const messagesEl = document.getElementById('messages');
      const inputEl = document.getElementById('composerInput');
      const modelSelectEl = document.getElementById('modelSelect');
      const statusChipEl = document.getElementById('statusChip');
      const roleChipEl = document.getElementById('roleChip');
      const sendBtn = document.getElementById('sendBtn');
      const openGatewayBtn = document.getElementById('openGatewayBtn');
      const accountBtn = document.getElementById('accountBtn');
      const refreshBtn = document.getElementById('refreshBtn');
      const newChatBtn = document.getElementById('newChatBtn');
      const drawer = document.getElementById('drawer');
      const drawerBackdrop = document.getElementById('drawerBackdrop');
      const closeDrawerBtn = document.getElementById('closeDrawerBtn');
      const connectBtn = document.getElementById('connectBtn');
      const disconnectBtn = document.getElementById('disconnectBtn');
      const drawerVisitBtn = document.getElementById('drawerVisitBtn');
      const drawerBackBtn = document.getElementById('drawerBackBtn');
      const apiKeyInput = document.getElementById('apiKeyInput');
      const serviceUrlInput = document.getElementById('serviceUrlInput');
      const drawerStatusDot = document.getElementById('drawerStatusDot');
      const drawerStatusText = document.getElementById('drawerStatusText');
      const drawerStatusMeta = document.getElementById('drawerStatusMeta');

      function saveState() {
        vscode.setState({
          messages: state.messages,
          input: inputEl.value,
          accountOpen: state.accountOpen,
          showAllTasks: state.showAllTasks,
        });
      }

      function showToast(message) {
        toastEl.textContent = message;
        toastEl.classList.add('show');
        window.clearTimeout(showToast._timer);
        showToast._timer = window.setTimeout(function () {
          toastEl.classList.remove('show');
        }, 2600);
      }

      function statusLabel() {
        if (state.connectionStatus === 'connected') return 'Connected';
        if (state.connectionStatus === 'loading') return 'Connecting';
        if (state.connectionStatus === 'error') return 'Connection error';
        return 'Disconnected';
      }

      function renderStatus() {
        roleChipEl.textContent = '🏗 ' + state.role;
        statusChipEl.textContent = statusLabel();
        statusChipEl.className = 'chip ' + (state.connectionStatus === 'connected' ? 'good' : state.connectionStatus === 'error' ? 'bad' : '');

        drawerStatusDot.className = 'dot ' + (state.connectionStatus === 'connected' ? 'connected' : state.connectionStatus === 'loading' ? 'loading' : state.connectionStatus === 'error' ? 'error' : '');
        drawerStatusText.textContent = statusLabel();
        drawerStatusMeta.textContent = state.selectedModel ? state.selectedModel : '';

        sendBtn.disabled = state.loading || state.connectionStatus !== 'connected';
        refreshBtn.disabled = state.connectionStatus === 'loading';
        openGatewayBtn.disabled = !state.serviceUrl;
        drawerVisitBtn.disabled = !state.serviceUrl;
      }

      function renderConnectionBanner() {
        if (state.connectionStatus === 'connected') {
          connectionBannerWrap.innerHTML = '';
          return;
        }

        const description = state.connectionStatus === 'error'
          ? state.connectionError || 'The gateway rejected this API key.'
          : state.connectionStatus === 'loading'
            ? 'Loading models from rw-proxy...'
            : 'Connect once with your rw-proxy API key, then pick any model your token can access.';

        const buttonText = state.connectionStatus === 'error' ? 'Fix Connection' : 'Connect API Key';

        connectionBannerWrap.innerHTML = \`
          <div class="connection-banner">
            <div>
              <strong>\${statusLabel()}</strong>
              <p>\${escapeHtml(description)}</p>
            </div>
            <button class="primary-btn" id="bannerConnectBtn">\${buttonText}</button>
          </div>
        \`;

        const bannerBtn = document.getElementById('bannerConnectBtn');
        if (bannerBtn) {
          bannerBtn.onclick = function () {
            openDrawer();
          };
        }
      }

      function renderRecentTasks() {
        const tasks = state.showAllTasks ? state.recentTasks : state.recentTasks.slice(0, 3);
        const toggleLabel = state.showAllTasks ? 'Show less' : 'View all';

        let body = '';
        if (!tasks.length) {
          body = '<div class="empty-card">No recent tasks yet. Your successful prompts will appear here for quick reruns.</div>';
        } else {
          body = '<div class="recent-list">' + tasks.map(function (task) {
            return \`
              <button class="task-card" data-task-id="\${task.id}">
                <strong>\${escapeHtml(task.title)}</strong>
                <div class="task-meta">
                  <span>\${escapeHtml(relativeTime(task.createdAt))}</span>
                  <span>\${escapeHtml(task.model || 'No model')}</span>
                </div>
              </button>
            \`;
          }).join('') + '</div>';
        }

        recentTasksSection.innerHTML = \`
          <div class="section-header">
            <h2>Recent Tasks</h2>
            <button class="section-link" id="toggleTasksBtn">\${state.recentTasks.length > 3 ? toggleLabel : ''}</button>
          </div>
          \${body}
        \`;

        const toggleBtn = document.getElementById('toggleTasksBtn');
        if (toggleBtn && state.recentTasks.length > 3) {
          toggleBtn.onclick = function () {
            state.showAllTasks = !state.showAllTasks;
            renderRecentTasks();
            saveState();
          };
        }

        recentTasksSection.querySelectorAll('[data-task-id]').forEach(function (button) {
          button.addEventListener('click', function () {
            const task = state.recentTasks.find(function (entry) {
              return entry.id === button.getAttribute('data-task-id');
            });
            if (!task) return;

            inputEl.value = task.prompt;
            state.input = task.prompt;
            if (task.model && state.models.some(function (model) { return model.id === task.model; })) {
              state.selectedModel = task.model;
              modelSelectEl.value = task.model;
              vscode.postMessage({ type: 'select_model', model: task.model });
            }
            inputEl.focus();
            saveState();
          });
        });
      }

      function renderMessages() {
        if (!state.messages.length) {
          messagesEl.innerHTML = '';
          return;
        }

        messagesEl.innerHTML = state.messages.map(function (message) {
          const classes = ['message', message.role];
          if (message.error) classes.push('error');
          return \`
            <article class="\${classes.join(' ')}">
              <div class="message-header">
                <span>\${escapeHtml(message.role === 'user' ? 'You' : message.error ? 'Gateway' : 'Assistant')}</span>
                <span>\${escapeHtml(message.model || '')}</span>
              </div>
              <div class="message-body">\${escapeHtml(message.content)}</div>
            </article>
          \`;
        }).join('');

        requestAnimationFrame(function () {
          const contentEl = document.getElementById('content');
          if (contentEl) {
            contentEl.scrollTop = contentEl.scrollHeight;
          }
        });
      }

      function renderModels() {
        const options = [];
        if (!state.models.length) {
          options.push('<option value="">No models</option>');
        } else {
          state.models.forEach(function (model) {
            const badge = model.badge ? ' [' + model.badge + ']' : '';
            options.push('<option value="' + escapeAttribute(model.id) + '">' + escapeHtml(model.label + badge) + '</option>');
          });
        }

        modelSelectEl.innerHTML = options.join('');
        modelSelectEl.disabled = state.connectionStatus !== 'connected' || !state.models.length || state.loading;

        const existing = state.models.some(function (model) {
          return model.id === state.selectedModel;
        });

        if (existing) {
          modelSelectEl.value = state.selectedModel;
        } else if (state.models[0]) {
          state.selectedModel = state.models[0].id;
          modelSelectEl.value = state.selectedModel;
        }
      }

      function renderDrawer() {
        drawer.classList.toggle('open', state.accountOpen);
        drawerBackdrop.classList.toggle('open', state.accountOpen);
        serviceUrlInput.value = state.serviceUrl || '';
      }

      function render() {
        renderStatus();
        renderConnectionBanner();
        renderRecentTasks();
        renderMessages();
        renderModels();
        renderDrawer();
      }

      function openDrawer() {
        state.accountOpen = true;
        renderDrawer();
        saveState();
      }

      function closeDrawer() {
        state.accountOpen = false;
        renderDrawer();
        saveState();
      }

      function appendMessage(role, content, model, options) {
        state.messages.push({
          role: role,
          content: content,
          model: model || '',
          error: options && options.error ? true : false,
          requestId: options && options.requestId ? options.requestId : '',
        });
        renderMessages();
        saveState();
      }

      function replaceLoadingMessage(requestId, role, content, model, isError) {
        const index = state.messages.findIndex(function (message) {
          return message.requestId === requestId;
        });
        if (index === -1) {
          appendMessage(role, content, model, { error: isError, requestId: requestId });
          return;
        }

        state.messages[index] = {
          role: role,
          content: content,
          model: model || '',
          error: !!isError,
          requestId: requestId,
        };
        renderMessages();
        saveState();
      }

      function sendPrompt() {
        const prompt = inputEl.value.trim();
        if (!prompt) return;

        if (state.connectionStatus !== 'connected') {
          openDrawer();
          showToast('Connect your rw-proxy API key first.');
          return;
        }

        if (!state.selectedModel) {
          showToast('Pick a model before sending.');
          return;
        }

        const requestId = String(Date.now());
        const nextMessages = state.messages
          .filter(function (message) { return !message.error; })
          .map(function (message) {
            return {
              role: message.role === 'assistant' ? 'assistant' : 'user',
              content: message.content,
            };
          });

        appendMessage('user', prompt, state.selectedModel);
        appendMessage('assistant', 'Thinking', state.selectedModel, { requestId: requestId });
        inputEl.value = '';
        state.input = '';
        state.loading = true;
        renderStatus();
        saveState();

        nextMessages.push({ role: 'user', content: prompt });

        vscode.postMessage({
          type: 'chat_request',
          requestId: requestId,
          prompt: prompt,
          model: state.selectedModel,
          messages: nextMessages,
        });
      }

      function relativeTime(isoString) {
        const then = new Date(isoString).getTime();
        const diff = Date.now() - then;
        const minutes = Math.max(0, Math.floor(diff / 60000));
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return minutes + ' min ago';
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return hours + ' hour' + (hours === 1 ? '' : 's') + ' ago';
        const days = Math.floor(hours / 24);
        return days + ' day' + (days === 1 ? '' : 's') + ' ago';
      }

      function escapeHtml(value) {
        return String(value || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function escapeAttribute(value) {
        return escapeHtml(value);
      }

      inputEl.value = state.input;

      accountBtn.onclick = openDrawer;
      closeDrawerBtn.onclick = closeDrawer;
      drawerBackdrop.onclick = closeDrawer;
      drawerBackBtn.onclick = closeDrawer;

      connectBtn.onclick = function () {
        vscode.postMessage({
          type: 'save_connection',
          apiKey: apiKeyInput.value,
          serviceUrl: serviceUrlInput.value,
        });
      };

      disconnectBtn.onclick = function () {
        vscode.postMessage({ type: 'disconnect' });
      };

      openGatewayBtn.onclick = function () {
        vscode.postMessage({ type: 'visit_gateway' });
      };

      drawerVisitBtn.onclick = function () {
        vscode.postMessage({ type: 'visit_gateway' });
      };

      refreshBtn.onclick = function () {
        vscode.postMessage({ type: 'refresh_connection' });
      };

      newChatBtn.onclick = function () {
        state.messages = [];
        renderMessages();
        saveState();
      };

      sendBtn.onclick = sendPrompt;

      inputEl.addEventListener('input', function () {
        state.input = inputEl.value;
        saveState();
      });

      inputEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          sendPrompt();
        }
      });

      modelSelectEl.addEventListener('change', function () {
        state.selectedModel = modelSelectEl.value;
        vscode.postMessage({ type: 'select_model', model: state.selectedModel });
        saveState();
      });

      window.addEventListener('message', function (event) {
        const message = event.data;
        if (!message || typeof message !== 'object') return;

        if (message.type === 'bootstrap') {
          const payload = message.payload || {};
          state.role = payload.role || state.role;
          state.hasApiKey = !!payload.hasApiKey;
          state.serviceUrl = payload.serviceUrl || state.serviceUrl;
          state.recentTasks = Array.isArray(payload.recentTasks) ? payload.recentTasks : [];
          if (payload.selectedModel) {
            state.selectedModel = payload.selectedModel;
          }
          state.connectionStatus = payload.connectionStatus || state.connectionStatus;
          render();
          return;
        }

        if (message.type === 'connection_state') {
          const payload = message.payload || {};
          state.connectionStatus = payload.status || 'disconnected';
          state.connectionError = payload.error || '';
          state.models = Array.isArray(payload.models) ? payload.models : [];
          state.serviceUrl = payload.serviceUrl || state.serviceUrl;
          state.recentTasks = Array.isArray(payload.recentTasks) ? payload.recentTasks : state.recentTasks;
          if (payload.selectedModel) {
            state.selectedModel = payload.selectedModel;
          } else if (state.models.length && !state.models.some(function (model) { return model.id === state.selectedModel; })) {
            state.selectedModel = state.models[0].id;
          }
          render();
          saveState();
          return;
        }

        if (message.type === 'chat_response') {
          const payload = message.payload || {};
          state.loading = false;
          replaceLoadingMessage(payload.requestId, 'assistant', payload.content || '', state.selectedModel, false);
          if (payload.recentTask) {
            state.recentTasks = [payload.recentTask].concat(state.recentTasks.filter(function (task) {
              return task.id !== payload.recentTask.id && task.prompt !== payload.recentTask.prompt;
            })).slice(0, 8);
            renderRecentTasks();
          }
          renderStatus();
          saveState();
          return;
        }

        if (message.type === 'chat_error') {
          const payload = message.payload || {};
          state.loading = false;
          replaceLoadingMessage(payload.requestId, 'assistant', payload.error || 'Request failed.', state.selectedModel, true);
          renderStatus();
          saveState();
          return;
        }

        if (message.type === 'toast') {
          const payload = message.payload || {};
          if (payload.message) {
            showToast(payload.message);
          }
          return;
        }

        if (message.type === 'clear_chat') {
          state.messages = [];
          renderMessages();
          saveState();
        }
      });

      render();
      vscode.postMessage({ type: 'ready' });
    })();
  `;
}
