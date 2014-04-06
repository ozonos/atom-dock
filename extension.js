// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

/* Numix/Ozon Project 2014
 * 
 * Extension's version: 0.1
 * 
 * 0.1 Changes:
 *  - added NosDock to contain NosDash and handle intellihide behaviors
 *  - added NosDash containing favorite and running apps list
 *  - hide dock's background on overview, taken from nos-panel
 *  - convert indentation to spaces, added emacs header line
 * 
 * TODO(s): 
 *  - on some initialization, icon sizes are not correct
 *  - fix drag and drop behavior
 *  - fix icon's tooltip appearance
 *  - fix gdm log message "Source ID <integer> was not found when attempting to remove it"
 *    when hovering and unhovering icon
 *  - use different name for NosDash?
 *  - check behavior on multiple monitor
 *  - add settings schema
 *  - implement intellihide
 *  - implement workspace button
 *  - implement 75% of screen width as maximum dock width instead of 100%
 * 
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const GnomeDash = Me.imports.gnomedash;
const NosDock = Me.imports.nosdock;

let oldDash;
let nosDock;
let signalHandler;

function init() {
    oldDash = new GnomeDash.gnomeDash();
    signalHandler = new Convenience.GlobalSignalHandler();
}

function setDockTransparent() {
    nosDock.dash.actor.get_first_child().add_style_class_name('nos-hide-background');
}

function unsetDockTransparent() {
    nosDock.dash.actor.get_first_child().remove_style_class_name('nos-hide-background');
}

function enable() {
    oldDash.hideDash();
    nosDock = new NosDock.NosDock();
    signalHandler.push(
        [
            Main.overview,
            'showing',
            setDockTransparent
        ],
        [
            Main.overview,
            'hiding',
            unsetDockTransparent
        ]);
}

function disable() {
    signalHandler.disconnect();
    nosDock.destroy();
    oldDash.showDash();
}
