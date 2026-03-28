/* ════════════════════════════════════════════════
   GeningAI Chat — script.js
   ════════════════════════════════════════════════ */

const API_URL = window.location.origin + '/v1/chat/completions';

// ── State ──────────────────────────────────────
let messages       = [];
let systemPrompt   = '';
let currentModel   = 'geningai/gpt3';
let currentPersona = 'default';
let isStreaming    = false;
let attachedFile   = null; // { name, content }

// ── Personas ───────────────────────────────────
const PERSONAS = {
  default:      '',
  storyteller:  'You are an immersive storyteller. Weave vivid, engaging narratives with rich descriptions, compelling characters, and dramatic tension. Use literary devices, metaphors, and evocative language.',
  friend:       'You are the user\'s best friend — warm, funny, supportive and completely real. Use casual language, crack jokes, share opinions freely, and always have their back.',
  teacher:      'You are a patient, brilliant teacher. Break down complex topics into simple steps, use analogies and examples, check for understanding, and celebrate curiosity.',
  philosopher:  'You are a deep philosopher who explores ideas from multiple angles. Question assumptions, draw connections between concepts, and help the user think more profoundly.',
  comedian:     'You are a witty comedian. Keep responses light, funny and clever. Use wordplay, absurd observations, and comic timing — but still actually answer the question.',
  poet:         'You are a lyrical poet. Express ideas with beautiful, flowing language. Use imagery, rhythm and metaphor. Even technical explanations become poetic in your hands.',
  custom:       '' // will be set from textarea
};

// ── DOM refs ───────────────────────────────────
const $ = id => document.getElementById(id);
const messagesEl   = $('messages');
const msgInput     = $('msgInput');
const sendBtn      = $('sendBtn');
const fileInput    = $('fileInput');
const filePreview  = $('filePreview');
const fileNameEl   = $('fileName');
const systemPromptEl = $('systemPrompt');
const personaSection = $('personaSection');
const customPersonaInput = $('customPersonaInput');

// ── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupModelCards();
  setupPersonaButtons();
  setupInput();
  setupFileUpload();
  setupMobile();
  $('newChatBtn').addEventListener('click', newChat);
  $('mobileNewBtn').addEventListener('click', newChat);
  $('clearBtn').addEventListener('click', newChat);
  $('applyBtn').addEventListener('click', applySystemPrompt);
  sendBtn.addEventListener('click', sendMessage);
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      msgInput.value = btn.dataset.prompt;
      autoResize(msgInput);
      sendMessage();
    });
  });
});

// ── Model selection ────────────────────────────
function setupModelCards() {
  document.querySelectorAll('.model-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.model-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentModel = card.dataset.model;
      updateModelPill();
      // Show/hide persona section
      const isLlama = currentModel === 'geningai/llama-roleplay';
      personaSection.style.display = isLlama ? 'flex' : 'none';
    });
  });
}

function updateModelPill() {
  const pill = $('activeModelPill');
  if (currentModel === 'geningai/gpt3') {
    pill.innerHTML = '<span class="pill-icon">⚡</span><span class="pill-name">GPT-3</span>';
  } else {
    pill.innerHTML = '<span class="pill-icon">🦙</span><span class="pill-name">LLaMA Roleplay</span>';
  }
}

// ── Persona ────────────────────────────────────
function setupPersonaButtons() {
  document.querySelectorAll('.persona-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.persona-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPersona = btn.dataset.persona;
      customPersonaInput.style.display = currentPersona === 'custom' ? 'block' : 'none';
      applyPersona();
    });
  });
  customPersonaInput.addEventListener('input', () => {
    if (currentPersona === 'custom') applyPersona();
  });
}

function applyPersona() {
  if (currentPersona === 'custom') {
    systemPromptEl.value = customPersonaInput.value;
  } else {
    systemPromptEl.value = PERSONAS[currentPersona] || '';
  }
  systemPrompt = systemPromptEl.value;
}

function applySystemPrompt() {
  systemPrompt = systemPromptEl.value;
  showToast('System prompt applied ✓');
}

// ── Input setup ────────────────────────────────
function setupInput() {
  msgInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  msgInput.addEventListener('input', () => autoResize(msgInput));
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 200) + 'px';
}

// ── File upload ────────────────────────────────
function setupFileUpload() {
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      showToast('File too large! Max 200KB allowed.', 'error');
      fileInput.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      attachedFile = { name: file.name, content: e.target.result };
      fileNameEl.textContent = file.name;
      filePreview.style.display = 'block';
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  $('fileRemove').addEventListener('click', () => {
    attachedFile = null;
    filePreview.style.display = 'none';
  });
}

// ── Mobile sidebar ─────────────────────────────
function setupMobile() {
  const sidebar  = $('sidebar');
  const overlay  = $('sidebarOverlay');
  const menuBtn  = $('mobileMenuBtn');

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('show');
  });
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ── New chat ───────────────────────────────────
function newChat() {
  messages = [];
  messagesEl.innerHTML = `
    <div class="welcome" id="welcome">
      <div class="welcome-orb"></div>
      <h1 class="welcome-title">What can I help with?</h1>
      <p class="welcome-sub">Ask anything — code, ideas, stories, math</p>
      <div class="quick-chips">
        <button class="chip" data-prompt="Explain quantum entanglement simply">⚛️ Quantum physics</button>
        <button class="chip" data-prompt="Write a Python web scraper">🐍 Python script</button>
        <button class="chip" data-prompt="Tell me a short sci-fi story">🚀 Sci-fi story</button>
        <button class="chip" data-prompt="What is e^(i*pi) + 1 = 0 and why is it beautiful?">∑ Math magic</button>
      </div>
    </div>`;
  document.querySelectorAll('.chip').forEach(btn => {
    btn.addEventListener('click', () => {
      msgInput.value = btn.dataset.prompt;
      autoResize(msgInput);
      sendMessage();
    });
  });
  msgInput.value = '';
  autoResize(msgInput);
}

// ── Build message list ──────────────────────────
function buildMessages(userContent) {
  const msgs = [];
  if (systemPrompt) msgs.push({ role: 'system', content: systemPrompt });
  // Keep last 20 turns
  const history = messages.slice(-20);
  msgs.push(...history);
  msgs.push({ role: 'user', content: userContent });
  return msgs;
}

// ── Send ───────────────────────────────────────
async function sendMessage() {
  const text = msgInput.value.trim();
  if ((!text && !attachedFile) || isStreaming) return;

  // Remove welcome screen
  const welcome = $('welcome');
  if (welcome) welcome.remove();

  // Build user content
  let userContent = text;
  let fileBadgeHtml = '';
  if (attachedFile) {
    const ext = attachedFile.name.split('.').pop().toUpperCase();
    userContent = `[File: ${attachedFile.name}]\n\`\`\`${ext.toLowerCase()}\n${attachedFile.content}\n\`\`\`` + (text ? `\n\n${text}` : '');
    fileBadgeHtml = `<div class="file-badge">📄 ${escHtml(attachedFile.name)}</div>`;
    attachedFile = null;
    filePreview.style.display = 'none';
  }

  // Show user bubble
  appendUserMessage(fileBadgeHtml + escHtml(text || '(file attached)'));
  messages.push({ role: 'user', content: userContent });

  msgInput.value = '';
  autoResize(msgInput);

  // Thinking indicator
  const thinkingRow = appendThinking();

  isStreaming = true;
  setSendLoading(true);

  try {
    const payload = {
      model: currentModel,
      messages: buildMessages(userContent),
      stream: true
    };

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    thinkingRow.remove();

    const contentType = response.headers.get('content-type') || '';
    let fullText = '';

    // Create AI message bubble
    const { row, contentEl, cursor } = createAssistantBubble();

    if (contentType.includes('text/event-stream')) {
      // ── STREAMING with Capacitor Buffer ────────
      fullText = await streamWithCapacitor(response, contentEl, cursor);
    } else {
      // ── NON-STREAM: simulate typing ────────────
      const json = await response.json();
      fullText = json.choices?.[0]?.message?.content || '';
      await typewriterEffect(fullText, contentEl, cursor);
    }

    // Remove cursor, render final markdown
    cursor.remove();
    renderMarkdown(contentEl, fullText);
    scrollToBottom();

    messages.push({ role: 'assistant', content: fullText });

  } catch (err) {
    thinkingRow?.remove();
    appendErrorMessage(err.message);
    console.error(err);
  } finally {
    isStreaming = false;
    setSendLoading(false);
  }
}

// ══════════════════════════════════════════════
//  CAPACITOR BUFFER — smooth streaming
//  Like a capacitor: absorbs big chunks,
//  releases at steady character-by-character rate
// ══════════════════════════════════════════════
async function streamWithCapacitor(response, contentEl, cursor) {
  const reader    = response.body.getReader();
  const decoder   = new TextDecoder();
  let lineBuffer  = '';   // partial SSE line buffer
  let charBuffer  = '';   // capacitor: pending chars to type
  let displayed   = '';   // what's visible so far
  let done        = false;

  // Drain rate: chars per frame. Adapts to buffer size.
  const BASE_RATE = 3;  // chars per rAF when buffer small
  const FAST_RATE = 12; // chars per rAF when buffer large

  // Reader loop — fills charBuffer
  async function readLoop() {
    while (true) {
      const { done: d, value } = await reader.read();
      if (d) { done = true; break; }

      const incoming = lineBuffer + decoder.decode(value);
      lineBuffer = '';
      const lines = incoming.split('\n');
      lineBuffer = lines.pop(); // save incomplete line

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') { done = true; break; }
        try {
          const json = JSON.parse(data);
          const chunk = json.choices?.[0]?.delta?.content;
          if (chunk) charBuffer += chunk;
        } catch (_) {}
      }
    }
  }

  // Render loop — drains charBuffer character by character via rAF
  function renderLoop(resolve) {
    if (charBuffer.length === 0 && done) {
      // Final render
      renderMarkdown(contentEl, displayed);
      resolve(displayed);
      return;
    }

    if (charBuffer.length > 0) {
      // Adaptive rate: more chars in buffer → drain faster
      const rate = charBuffer.length > 60 ? FAST_RATE : BASE_RATE;
      const take = Math.min(rate, charBuffer.length);
      displayed  += charBuffer.slice(0, take);
      charBuffer  = charBuffer.slice(take);

      // Live render partial markdown
      renderMarkdown(contentEl, displayed, true);
      contentEl.appendChild(cursor); // keep cursor at end
      scrollToBottom();
    }

    requestAnimationFrame(() => renderLoop(resolve));
  }

  // Run both loops concurrently
  return new Promise(resolve => {
    readLoop();
    requestAnimationFrame(() => renderLoop(resolve));
  });
}

// ── Typewriter for non-stream (GPT-3) ──────────
function typewriterEffect(text, contentEl, cursor) {
  return new Promise(resolve => {
    let i = 0;
    const CHUNK = 4; // chars per frame
    function frame() {
      if (i >= text.length) {
        resolve();
        return;
      }
      i = Math.min(i + CHUNK, text.length);
      renderMarkdown(contentEl, text.slice(0, i), true);
      contentEl.appendChild(cursor);
      scrollToBottom();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });
}

// ── Markdown + KaTeX renderer ───────────────────
function renderMarkdown(el, text, partial = false) {
  if (!text) { el.innerHTML = ''; return; }

  // Configure marked
  marked.setOptions({
    breaks: true,
    gfm: true,
    highlight: (code, lang) => {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });

  // Custom renderer for code blocks (add copy button header)
  const renderer = new marked.Renderer();
  renderer.code = (code, lang) => {
    const highlighted = lang && hljs.getLanguage(lang)
      ? hljs.highlight(code, { language: lang }).value
      : hljs.highlightAuto(code).value;
    return `<pre><div class="code-header"><span class="code-lang">${lang || 'code'}</span><button class="copy-btn" onclick="copyCode(this)">Copy</button></div><code class="hljs">${highlighted}</code></pre>`;
  };

  let html = marked.parse(text, { renderer });
  el.innerHTML = html;

  // KaTeX: render math
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$',  right: '$',  display: false },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false,
      errorColor: '#f06060'
    });
  } catch (_) {}
}

// ── Copy code ──────────────────────────────────
function copyCode(btn) {
  const code = btn.closest('pre').querySelector('code').innerText;
  navigator.clipboard.writeText(code).then(() => {
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
  });
}
window.copyCode = copyCode;

// ── DOM helpers ────────────────────────────────
function appendUserMessage(htmlContent) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="msg-avatar">👤</div>
    <div class="msg-bubble">
      <div class="msg-content" style="white-space:pre-wrap">${htmlContent}</div>
    </div>`;
  messagesEl.appendChild(row);
  scrollToBottom();
}

function createAssistantBubble() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant';

  const avatarEl = document.createElement('div');
  avatarEl.className = 'msg-avatar';
  avatarEl.textContent = '✨';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble';

  const contentEl = document.createElement('div');
  contentEl.className = 'msg-content';

  const cursor = document.createElement('span');
  cursor.className = 'typing-cursor';

  contentEl.appendChild(cursor);
  bubble.appendChild(contentEl);
  row.appendChild(avatarEl);
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  scrollToBottom();
  return { row, contentEl, cursor };
}

function appendThinking() {
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-avatar">✨</div>
    <div class="msg-bubble">
      <div class="thinking-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  messagesEl.appendChild(row);
  scrollToBottom();
  return row;
}

function appendErrorMessage(msg) {
  const row = document.createElement('div');
  row.className = 'msg-row assistant';
  row.innerHTML = `
    <div class="msg-avatar">⚠️</div>
    <div class="msg-bubble" style="border-color:rgba(240,96,96,0.3)">
      <div class="msg-content" style="color:#f06060">
        Error: ${escHtml(msg)}<br>Please try again.
      </div>
    </div>`;
  messagesEl.appendChild(row);
  scrollToBottom();
}

function setSendLoading(loading) {
  sendBtn.disabled = loading;
  sendBtn.classList.toggle('loading', loading);
  if (loading) {
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
  } else {
    sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>`;
  }
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, type = 'success') {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed;bottom:90px;left:50%;transform:translateX(-50%);
    background:${type==='error'?'#f06060':'#34c78a'};
    color:#fff;padding:8px 18px;border-radius:99px;
    font-size:13px;font-weight:600;z-index:999;
    animation:fadeUp 0.2s ease both;
    font-family:'Sora',sans-serif;
    box-shadow:0 4px 20px rgba(0,0,0,0.3);
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
