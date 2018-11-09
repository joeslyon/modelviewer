import {BrowserWindow,globalShortcut} from 'electron'

function doRegister(cmd, callback) {
  globalShortcut.register(cmd, callback);
}

export function registerShortcut() {
  let registed = globalShortcut.isRegistered("F9");
  if (registed) return;

  doRegister("F9", function() {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.webContents.toggleDevTools();
  });

  doRegister("F5", function() {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.reload();
  });

  return;
}
