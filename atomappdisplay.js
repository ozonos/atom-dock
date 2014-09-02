// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*jshint esnext: true */
/*jshint indent: 4 */

const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

// Get Gnome version for AppIconMenu compability
let ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".").map(function (x) { return +x; });
const MAJOR_VERSION = ShellVersion[0];
const MINOR_VERSION = ShellVersion[1];

const WindowMenuItem = new Lang.Class({
    Name: 'WindowMenuItem',
    Extends: PopupMenu.PopupBaseMenuItem,

    _init: function (text, params) {
        this.parent(params);

        this.label = new St.Label({text: text});

        this.actor.add(this.label);
    }
});

/* This class is a extension of the upstream AppIcon class (ui.appDisplay.js).
 * Changes are done to modify activate, popup menu and running app behavior.
 */
const AtomAppIcon = new Lang.Class({
    Name: 'AtomAppIcon',
    Extends: AppDisplay.AppIcon,

    _init : function(app, iconParams) {
        this.parent(app, iconParams);
        this._windowsChangedId = this.app.connect('windows-changed',
            Lang.bind(this, this._onStateChanged));
    },

    _onActivate: function (event) {
        this.emit('launching');
        let modifiers = event.get_state();

        if (!this._isAppOnActiveWorkspace() ||
            (modifiers & Clutter.ModifierType.CONTROL_MASK &&
                    this.app.state === Shell.AppState.RUNNING)) {

            this.app.open_new_window(-1);
        } else {
            this.app.activate();
        }

        Main.overview.hide();
    },

    _onStateChanged: function() {
        if (this.app.state !== Shell.AppState.STOPPED &&
            this._isAppOnActiveWorkspace()) {

            this.actor.add_style_class_name('running');
        } else {
            this.actor.remove_style_class_name('running');
        }
    },

    _onDestroy: function() {
        if (this._windowsChangedId > 0) {
            this.app.disconnect(this._windowsChangedId);
        }

        this._windowsChangedId = 0;
        this.parent();
    },

    popupMenu: function() {
        this._removeMenuTimeout();
        this.actor.fake_release();
        this._draggable.fakeRelease();

        if (!this._menu) {
            this._menu = new AtomAppIconMenu(this);

            // Everything else should be the same
            this._menu.connect('activate-window',
                Lang.bind(this, function (menu, window) {
                    this.activateWindow(window);
                })
            );

            this._menu.connect('open-state-changed',
                Lang.bind(this, function (menu, isPoppedUp) {
                    if (!isPoppedUp) {
                        this._onMenuPoppedDown();
                    }
                })
            );

            Main.overview.connect('hiding', Lang.bind(this, this._menu.close));

            this._menuManager.addMenu(this._menu);
        }

        this.emit('menu-state-changed', true);
        this.actor.set_hover(true);
        this._menu.popup();
        this._menuManager.ignoreRelease();
        this.emit('sync-tooltip');

        return false;
    },

    _isAppOnActiveWorkspace: function() {
        return this.app.is_on_workspace(global.screen.get_active_workspace());
    }
});

Signals.addSignalMethods(AtomAppIcon.prototype);

/* This class is a fork of the upstream AppIconMenu class (ui.appDisplay.js)
 * of Gnome 3.12. Changes are done to make popup displayed on top side.
 */
const AtomAppIconMenu = new Lang.Class({
    Name: 'AtomAppIconMenu',
    Extends: PopupMenu.PopupMenu,

    _init: function(source) {

        this.parent(source.actor, 0.5, St.Side.TOP);

        // We want to keep the item hovered while the menu is up
        this.blockSourceEvents = true;

        this._source = source;

        this.actor.add_style_class_name('app-well-menu');

        // Chain our visibility and lifecycle to that of the source
        source.actor.connect('notify::mapped', Lang.bind(this, function () {
            if (!source.actor.mapped) {
                this.close();
            }
        }));
        source.actor.connect('destroy', Lang.bind(this, function () { this.actor.destroy(); }));

        Main.uiGroup.add_actor(this.actor);
    },

    _redisplay: function() {
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
    },

    _appendSeparator: function () {
        let separator = new PopupMenu.PopupSeparatorMenuItem();
        this.addMenuItem(separator);
    },

    _appendMenuItem: function(labelText) {
        // FIXME: app-well-menu-item style
        let item = new PopupMenu.PopupMenuItem(labelText);
        this.addMenuItem(item);
        return item;
    },

    popup: function(activatingButton) {
        this._redisplay();
        this.open();
    }
});
Signals.addSignalMethods(AtomAppIconMenu.prototype);