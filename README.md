# Atom Dock

![atom-dock](https://cloud.githubusercontent.com/assets/5920259/9534407/2179d398-4d10-11e5-956b-f808b55c3753.png)

Atom Dock is a well-integrated app launcher providing convenient access to your favorite and running Applications.  

### Features 
* Show the Dash on the bottom
* Show Launchers based on current Workspace
* Intellihide Behaviour


### Compatibility

| Gnome | Compatible |
| :---: | :---: |
| 3.10 | ??? |
| 3.12 | yes |
| 3.14 | yes |
| 3.16 | yes |
| 3.18 | yes |

### Installation

To install this extension, run the following commands in your Terminal:

```bash
git clone https://github.com/ozonos/atom-dock.git
cd atom-dock
make install
```

### License

This project is licensed with GPL version 3 and later. See LICENSE for more details.

### Changelog

 * 0.3.2 Changes:
 *  - Fixed Swarm Animation to respect new Dock position
 *  - removed gnomedash.js since it was just a wrapper class for 2 lines of code,
 *    which are now in extension.js
 *  - minor code cleanups
 *
 * 0.3.1 Changes:
 *  - Fixed invisible box which prevent clicking even when dock is hidden
 *  - Show Applications label is now on top of dock
 *  - Icons' popup menu is now on top of dock
 *  - Fix Y position bug when switching workspace between docks with different icon size
 *  - Fix menu popover for Gnome 3.12
 *
 * 0.3 Changes:
 *  - implemented per-workspace-app behavior
 *  - reverse design direction from using :overview to use :desktop pseudo class
 *  - added option to uninstall with "make uninstall"
 *
 * 0.2.2 Changes:
 *  - add pseudo class :overview
 *  - added theme handling when gnome-shell theme changed
 *  - changed all nos-prefixes to atom
 *
 * 0.2.1 Changes:
 *  - change GnomeDash to Lang Class
 *  - fixed drag and drop behavior
 *  - icon label now appear on top of dock
 *  - more cleaning up
 *
 * 0.2 Changes:
 *  - added intellihide.js, implemented intellihide
 *
 * 0.1.1 Changes:
 *  - remove hardcoded css, add theme support
 *  - added Legacy Overview padding-bottom so its elements won't be behind dock
 *  - fixed incorrect icon sizes on some initialization
 *  - implemented 75% of screen width as maximum dock width instead of 100%
 *  - changed possible icon size range to 24-48px for esthetic reasons
 *
 * 0.1 Changes:
 *  - added NosDock to contain NosDash and handle intellihide behaviors
 *  - added NosDash containing favorite and running apps list
 *  - hide dock's background on overview, taken from nos-panel
 *  - convert indentation to spaces, added emacs header line
 
