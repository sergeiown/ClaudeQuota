/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Menu } = require('electron');

/**
 * The tray context menu.
 *
 * @param {object} opts
 * @param {boolean} opts.autoLaunchEnabled
 * @param {() => void} opts.onToggleAutoLaunch
 * @param {() => void} opts.onOpenLog
 * @param {() => void} opts.onAbout
 * @param {() => void} opts.onQuit
 */
function buildTrayMenu({ autoLaunchEnabled, onToggleAutoLaunch, onOpenLog, onAbout, onQuit }) {
  return Menu.buildFromTemplate([
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: onToggleAutoLaunch,
    },
    {
      label: 'Open log',
      click: onOpenLog,
    },
    {
      label: 'About',
      click: onAbout,
    },
    {
      label: 'Quit',
      click: onQuit,
    },
  ]);
}

module.exports = {
  buildTrayMenu,
};
