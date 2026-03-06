if (require('electron-squirrel-startup')) return;
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        icon: path.join(__dirname, 'icon.png'), // If icon exists
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

    // Remove menu bar
    mainWindow.setMenuBarVisibility(false);

    // Load the index.html from the same directory
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
