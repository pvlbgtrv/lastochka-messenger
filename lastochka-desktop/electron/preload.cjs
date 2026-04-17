const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('lastochkaDesktop', {
  platform: process.platform,
})
