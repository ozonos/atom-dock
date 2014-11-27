// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*jshint esnext: true */
/*jshint indent: 4 */

/* Numix/Ozon Project 2014
 *
 * Extension's version: 0.3.1
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
 *
 * TODO(s):
 *  - bug on each initialization, dock stuck not hiding until hovered out
 *  - add animation of adding-removing app icon on redisplay and only shows that
 *    animation when dock is not hidden
 *  - app label only shows when animation not running (see #18)
 *  - check behavior on multiple monitor
 *  - add settings schema
 *  - implement workspace button
 *
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GnomeDash = Me.imports.gnomedash;
const Intellihide = Me.imports.intellihide;
const AtomDock = Me.imports.atomdock;

const Lang = imports.lang;
const St = imports.gi.St;
const Atk = imports.gi.Atk;
const Signals = imports.signals;
const Mainloop = imports.mainloop;

const AppDisplay = imports.ui.appDisplay;
const PopupMenu  = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;

let injections = {};

const WindowMenuItem = new Lang.Class({
    Name: 'WindowMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, params) {
        this.parent(params);

        this.label = new St.Label({text: text});

        this.actor.add(this.label);
    }
});

function injectToFunction(parent, name, func) {
    let origin = parent[name];
    parent[name] = function() {
        let ret;
        ret = origin.apply(this, arguments);
        if (ret === undefined) {
            ret = func.apply(this, arguments);
        }

        return ret;
    };

    return origin;
}

let oldDash;
let atomDock;
let intellihide;

function init() {
    oldDash = new GnomeDash.GnomeDash();
}

function removeInjection(object, injection, name) {
    if (injection[name] === undefined) {
        delete object[name];
    } else {
        object[name] = injection[name];
    }
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

    injections = {};

    injections['_redisplay'] = undefined;

    injections['_redisplay'] = injectToFunction(AppDisplay.AppIconMenu.prototype, '_redisplay', function () {
// Re-create the menu.
        // TODO: Jumplist support?
        this.removeAll()

        let appWindows = this._source.app.get_windows().filter(function(w) {
            return !w.skip_taskbar;
        });

        let activeWorkspace = global.screen.get_active_workspace();
        let separatorShown = appWindows.length > 0 && appWindows[0].get_workspace() != activeWorkspace;

        for (let i = 0; i < appWindows.length; i++) {
            let window = appWindows[i];
            if (!separatorShown && window.get_workspace() !== activeWorkspace) {
                this._appendSeparator();
                separatorShown = true;
            }
            let item = this._appendMenuItem(window.title);
            item.connect('activate', Lang.bind(this, function() {
                this.emit('activate-window', window);
            }));
        }

        if (!this._source.app.is_window_backed()) {
            if (appWindows.length > 0) {
                this._appendSeparator();
            }

            let isFav = AppFavorites.getAppFavorites().isFavorite(this._source.app.get_id());

            this._newWindowMenuItem = this._appendMenuItem(_("New Window"));
            this._newWindowMenuItem.connect('activate', Lang.bind(this, function() {
                this._source.app.open_new_window(-1);
                this.emit('activate-window', null);
            }));
            this._appendSeparator();

            if (isFav) {
                let item = this.toggleFavouriteMenuItem = this._appendMenuItem(_("Unpin Application"));
                item.connect('activate', Lang.bind(this, function(emitter, event) {
                   let favs = AppFavorites.getAppFavorites();
                   favs.removeFavorite(this._source.app.get_id());
                }));
            } else {
                let item = this.toggleFavouriteMenuItem = this._appendMenuItem(_("Pin Application"));
                item.connect('activate', Lang.bind(this, function(emitter, event) {
                   let favs = AppFavorites.getAppFavorites();
                   favs.addFavorite(this._source.app.get_id());
                }));
            }
        }

        let app = this._source.app;
        this._quitMenuItem = undefined;

        if (app.get_n_windows() > 0) {
            this._quitMenuItem = this._appendMenuItem(_("Quit"))
            this._quitMenuItem.connect('activate', Lang.bind(this, function () {
                let app = this._source.app;
                let wins = app.get_windows();

                for (let i=0; i < wins.length; i++) {
                    wins[i].delete(global.get_current_time());
                }
            }));
        }
    });
}

function disable() {
    intellihide.destroy();
    atomDock.destroy();
    oldDash.showDash();

    for (i in injections) {
        removeInjection(AppDisplay.AppIconMenu.prototype, injections, i);
    }

    injections = {};
}
