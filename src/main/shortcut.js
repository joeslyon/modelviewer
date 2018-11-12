import { BrowserWindow, globalShortcut, dialog } from "electron";
import { filters } from "../renderer/config/config";

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

  doRegister("F11", function() {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    var flag = win.isFullScreen();
    win.setFullScreen(!flag);
  });

  doRegister("F5", function() {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    win.reload();
  });

  doRegister("CommandOrControl+O", function() {
    let win = BrowserWindow.getFocusedWindow();
    if (!win) return;
    dialog.showOpenDialog(
      {
        properties:["openFile"],
        filters
      },
      function() {
        win.webContents.send("open-file", {data:arguments[0]});
      }
    );
  });
  return;
}
