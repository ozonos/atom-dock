// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/* Numix/Ozon Project 2014
 * 
 * Extension's version: 0.2
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
 *  - fix drag and drop behavior
 *  - fix icon's tooltip appearance
 *  - fix gdm log message "Source ID <integer> was not found when attempting to remove it"
 *    when hovering and unhovering icon
 *  - use different name for NosDash?
 *  - check behavior on multiple monitor
 *  - add settings schema
 *  - implement workspace button
 * 
 */

const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const GnomeDash = Me.imports.gnomedash;
const Intellihide = Me.imports.intellihide;
const NosDock = Me.imports.nosdock;

let oldDash;
let nosDock;
let intellihide;
let signalHandler;

function init() {
    oldDash = new GnomeDash.gnomeDash();
    signalHandler = new Convenience.GlobalSignalHandler();
}

function show() {
    nosDock.disableAutoHide();
}

function hide() {
    nosDock.enableAutoHide();
}

function enable() {
    oldDash.hideDash();
    nosDock = new NosDock.NosDock();
    intellihide = new Intellihide.intellihide(show, hide, nosDock);
    signalHandler.push(
        [
            Main.overview,
            'showing',
            Lang.bind(nosDock, nosDock.setTransparent)
        ],
        [
            Main.overview,
            'hiding',
            Lang.bind(nosDock, nosDock.unsetTransparent)
        ]);
}

function disable() {
    signalHandler.disconnect();
    intellihide.destroy();
    nosDock.destroy();
    oldDash.showDash();
}
