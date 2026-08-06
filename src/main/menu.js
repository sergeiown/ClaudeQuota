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
      label: 'Запускати разом із Windows',
      type: 'checkbox',
      checked: autoLaunchEnabled,
      click: onToggleAutoLaunch,
    },
    {
      label: 'Про програму',
      click: onAbout,
    },
    {
      label: 'Вихід',
      click: onQuit,
    },
  ]);
}

module.exports = {
  buildTrayMenu,
};
