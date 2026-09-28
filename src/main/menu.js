/* Copyright (c) 2026 Serhii Myshko
 * Licensed under the MIT License. See LICENSE file in the project root. */

'use strict';

const { Menu, nativeImage } = require('electron');
const { renderMenuIcon } = require('../icon/render');

function menuIcon(kind, isDark) {
  return nativeImage.createFromBuffer(renderMenuIcon({ kind, isDark }));
}

function buildTrayMenu({
  autoLaunchEnabled,
  onToggleAutoLaunch,
  notificationsEnabled,
  onToggleNotifications,
  displayStyle,
  onToggleDisplayStyle,
  onAbout,
  onQuit,
  isDark,
}) {
  const isColumns = displayStyle === 'columns';
  return Menu.buildFromTemplate([
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: onToggleAutoLaunch,
    },
    {
      label: 'Show notifications',
      type: 'checkbox',
      checked: notificationsEnabled,
      click: onToggleNotifications,
    },
    {
      label: `Style: ${isColumns ? 'Columns' : 'Bars'}`,
      icon: menuIcon(isColumns ? 'style-columns' : 'style-bars', isDark),
      click: onToggleDisplayStyle,
    },
    {
      label: 'About',
      icon: menuIcon('about', isDark),
      click: onAbout,
    },
    {
      label: 'Quit',
      icon: menuIcon('quit', isDark),
      click: onQuit,
    },
  ]);
}

module.exports = {
  buildTrayMenu,
};
