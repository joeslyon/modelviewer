import { app, BrowserWindow, ipcMain, dialog } from "electron";
import { registerShortcut } from "./shortcut";

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== "development") {
  global.__static = require("path")
    .join(__dirname, "/static")
    .replace(/\\/g, "\\\\");
}

let mainWindow;
const winURL =
  process.env.NODE_ENV === "development"
    ? `http://localhost:9080`
    : `file://${__dirname}/index.html`;

// 主进程主动发送消息给渲染进程函数
function sendMessage(message, data, type = "") {
  mainWindow.webContents.send(message, { data, type });
}

function createWindow() {
  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    height: 700,
    width: 1000,
    minWidth: 500,
    minHeight: 500,
    useContentSize: true,
    frame: false,
    webPreferences: { webSecurity: false }
  });

  mainWindow.loadURL(winURL);

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("maximize", () => {
    sendMessage("win_state", "max");
  });

  mainWindow.on("unmaximize", () => {
    sendMessage("win_state", "unmax");
  });

  mainWindow.on("enter-full-screen", () => {
    sendMessage("fullscreen", "enter");
  });

  mainWindow.on("leave-full-screen", () => {
    sendMessage("fullscreen", "leave");
  });

  registerShortcut();
}

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.on("ev_close", e => {
  mainWindow.close();
});

ipcMain.on("ev_maximum", e => {
  if (mainWindow.isMaximized()) {
    mainWindow.restore();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("ev_minimize", e => {
  mainWindow.minimize();
});

ipcMain.on("ev_reload", e => {
  let win = BrowserWindow.getFocusedWindow();
  if (!win) return;
  win.reload();
});

ipcMain.on("openFile", (e, arg) => {
  let filter = arg.filters || [];
  let prop = arg.properties || ["openFile"];
  dialog.showOpenDialog(
    {
      properties: prop,

      filters: filter
    },
    function() {
      sendMessage("open-file", arguments[0]);
    }
  );
});

/**
 * Auto Updater
 *
 * Uncomment the following code below and install `electron-updater` to
 * support auto updating. Code Signing with a valid certificate is required.
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-electron-builder.html#auto-updating
 */

/*
import { autoUpdater } from 'electron-updater'

autoUpdater.on('update-downloaded', () => {
  autoUpdater.quitAndInstall()
})

app.on('ready', () => {
  if (process.env.NODE_ENV === 'production') autoUpdater.checkForUpdates()
})
 */
