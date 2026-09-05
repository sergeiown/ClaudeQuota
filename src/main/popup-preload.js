/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('popupApi', {
  togglePin: () => ipcRenderer.send('popup:toggle-pin'),
  toggleMinimize: () => ipcRenderer.send('popup:toggle-minimize'),
  triggerAction: () => ipcRenderer.send('popup:action'),
});
