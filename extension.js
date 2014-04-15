// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/* Numix/Ozon Project 2014
 *
 * Extension's version: 0.3.1
 *
 * 0.3.1 Changes:
 *  - Fixed invisible box which prevent clicking even when dock is hidden
 *  - Show Applications label is now on top of dock
 *  - Icons' popup menu is now on top of dock
 *  - Fix Y position bug when switching workspace between docks with different icon size
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
 *
 * TODO(s):
 *  - bug on each initialization, dock stuck not hiding until hovered out
 *  - add animation of adding-removing app icon on redisplay and only shows that
 *    animation when dock is not hidden
 *  - app label only shows when animation not running (see #18)
 *  - check behavior on multiple monitor
 *  - implement workspace button
 *
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GnomeDash = Me.imports.gnomedash;
const Intellihide = Me.imports.intellihide;
const AtomDock = Me.imports.atomdock;

let oldDash;
let atomDock;
let intellihide;

function init() {
    oldDash = new GnomeDash.GnomeDash();
}

function show() {
    atomDock.disableAutoHide();
}

function hide() {
    atomDock.enableAutoHide();
}

function enable() {

    // Hide old dash
    oldDash.hideDash();

    // Enable new dock
    atomDock = new AtomDock.AtomDock();
    intellihide = new Intellihide.Intellihide(show, hide, atomDock);
}

function disable() {

    intellihide.destroy();
    atomDock.destroy();
    oldDash.showDash();
}
