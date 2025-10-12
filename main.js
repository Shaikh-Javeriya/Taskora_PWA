// main.js – universal (dev + packaged)
const { app, BrowserWindow } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const net = require("net");

let win, nextServer;
const PORT = 3000;

// wait for server to actually respond on the port
function waitForPort(port, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      const socket = net.createConnection(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.end();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeout) reject(new Error("timeout"));
        else setTimeout(check, 300);
      });
    };
    check();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
    icon: path.join(process.resourcesPath, "public", "icon.png"),
  });
  win.loadURL(`http://localhost:${PORT}`);
}

app.whenReady().then(async () => {
  const serverPath = app.isPackaged
    ? path.join(process.resourcesPath, ".next", "standalone", "server.js")
    : path.join(__dirname, ".next", "standalone", "server.js");

  if (!fs.existsSync(serverPath)) {
    console.error("❌ Missing server.js at", serverPath);
    const errWin = new BrowserWindow({ width: 600, height: 400 });
    errWin.loadURL(
      "data:text/html,<h2 style='color:red;text-align:center;'>❌ Missing server.js<br>" +
      serverPath +
      "</h2>"
    );
    return;
  }

  console.log("🟢 Starting Next.js server:", serverPath);

  nextServer = spawn(
    process.platform === "win32" ? "node.exe" : "node",
    [serverPath], {
    cwd: path.dirname(serverPath),
    env: { ...process.env, PORT: String(PORT) },
    stdio: "ignore", // 🚀 don’t depend on stdout for readiness
    detached: true,
  });

  // ✅ instead of parsing stdout, poll the port
  try {
    await waitForPort(PORT, 30000);
    console.log("✅ Next.js server responded, launching window...");
    createWindow();
  } catch (err) {
    console.error("⏰ Server never became ready:", err);
    const errWin = new BrowserWindow({ width: 600, height: 400 });
    errWin.loadURL(
      "data:text/html,<h3 style='color:red;text-align:center;'>Server did not start:<br>" +
      err.message +
      "</h3>"
    );
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
