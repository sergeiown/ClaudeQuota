# <img src="build/icon-source.png" width="32" height="32" alt=""> ClaudeQuota

[![Windows](https://img.shields.io/badge/platform-windows-0078D6?logo=windows&logoColor=white)](https://en.wikipedia.org/wiki/List_of_Microsoft_Windows_versions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://github.com/sergeiown/ClaudeQuota/blob/master/LICENSE)

[![English](https://img.shields.io/badge/-English-blue)](README.md)
[![Українська](https://img.shields.io/badge/-%D0%A3%D0%BA%D1%80%D0%B0%D1%97%D0%BD%D1%81%D1%8C%D0%BA%D0%B0-lightgrey)](README.uk.md)

A Windows tray app that shows your Claude usage limits at a glance, in either of two styles:

- **Horizontal bars** (default): two fill bars, one for the 5-hour window and one for the 7-day window.
- **Vertical bars**: the same two values as vertical columns side by side, left for the 5-hour window, right for the 7-day one.

- **Hover** the icon to see the exact percentages and reset times in the tooltip.
- **Left-click** the icon to open a small popup with an enlarged, more detailed view of the same bars/columns, matching whichever display style is currently selected.
- **Right-click** the icon for the tray menu: start with Windows (on by default after install, toggleable), show notifications (on by default, toggleable), display style (switches between horizontal and vertical bars, remembered across restarts), open log, about, and quit.

Each bar's empty ("track") color is fixed and just identifies which one is which - blue for the 5-hour window, purple for the 7-day one - it doesn't change with usage. The filled part is colored by how close that window is to its limit: green at 50% and under, amber from 51% to 80%, red at 81% and above. Both use the same thresholds, and a thin outline keeps each bar visible even near empty.

You'll also get a Windows notification the first time a window's usage passes 51%, 81%, 99%, and 100% - the last one also says when that window resets. Each one shows the app icon plus a small preview of that bar, and clicking it opens the popup. Nothing fires retroactively: usage already past a threshold when the app starts doesn't trigger a notification for it.

All of these colors, plus the icon itself, follow your Windows light/dark theme and redraw immediately if you switch it - no restart needed.

| | Light theme | Dark theme |
|---|---|---|
| 5-hour track | ![](https://img.shields.io/badge/-%20-78A0D2) `#78A0D2` (12% opacity) | ![](https://img.shields.io/badge/-%20-64A5FF) `#64A5FF` (8% opacity) |
| 7-day track | ![](https://img.shields.io/badge/-%20-C3A5DC) `#C3A5DC` (12% opacity) | ![](https://img.shields.io/badge/-%20-C89BFF) `#C89BFF` (8% opacity) |
| Fill, 0-50% | ![](https://img.shields.io/badge/-%20-00C800) `#00C800` | ![](https://img.shields.io/badge/-%20-00C800) `#00C800` |
| Fill, 51-80% | ![](https://img.shields.io/badge/-%20-FFC800) `#FFC800` | ![](https://img.shields.io/badge/-%20-FFC800) `#FFC800` |
| Fill, 81-100% | ![](https://img.shields.io/badge/-%20-E00000) `#E00000` | ![](https://img.shields.io/badge/-%20-FF3B30) `#FF3B30` |

## How it works

The app reads the OAuth token that the Claude Code CLI already saved locally (`~/.claude/.credentials.json`) and polls the undocumented `GET https://api.anthropic.com/api/oauth/usage` endpoint, which returns the current `five_hour` and `seven_day` limit utilization. No data goes anywhere except `api.anthropic.com`.

Since the endpoint is undocumented and the access token lives for about an hour, the app:

- polls the usage endpoint no more than once every 180 seconds (a limit enforced by the token itself, not an arbitrary choice);
- proactively refreshes the access token via the refresh token before it expires;
- never writes to the CLI's own credentials file - a refreshed token is kept in a separate private cache instead, and whichever of the two (CLI file or private cache) has the newer token wins on the next check.

![ClaudeQuota data flow](docs/structure.svg)

## Requirements

- Windows 10/11.
- Claude Code CLI installed and logged in (`claude login`).

## License

[MIT](LICENSE).

Bundles the [Fredoka](https://fonts.google.com/specimen/Fredoka) font (SIL Open Font License, see `assets/fonts/OFL.txt`).
