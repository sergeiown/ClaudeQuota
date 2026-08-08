/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Menu } = require('electron');

function buildTrayMenu({
  autoLaunchEnabled,
  onToggleAutoLaunch,
  displayStyle,
  onToggleDisplayStyle,
  onOpenLog,
  onAbout,
  onQuit,
}) {
  return Menu.buildFromTemplate([
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: onToggleAutoLaunch,
    },
    {
      label: `Display style: ${displayStyle === 'columns' ? 'Vertical bars' : 'Horizontal bars'}`,
      click: onToggleDisplayStyle,
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
