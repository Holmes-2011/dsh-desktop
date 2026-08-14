// DeepSeek Harness 桌面版 v3 — 自包含
// 与 v2 的关键区别:
//  1. 内置后端: app 自带 vendor/dsh(完整 dsh 运行时)与 vendor/node(Node 24 独立运行时),
//     不再依赖系统全局 node / dsh 安装,做到"开箱即用"的本地运行。
//  2. 系统兜底: 若内置文件缺失(如开发模式下 npm start),回退到系统里的 node / dsh。
//  3. --resolve 自检模式: 打印运行时解析结果后退出,便于验证与排障。
const { app, BrowserWindow, shell } = require('electron');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let dshProcess = null;
let mainWindow = null;
let webUrl = null;

const VENDOR_DIR = path.join(__dirname, 'vendor');
const BUNDLED_NODE = path.join(VENDOR_DIR, 'node', 'node');
const BUNDLED_DSH = path.join(VENDOR_DIR, 'dsh', 'lib', 'bin.js');
const BUNDLED_DSH_PKG = path.join(VENDOR_DIR, 'dsh', 'package.json');

const EXTRA_PATH = [
  path.join(os.homedir(), '.local/bin'),
  path.join(os.homedir(), '.local/nodejs'),
  '/usr/local/bin',
  '/opt/homebrew/bin',
].join(':');

function exists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

function dshVersion() {
  try {
    return JSON.parse(fs.readFileSync(BUNDLED_DSH_PKG, 'utf8')).version || '';
  } catch { return ''; }
}

// 运行时解析优先级: 内置后端 > 系统全局安装(env 显式指定路径 > 常见路径 > PATH 兜底)
function resolveRuntime() {
  if (exists(BUNDLED_NODE) && exists(BUNDLED_DSH)) {
    return { node: BUNDLED_NODE, dsh: BUNDLED_DSH, source: 'bundled' };
  }
  const nodeCandidates = [
    process.env.DSH_NODE_PATH,
    path.join(os.homedir(), '.local/bin/node'),
    path.join(os.homedir(), '.local/nodejs/bin/node'),
    '/usr/local/bin/node',
    '/opt/homebrew/bin/node',
  ].filter(Boolean);
  const dshCandidates = [
    process.env.DSH_PATH,
    path.join(os.homedir(), '.local/bin/dsh'),
    '/usr/local/bin/dsh',
    '/opt/homebrew/bin/dsh',
  ].filter(Boolean);
  const firstExisting = (list) => { for (const c of list) if (exists(c)) return c; return null; };
  let node = firstExisting(nodeCandidates);
  let dsh = firstExisting(dshCandidates);
  try {
    const n = execFileSync('which', ['node'], { encoding: 'utf8' }).trim();
    if (n) node = node || n;
  } catch {}
  try {
    const d = execFileSync('which', ['dsh'], { encoding: 'utf8' }).trim();
    if (d) dsh = dsh || d;
  } catch {}
  if (node && dsh) return { node, dsh, source: 'system' };
  return { node, dsh, source: 'none' };
}

function childEnv() {
  const base = { ...process.env };
  const merged = `${EXTRA_PATH}:${base.PATH || ''}`;
  base.PATH = merged.replace(/:+/g, ':').replace(/:$/, '');
  // 允许外部通过 DSH_HOME 覆盖数据目录(默认 ~/.dsh),便于测试或数据隔离
  if (!base.DSH_HOME) base.DSH_HOME = path.join(os.homedir(), '.dsh');
  return base;
}

function showError(msg) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadFile(path.join(__dirname, 'error.html'), { query: { msg } });
  }
}

function startDsh() {
  // 后端已在运行(关窗后驻留场景): 直接复用已解析的 URL
  if (dshProcess) {
    if (webUrl && mainWindow) mainWindow.loadURL(webUrl);
    return;
  }
  const rt = resolveRuntime();
  if (!rt.node || !rt.dsh) {
    showError(
      '未找到 dsh 运行时:\n' +
      (rt.node ? '' : '  · 缺少 Node 运行时(内置 vendor/node 缺失,系统里也没有 node)\n') +
      (rt.dsh ? '' : '  · 缺少 dsh CLI(内置 vendor/dsh 缺失,系统里也没有 dsh)\n') +
      '请重新安装本应用;开发环境下可先运行 npm install -g @deepseek-ai/dsh'
    );
    return;
  }
  dshProcess = spawn(rt.node, [rt.dsh, 'web', '--port', '0'], {
    env: childEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let buf = '';
  dshProcess.stdout.on('data', (chunk) => {
    buf += chunk.toString();
    const m = buf.match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (m && !webUrl) {
      webUrl = `http://127.0.0.1:${m[1]}`;
      if (mainWindow) mainWindow.loadURL(webUrl);
    }
  });
  dshProcess.stderr.on('data', (c) => process.stderr.write(c));
  dshProcess.on('exit', (code, signal) => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.getURL() !== webUrl) {
      showError(`dsh 后端已退出 (code ${code}${signal ? ' signal ' + signal : ''})`);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'DeepSeek Harness 本地版',
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.setMenuBarVisibility(true);
  // 页面加载后会用自己的 <title> 覆盖窗口标题,这里强制显示"本地版"后缀以便区分网页版
  mainWindow.webContents.on('page-title-updated', (e) => {
    e.preventDefault();
    mainWindow.setTitle('DeepSeek Harness 本地版');
  });
  if (webUrl) {
    mainWindow.loadURL(webUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  }
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.disableHardwareAcceleration();

// --resolve 自检: 仅打印运行时解析结果后退出(不启动 GUI/后端)
if (process.argv.includes('--resolve')) {
  const rt = resolveRuntime();
  const out = {
    mode: 'resolve',
    source: rt.source,
    node: rt.node || null,
    dsh: rt.dsh || null,
    dshVersion: rt.dsh && rt.source === 'bundled' ? dshVersion() : null,
    bundledNode: BUNDLED_NODE,
    bundledDsh: BUNDLED_DSH,
    bundledNodeExists: exists(BUNDLED_NODE),
    bundledDshExists: exists(BUNDLED_DSH),
  };
  console.log(JSON.stringify(out, null, 2));
  app.exit(0);
}

app.whenReady().then(() => {
  // 运行时强制指定 Dock 图标(绕开系统图标缓存,确保显示鲸鱼 logo)
  try {
    app.dock.setIcon(path.join(__dirname, 'app-icon.png'));
  } catch (e) { /* 非 macOS 或失败时忽略 */ }
  createWindow();
  startDsh();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // macOS 常规行为: 窗口全关后 App 驻留后台,Dock 图标保留;Cmd+Q 仍可彻底退出
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (dshProcess) {
    try { dshProcess.kill('SIGTERM'); } catch {}
  }
});
