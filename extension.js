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
 *  - fix gdm log message "Source ID <integer> was not found when attempting to remove it"
 *    when hovering and unhovering icon
 *  - fix icon's tooltip appearance
 *  - use different name for NosDash?
 *  - check behavior on multiple monitor
 * 
 */

const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GnomeDash = Me.imports.gnomedash;
const NosDock = Me.imports.nosdock;

let old_dash;
let nosDock;

function init() {
    old_dash = new GnomeDash.gnomeDash();
}

function setDockTransparent() {
    nosDock.dash.actor.get_first_child().add_style_class_name('nos-hide-background');
}

function unsetDockTransparent() {
    nosDock.dash.actor.get_first_child().remove_style_class_name('nos-hide-background');
}

function enable() {
    old_dash.hideDash();
    nosDock = new NosDock.NosDock();
    Main.overview.connect('showing', setDockTransparent);
    Main.overview.connect('hiding', unsetDockTransparent);
}

function disable() {
    old_dash.showDash();
    nosDock.destroy();
}
