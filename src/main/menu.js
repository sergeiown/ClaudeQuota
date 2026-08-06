'use strict';

const { Menu } = require('electron');

/**
 * The tray context menu - exactly 3 items, no more, per spec.
 *
 * @param {object} opts
 * @param {boolean} opts.autoLaunchEnabled
 * @param {() => void} opts.onToggleAutoLaunch
 * @param {() => void} opts.onAbout
 * @param {() => void} opts.onQuit
 */
function buildTrayMenu({ autoLaunchEnabled, onToggleAutoLaunch, onAbout, onQuit }) {
  return Menu.buildFromTemplate([
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: onToggleAutoLaunch,
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
