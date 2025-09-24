const $ = s => document.querySelector(s);
const longUrl = $('#longUrl');
const alias = $('#alias');
const aliasSuggest = $('#aliasSuggest');
const service = $('#service');
const logstats = $('#logstats');
const shortenBtn = $('#shortenBtn');
const resultBox = $('#result');
const historyBox = $('#history');
const clearHistory = $('#clearHistory');
const themeToggle = $('#themeToggle');
const aboutBtn = $('#aboutBtn');

// ---- Theme
const applyTheme = (t) => (document.body.className = t === 'light' ? 'light' : '');
const savedTheme =
  localStorage.getItem('ls_theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
applyTheme(savedTheme);
const setToggleVisual = () => {
  themeToggle.setAttribute('aria-pressed', document.body.classList.contains('light') ? 'true' : 'false');
};
setToggleVisual();
themeToggle.onclick = () => {
  const t = document.body.classList.contains('light') ? 'dark' : 'light';
  localStorage.setItem('ls_theme', t);
  applyTheme(t);
  setToggleVisual();
};

// ---- Helpers
function normalizeUrl(u) {
  try {
    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
    const url = new URL(u);
    return url.href;
  } catch {
    return null;
  }
}
function randomAlias() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789_';
  let out = '';
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
aliasSuggest.onclick = () => {
  alias.value = randomAlias();
  alias.focus();
};

// ---- JSONP call to is.gd / v.gd
function shortenWithIsGd(domain, longUrl, alias, logstats) {
  return new Promise((resolve, reject) => {
    const cb = 'isgd_cb_' + Math.random().toString(36).slice(2);
    window[cb] = (data) => {
      try {
        if (data && data.shorturl) {
          resolve(data.shorturl);
        } else if (data && data.errormessage) {
          reject(new Error(data.errormessage));
        } else {
          reject(new Error('Unknown error'));
        }
      } finally {
        delete window[cb];
        script.remove();
      }
    };
    const params = new URLSearchParams({ format: 'json', callback: cb, url: longUrl });
    if (alias) params.set('shorturl', alias);
    if (logstats) params.set('logstats', '1');
    const script = document.createElement('script');
    script.src = `https://${domain}/create.php?` + params.toString();
    script.onerror = () => {
      delete window[cb];
      reject(new Error('Network error'));
    };
    document.body.appendChild(script);
  });
}

// ---- UI result render
function renderResult(shortUrl, original) {
  resultBox.innerHTML = '';
  const urlPill = document.createElement('div');
  urlPill.className = 'pill';
  urlPill.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#ic-link"/></svg> <a href="${shortUrl}" target="_blank" rel="noopener">${shortUrl}</a>`;
  resultBox.appendChild(urlPill);

  const actions = document.createElement('div');
  actions.className = 'actions';
  const copyBtn = btnIcon('Copy (คัดลอก)', '#ic-copy', () => copyText(shortUrl));
  const shareBtn = btnIcon('Share (แชร์)', '#ic-share', async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Short link', url: shortUrl });
      } catch {}
    } else {
      copyText(shortUrl);
    }
  });
  const previewBtn = btnIcon('Stats (สถิติ)', '#ic-stats', () => window.open(shortUrl + '-', '_blank'));
  actions.append(copyBtn, shareBtn, previewBtn);
  resultBox.appendChild(actions);

  // QR
  const qrWrap = document.createElement('div');
  qrWrap.style.border = '1px solid var(--card-border)';
  qrWrap.style.borderRadius = '12px';
  qrWrap.style.padding = '12px';
  qrWrap.style.background = 'rgba(255,255,255,.04)';
  const qrDiv = document.createElement('div');
  qrDiv.id = 'qrcode';
  qrWrap.appendChild(qrDiv);
  resultBox.appendChild(qrWrap);
  if (window.QRCode) {
    new QRCode(qrDiv, { text: shortUrl, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.M });
  }

  // Save to history
  saveHistory({ longUrl: original, shortUrl, ts: Date.now() });
  renderHistory();
}
function btnIcon(text, symbol, onClick) {
  const b = document.createElement('button');
  b.className = 'btn';
  b.onclick = onClick;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttributeNS('http://www.w3.org/1999/xlink', 'href', symbol);
  svg.appendChild(use);
  b.append(svg, document.createTextNode(text));
  return b;
}
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
    toast('Copied (คัดลอกแล้ว)');
  } catch {
    const ta = document.createElement('textarea');
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    toast('Copied (คัดลอกแล้ว)');
  }
}
function toast(msg) {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.bottom = 'calc(var(--bottom-nav-h) + var(--safe-bottom) + 16px)';
  t.style.left = '50%';
  t.style.transform = 'translateX(-50%)';
  t.style.background = 'rgba(0,0,0,.7)';
  t.style.color = '#fff';
  t.style.padding = '10px 14px';
  t.style.borderRadius = '10px';
  t.style.zIndex = '1000';
  t.style.boxShadow = 'var(--shadow)';
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1600);
}

// ---- History (LocalStorage)
function getHistory() {
  try {
    return JSON.parse(localStorage.getItem('ls_history') || '[]');
  } catch {
    return [];
  }
}
function saveHistory(item) {
  const hist = getHistory();
  hist.unshift(item);
  localStorage.setItem('ls_history', JSON.stringify(hist.slice(0, 50)));
}
function renderHistory() {
  const hist = getHistory();
  historyBox.innerHTML = '';
  if (!hist.length) {
    historyBox.innerHTML = '<div class="muted">No items (ยังไม่มีรายการ)</div>';
    return;
  }
  for (const h of hist) {
    const row = document.createElement('div');
    row.className = 'history-item';
    const left = document.createElement('div');
    left.innerHTML = `<div><a href="${h.shortUrl}" target="_blank" rel="noopener">${h.shortUrl}</a></div>
                      <div class="muted" style="font-size:.9rem; max-width:60ch; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${h.longUrl}</div>`;
    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    const copyB = btnIcon('Copy (คัดลอก)', '#ic-copy', () => copyText(h.shortUrl));
    const prevB = btnIcon('Stats (สถิติ)', '#ic-stats', () => window.open(h.shortUrl + '-', '_blank'));
    right.append(copyB, prevB);
    row.append(left, right);
    historyBox.appendChild(row);
  }
}
clearHistory.onclick = () => {
  if (confirm('Clear all history? (ลบประวัติทั้งหมด?)')) {
    localStorage.removeItem('ls_history');
    renderHistory();
  }
};
renderHistory();

// ---- About modal
const aboutModal = $('#aboutModal');
const aboutClose = $('#aboutClose');

function aboutFallbackText(){
  return [
    'LinkShort uses is.gd / v.gd to shorten URLs (ใช้ is.gd / v.gd ในการย่อลิงก์)',
    'Supports custom alias (ตั้ง alias ได้)',
    'Enable stats; view by appending "-" to the short link (เปิดสถิติได้ — เติม "-" ต่อท้ายลิงก์สั้นเพื่อดู)',
    '',
    'Tip: Paste a URL and press Enter to shorten (เคล็ดลับ: วางลิงก์แล้วกด Enter เพื่อย่อทันที)'
  ].join('\n');
}

function openAbout(){
  if(aboutModal){
    aboutModal.classList.add('open');
    aboutModal.setAttribute('aria-hidden','false');
  }else{
    alert(aboutFallbackText());
  }
}
function closeAbout(){
  if(aboutModal){
    aboutModal.classList.remove('open');
    aboutModal.setAttribute('aria-hidden','true');
  }
}

if(aboutBtn) aboutBtn.onclick = openAbout;
if(aboutClose) aboutClose.onclick = closeAbout;
if(aboutModal) aboutModal.addEventListener('click', (e)=>{ if(e.target === aboutModal) closeAbout(); });
document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape') closeAbout(); });

// ---- Shorten action
async function handleShorten() {
  const raw = longUrl.value.trim();
  const norm = normalizeUrl(raw);
  if (!norm) {
    toast('Invalid URL (ลิงก์ไม่ถูกต้อง)');
    longUrl.focus();
    return;
  }
  const al = alias.value.trim();
  if (al && !/^[A-Za-z0-9_]{5,30}$/.test(al)) {
    toast('Invalid alias format (รูปแบบ alias ไม่ถูกต้อง)');
    alias.focus();
    return;
  }

  shortenBtn.disabled = true;
  shortenBtn.textContent = 'Shortening... (กำลังย่อ...)';
  try {
    const dom = service.value; // is.gd | v.gd
    const shortUrl = await shortenWithIsGd(dom, norm, al || '', logstats.checked);
    renderResult(shortUrl, norm);
  } catch (err) {
    resultBox.innerHTML = `<div class="pill danger">❌ ${err.message || 'An error occurred (เกิดข้อผิดพลาด)'}</div>`;
  } finally {
    shortenBtn.disabled = false;
    shortenBtn.textContent = 'Shorten (ย่อลิงก์)';
  }
}
shortenBtn.onclick = handleShorten;
longUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleShorten();
});
