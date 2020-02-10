// This file is required by the index.html file and will
// be executed in the renderer process for that window

//import
const {remote, ipcRenderer} = require('electron');
const ElectronTitlebarWindows = require('electron-titlebar-windows');

//Create the custom titlebar
let titlebar = new ElectronTitlebarWindows({
    backgroundColor: '#a9f5f2'
});

//Update Titlebar text
//titlebar.updateTitle('Sonic Dash Run');

//add titlebar
titlebar.appendTo(document.body);

//events
//minimize
titlebar.on('minimize', e => {
    remote.getCurrentWindow().minimize();
});
//maximize
titlebar.on('fullscreen', e => {
    remote.getCurrentWindow().maximize();
});
//restore
titlebar.on('maximize', e => {
    remote.getCurrentWindow().unmaximize();
});
//close
titlebar.on('close', e => {
    remote.app.quit();
});