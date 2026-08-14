> ⚠️ **非官方声明 / Disclaimer**
>
> 本应用的 **APP 外包装(桌面壳)非深度求索(DeepSeek)官方包装**,由第三方构建;整体**仅作测试使用**,请勿用于生产环境。

# DeepSeek Harness 桌面版(本地版)

把 DeepSeek Harness(通过 npm 安装的 `@deepseek-ai/dsh`)包装成一个**本地可运行**的 macOS 桌面应用。

> **两个版本并存(互不影响)**:
> - **本地版**(本仓库,`DeepSeek Harness 本地版.app`):完全自包含,内置 Node + dsh 运行时,双击即用。
> - **网页版**(旧版,`~/Applications/DeepSeek Harness 网页版.app`):依赖系统全局 node / dsh,当前正在运行的就是它。
> 两者都读写 `~/.dsh`,但窗口标题与 Dock 名称带有后缀,易于区分。

## 特性

- **完全自包含**:`.app` 内置了
  - `vendor/node` — Node.js v24 独立运行时(与构建时编译原生模块的版本一致,保证 ABI 兼容)
  - `vendor/dsh` — 完整的 dsh 运行时(CLI + 全部 `dsh-*` 插件与依赖,约 330MB)
  - 启动时自动运行 `dsh web --port 0` 后端,并在 Electron 窗口内加载 Web UI
- **零外部依赖**:不需要系统全局安装 node / dsh,不需要 npm,双击即可运行
- **系统兜底**:若内置文件缺失(如开发模式),自动回退到系统里的 node / dsh
- **数据独立**:后端数据仍写入 `~/.dsh`(可用 `DSH_HOME` 环境变量覆盖),升级应用不丢会话

## 目录结构

```
dsh-desktop/
├── main.js              # Electron 主进程:解析运行时、启动后端、加载 UI
├── package.json
├── vendor/
│   ├── node/node        # 内置 Node 运行时(121MB)
│   └── dsh/             # 内置 dsh 运行时(333MB)
├── build/               # 图标(DeepSeek 鲸鱼)
├── loading.html         # 启动页
├── error.html           # 错误页
└── DeepSeek Harness 本地版.app   # 打包产物(含内置 vendor)
```

## 使用

### 直接运行

```bash
open "DeepSeek Harness 本地版.app"
```

### 分发文件

`dist/` 下提供两种安装格式(均含"本地版"后缀,与网页版区分):
- `DeepSeek Harness 本地版-0.2.0-macOS-arm64.dmg`(推荐,双击挂载后拖入 Applications)
- `DeepSeek Harness 本地版-0.2.0-macOS-arm64.zip`(备用)

### 开发模式(需要本机有 node + 全局 dsh)

```bash
npm install        # 安装 electron / electron-packager(devDependencies)
npm start          # electron . 启动
```

### 自检

```bash
npm run resolve    # 打印运行时解析结果(bundled / system / none)后退出
```

### 重新打包

```bash
npm run pack
codesign --force --deep --sign - "DeepSeek Harness-darwin-arm64/DeepSeek Harness.app"
```

> 重新打包需要本机存在 `~/.local/lib/node_modules/@deepseek-ai/dsh`(npm 全局安装的 dsh)作为内置后端来源,以及 `~/.local/nodejs/` 下的 Node 运行时;脚本约定在 `vendor/` 中,可自行替换。

## 排障

- **窗口显示"未找到 dsh 运行时"**:说明内置 `vendor/` 缺失且系统也没有全局 dsh,请重新打包或先 `npm install -g @deepseek-ai/dsh`。
- **后端启动失败**:错误页会显示 dsh 进程的退出码;也可以从终端直接运行 `DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness --resolve` 查看解析结果。
- **想用别的数据目录**:启动前设置 `DSH_HOME=/path/to/dir`。
