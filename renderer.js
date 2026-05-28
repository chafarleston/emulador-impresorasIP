const paper = document.getElementById('paper');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const paperContainer = document.getElementById('paper-container');
const placeholderMsg = document.getElementById('placeholder-msg');

const cutLineStyle = document.createElement('style');
cutLineStyle.id = 'cut-line-style';
document.head.appendChild(cutLineStyle);

function updateCutLabel(label) {
  cutLineStyle.textContent = `#paper .cut-line::after { content: '${label}'; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); background: #faf8f5; padding: 0 8px; font-size: 9px; }`;
}

function applyLang(skipIPC) {
  document.title = t('appTitle');
  document.getElementById('btn-clear').textContent = t('btnClear');
  document.getElementById('btn-test').textContent = t('btnTest');
  document.getElementById('btn-scroll-down').textContent = t('btnScroll');
  document.getElementById('btn-settings').title = t('settings');
  document.getElementById('settings-title').textContent = t('settingsTitle');
  document.getElementById('label-ip').textContent = t('labelIp');
  document.getElementById('label-port').textContent = t('labelPort');
  document.getElementById('label-lang').textContent = t('labelLanguage');
  document.getElementById('btn-settings-cancel').textContent = t('btnCancel');
  document.getElementById('btn-settings-apply').textContent = t('btnApply');
  document.getElementById('settings-lang').value = window.__lang;
  updateCutLabel(t('cutLabel'));

  const portInfo = document.getElementById('port-info');
  const currentPort = portInfo.textContent.split(':').pop();
  placeholderMsg.innerHTML = `&thinsp;&mdash;&mdash;&mdash;&mdash;&mdash; ${t('appTitle')} &mdash;&mdash;&mdash;&mdash;&mdash;<br>${t('placeholder')} ${currentPort}...`;

  if (!skipIPC) window.printerAPI.setLanguage(window.__lang);
}

applyLang(true);

function drawBarcodeSvg(code, format, height) {
  const chars = code.split('');
  const code39Map = {
    '0':'101000111011101','1':'111010001010111','2':'101110001010111',
    '3':'111011100010101','4':'101000111010111','5':'111010001110101',
    '6':'101110001110101','7':'101000101110111','8':'111010001011101',
    '9':'101110001011101','A':'111010100010111','B':'101110100010111',
    'C':'111011101000101','D':'101011100010111','E':'111010111000101',
    'F':'101110111000101','G':'101010001110111','H':'111010100011101',
    'I':'101110100011101','J':'101011100011101','K':'111010101000111',
    'L':'101110101000111','M':'111011101010001','N':'101011101000111',
    'O':'111010111010001','P':'101110111010001','Q':'101010111000111',
    'R':'111010101110001','S':'101110101110001','T':'101011101110001',
    'U':'111000101010111','V':'101110001010111','W':'111011100010101',
    'X':'101000111010111','Y':'111010001110101','Z':'101110001110101',
    '-':'101000101110111','.':'111010001011101',' ':'101110001011101',
    '$':'101000100010001','/':'101000100010001','+':'101000100010001',
    '%':'101000100010001','*':'101000100010001',
  };

  if (format === 0 || format === 69) {
    let bars = '';
    for (const ch of chars) {
      const pattern = code39Map[ch.toUpperCase()];
      if (pattern) bars += pattern + '0';
    }
    const svgWidth = Math.max(bars.length * 2, 1);
    return `<svg width="${svgWidth}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      ${bars.split('').map((b, i) => b === '1'
        ? `<rect x="${i * 2}" y="0" width="2" height="${height}" fill="#000"/>`
        : '').join('')}
    </svg>`;
  }
  return `<div style="padding:4px;border:1px solid #999;display:inline-block;">[Code ${format}: ${code}]</div>`;
}

function drawQrSvg(text) {
  const size = 160;
  if (!text) return `<div style="padding:8px;">[QR empty]</div>`;
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="white"/>
    <text x="${size / 2}" y="${size / 2 - 10}" text-anchor="middle" font-family="Courier New" font-size="11" fill="#333">QR Code</text>
    <text x="${size / 2}" y="${size / 2 + 10}" text-anchor="middle" font-family="Courier New" font-size="10" fill="#666">${text.length > 20 ? text.substring(0, 20) + '...' : text}</text>
  </svg>`;
}

function addLine(item) {
  if (item.type === 'text') {
    const div = document.createElement('div');
    div.className = 'line-text';
    let classes = [];
    if (item.styles.bold) classes.push('bold');
    if (item.styles.doubleH) classes.push('double-h');
    if (item.styles.doubleW) classes.push('double-w');
    if (item.styles.underline) classes.push('underline');
    switch (item.styles.align) {
      case 0: classes.push('align-left'); break;
      case 1: classes.push('align-center'); break;
      case 2: classes.push('align-right'); break;
    }
    if (classes.length > 0) div.className += ' ' + classes.join(' ');
    div.textContent = item.content || ' ';
    paper.appendChild(div);
  } else if (item.type === 'cut') {
    const div = document.createElement('div');
    div.className = 'cut-line';
    paper.appendChild(div);
  } else if (item.type === 'barcode') {
    const container = document.createElement('div');
    container.className = 'barcode';
    container.innerHTML = drawBarcodeSvg(item.content, item.format, item.height || 50);
    const label = document.createElement('div');
    label.className = 'barcode-label';
    label.textContent = item.content;
    container.appendChild(label);
    paper.appendChild(container);
  } else if (item.type === 'qrcode') {
    const container = document.createElement('div');
    container.className = 'qrcode';
    container.innerHTML = drawQrSvg(item.content);
    paper.appendChild(container);
  }
}

function scrollToBottom() {
  paperContainer.scrollTop = paperContainer.scrollHeight;
}

function setStatus(status, address) {
  if (status === 'connected') {
    statusDot.className = 'status-dot dot-green';
    statusText.textContent = `${t('statusConnected')} ${address}`;
  } else if (status === 'disconnected') {
    statusDot.className = 'status-dot dot-green';
    statusText.textContent = t('statusReady');
  }
}

function setServerStatus(running, port, error, bindIp, language, configPath) {
  const portInfo = document.getElementById('port-info');
  if (running) {
    if (language && language !== window.__lang) {
      window.__lang = language;
      applyLang(false);
    }
    if (configPath) {
      const el = document.getElementById('config-path');
      if (el) el.textContent = configPath;
    }
    statusDot.className = 'status-dot dot-green';
    statusText.textContent = t('statusReady');
    const displayIp = bindIp || '0.0.0.0';
    portInfo.textContent = `${displayIp}:${port}`;
    placeholderMsg.innerHTML = `&thinsp;&mdash;&mdash;&mdash;&mdash;&mdash; ${t('appTitle')} &mdash;&mdash;&mdash;&mdash;&mdash;<br>${t('placeholder')} ${port}...`;
    document.getElementById('settings-ip').value = bindIp || '0.0.0.0';
    document.getElementById('settings-port').value = port;
  } else {
    statusDot.className = 'status-dot dot-red';
    statusText.textContent = `${t('statusError')}: ${error || t('statusDisconnected')}`;
  }
}

window.printerAPI.onPrintData((data) => {
  for (const item of data) addLine(item);
  scrollToBottom();
});

window.printerAPI.onConnection((data) => {
  setStatus(data.status, data.address);
});

window.printerAPI.onServerStatus((data) => {
  setServerStatus(data.running, data.port, data.error, data.bindIp, data.language, data.configPath);
  if (settingsStatusEl) {
    if (data.running) {
      settingsStatusEl.textContent = `${t('applySuccess')} ${data.bindIp || '0.0.0.0'}:${data.port}`;
      settingsStatusEl.className = 'settings-msg-ok';
    } else if (data.error) {
      const reason = data.errorCode === 'EADDRNOTAVAIL'
        ? (window.__lang === 'es' ? 'IP no disponible en este equipo' : 'IP not available on this machine')
        : data.errorCode === 'EACCES'
        ? (window.__lang === 'es' ? 'Permiso denegado (puerto < 1024)' : 'Permission denied (port < 1024)')
        : data.error;
      settingsStatusEl.innerHTML = `${t('applyError')} ${document.getElementById('settings-ip').value}:${document.getElementById('settings-port').value}<br><span style="font-size:10px;opacity:0.7">${reason}</span>`;
      settingsStatusEl.className = 'settings-msg-err';
    }
  }
});

// --- Clear ---
document.getElementById('btn-clear').addEventListener('click', () => {
  paper.innerHTML = '';
  const msg = document.createElement('div');
  msg.style.cssText = 'text-align:center;color:#888;margin-top:40px;font-size:11px;';
  msg.innerHTML = `&thinsp;&mdash;&mdash;&mdash;&mdash;&mdash; ${t('appTitle')} &mdash;&mdash;&mdash;&mdash;&mdash;<br>${t('placeholder')}...`;
  paper.appendChild(msg);
});

// --- Test ---
document.getElementById('btn-test').addEventListener('click', () => {
  const lines = [
    { type: 'text', content: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550', styles: { bold: true, doubleH: false, doubleW: false, underline: false, align: 1 } },
    { type: 'text', content: `   ${t('testTitle')}`, styles: { bold: true, doubleH: true, doubleW: false, underline: false, align: 1 } },
    { type: 'text', content: `   ${t('testSubtitle')}`, styles: { bold: true, doubleH: false, doubleW: true, underline: false, align: 1 } },
    { type: 'text', content: '\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550', styles: { bold: true, doubleH: false, doubleW: false, underline: false, align: 1 } },
    { type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: t('featNormal'), styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: t('featBold'), styles: { bold: true, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: t('featUnderline'), styles: { bold: false, doubleH: false, doubleW: false, underline: true, align: 0 } },
    { type: 'text', content: t('featDoubleW'), styles: { bold: false, doubleH: false, doubleW: true, underline: false, align: 0 } },
    { type: 'text', content: t('featDoubleH'), styles: { bold: false, doubleH: true, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: t('featCenter'), styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 1 } },
    { type: 'text', content: t('featRight'), styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 2 } },
    { type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'barcode', content: 'TEST123', format: 0, height: 40, width: 2 },
    { type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'qrcode', content: 'Thermal Printer Emulator v1.0' },
    { type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: `${t('featDate')}: ${new Date().toLocaleString()}`, styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'cut', content: 'cut-full' },
  ];
  for (const item of lines) addLine(item);
  scrollToBottom();
});

document.getElementById('btn-scroll-down').addEventListener('click', scrollToBottom);

// --- Settings ---
const overlay = document.getElementById('settings-overlay');
const settingsStatusEl = document.getElementById('settings-status');
let settingsPending = false;

window.printerAPI.onShowAbout(() => {
  const lines = [
    { type: 'text', content: '', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 0 } },
    { type: 'text', content: `${t('appTitle')} v1.0`, styles: { bold: true, doubleH: false, doubleW: false, underline: false, align: 1 } },
    { type: 'text', content: 'ESC/POS over TCP :9100', styles: { bold: false, doubleH: false, doubleW: false, underline: false, align: 1 } },
  ];
  for (const item of lines) addLine(item);
  scrollToBottom();
});

document.getElementById('btn-settings').addEventListener('click', async () => {
  const [cfg, ips] = await Promise.all([
    window.printerAPI.getServerConfig(),
    window.printerAPI.getAvailableIPs(),
  ]);
  document.getElementById('settings-ip').value = cfg.ip || '0.0.0.0';
  document.getElementById('settings-port').value = cfg.port || 9100;
  document.getElementById('settings-lang').value = window.__lang;

  const datalist = document.getElementById('ip-suggestions') || (() => {
    const dl = document.createElement('datalist');
    dl.id = 'ip-suggestions';
    document.getElementById('settings-ip').parentNode.appendChild(dl);
    return dl;
  })();
  datalist.innerHTML = ips.map(ip => `<option value="${ip}">`).join('');

  settingsStatusEl.textContent = '';
  settingsStatusEl.className = '';
  overlay.classList.add('open');
});

document.getElementById('btn-settings-cancel').addEventListener('click', () => {
  overlay.classList.remove('open');
});

document.getElementById('settings-overlay').addEventListener('click', (e) => {
  if (e.target === overlay) overlay.classList.remove('open');
});

document.getElementById('btn-settings-apply').addEventListener('click', async () => {
  const newIp = document.getElementById('settings-ip').value.trim();
  const newPort = parseInt(document.getElementById('settings-port').value, 10);
  const newLang = document.getElementById('settings-lang').value;

  if (!newIp) {
    settingsStatusEl.textContent = window.__lang === 'es' ? 'IP no v\u00E1lida' : 'Invalid IP';
    settingsStatusEl.className = 'settings-msg-err';
    return;
  }
  if (isNaN(newPort) || newPort < 1 || newPort > 65535) {
    settingsStatusEl.textContent = window.__lang === 'es' ? 'Puerto inv\u00E1lido (1-65535)' : 'Invalid port (1-65535)';
    settingsStatusEl.className = 'settings-msg-err';
    return;
  }

  if (newLang !== window.__lang) {
    window.__lang = newLang;
    applyLang();
  }

  overlay.classList.remove('open');
  await window.printerAPI.restartServer({ ip: newIp, port: newPort });
});
