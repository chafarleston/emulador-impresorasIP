const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const net = require('net');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { ESCPOSParser } = require('./escpos-parser');

let mainWindow;
let server;
const parser = new ESCPOSParser();
let activePort = null;
let bindIp = '0.0.0.0';
let lastGoodIp = '0.0.0.0';
let lastGoodPort = 9100;
let currentLang = 'es';
let configPath = null;
let shouldSaveOnListen = false;

function getAvailableIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  ips.sort();
  ips.unshift('0.0.0.0');
  ips.push('127.0.0.1');
  return [...new Set(ips)];
}

function loadConfig() {
  try {
    if (configPath && fs.existsSync(configPath)) {
      const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (data.ip) bindIp = data.ip;
      if (data.port) lastGoodPort = data.port;
      if (data.language) currentLang = data.language;
      console.log(`Config loaded: ${bindIp}:${lastGoodPort} (${currentLang})`);
    }
  } catch (err) {
    console.error('Error loading config:', err.message);
  }
}

function saveConfig(ip, port, lang) {
  try {
    if (!configPath) return;
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const cfg = { ip: ip || bindIp, port: port || lastGoodPort, language: lang || currentLang };
    fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8');
    console.log(`Config saved: ${cfg.ip}:${cfg.port} (${cfg.language})`);
  } catch (err) {
    console.error('Error saving config:', err.message);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ip' && args[i + 1]) {
      bindIp = args[i + 1];
      i++;
    } else if (args[i].startsWith('--ip=')) {
      bindIp = args[i].split('=')[1];
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log('Thermal Printer Emulator');
      console.log('  --ip <address>    Bind address (default: 0.0.0.0)');
      console.log('  --help            Show this help');
      app.quit();
      process.exit(0);
    }
  }
}

const menuLabels = {
  es: {
    file: 'Archivo', exit: 'Salir',
    view: 'Ver', reload: 'Recargar', devtools: 'Herramientas de desarrollo',
    help: 'Ayuda', about: 'Acerca de',
  },
  en: {
    file: 'File', exit: 'Exit',
    view: 'View', reload: 'Reload', devtools: 'Developer Tools',
    help: 'Help', about: 'About',
  },
};

function buildMenu(lang) {
  const l = menuLabels[lang] || menuLabels.es;
  return Menu.buildFromTemplate([
    {
      label: l.file,
      submenu: [
        { role: 'quit', label: l.exit },
      ],
    },
    {
      label: l.view,
      submenu: [
        { role: 'reload', label: l.reload },
        { role: 'toggleDevTools', label: l.devtools },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
      ],
    },
    {
      label: l.help,
      submenu: [
        {
          label: l.about,
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          },
        },
      ],
    },
  ]);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 800,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile('index.html');
  mainWindow.setTitle('Thermal Printer Emulator');
  mainWindow.webContents.on('did-finish-load', () => {
    if (!server && activePort === null) {
      startTCPServer(lastGoodPort);
    }
  });
}

function sendServerStatus(running, port, error, bindIp, errorCode) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('server-status', {
      running, port, bindIp, error, errorCode,
      language: currentLang,
      configPath,
      configLoaded: true,
    });
  }
}

function startTCPServer(port) {
  if (port > 9200) {
    const msg = 'No free port found (9100-9200)';
    console.error(msg);
    sendServerStatus(false, port, msg, bindIp, 'NO_PORT');
    return;
  }

  const svr = net.createServer((socket) => {
    const clientAddr = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`Cliente conectado: ${clientAddr}`);
    if (mainWindow) mainWindow.webContents.send('connection', { status: 'connected', address: clientAddr });

    socket.on('data', (data) => {
      parser.feed(data);
      const output = parser.getOutput();
      if (output.length > 0 && mainWindow) {
        mainWindow.webContents.send('print-data', output);
      }
    });

    socket.on('close', () => {
      console.log(`Cliente desconectado: ${clientAddr}`);
      if (mainWindow) mainWindow.webContents.send('connection', { status: 'disconnected', address: clientAddr });
    });

    socket.on('error', (err) => {
      console.error(`Socket error: ${err.message}`);
    });
  });

  svr.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying ${port + 1}...`);
      startTCPServer(port + 1);
    } else {
      const errMsg = err.code ? `${err.code}: ${err.message}` : err.message;
      console.error(`Server error: ${errMsg}`);
      sendServerStatus(false, port, errMsg, bindIp, err.code);
      if (bindIp !== lastGoodIp || port !== lastGoodPort) {
        console.log(`Restoring previous working config: ${lastGoodIp}:${lastGoodPort}`);
        bindIp = lastGoodIp;
        startTCPServer(lastGoodPort);
      }
    }
  });

  svr.once('listening', () => {
    server = svr;
    activePort = port;
    lastGoodIp = bindIp;
    lastGoodPort = port;
    console.log(`TCP server listening on ${bindIp}:${port}`);
    sendServerStatus(true, port, null, bindIp);
  });

  svr.listen(port, bindIp);
}

ipcMain.handle('get-server-config', () => {
  return { ip: bindIp, port: activePort || lastGoodPort, language: currentLang, configPath };
});

ipcMain.handle('get-available-ips', () => {
  return getAvailableIPs();
});

ipcMain.handle('restart-server', (_event, { ip, port }) => {
  const newIp = ip || '0.0.0.0';
  const newPort = port || 9100;
  saveConfig(newIp, newPort, currentLang);
  if (server) {
    server.close();
    parser.reset();
  }
  bindIp = newIp;
  startTCPServer(newPort);
});

ipcMain.handle('set-language', (_event, lang) => {
  currentLang = lang === 'es' ? 'es' : 'en';
  const menu = buildMenu(currentLang);
  Menu.setApplicationMenu(menu);
  saveConfig(bindIp, activePort || lastGoodPort, currentLang);
});

app.whenReady().then(() => {
  configPath = path.join(__dirname, 'config.json');
  loadConfig();
  parseArgs();
  lastGoodIp = bindIp;
  lastGoodPort = lastGoodPort || 9100;
  Menu.setApplicationMenu(buildMenu(currentLang));
  createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
