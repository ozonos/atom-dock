// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const AppDisplay = imports.ui.appDisplay;
const AppFavorites = imports.ui.appFavorites;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;

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
            this._menu.connect('activate-window', Lang.bind(this, function (menu, window) {
                this.activateWindow(window);
            }));
            this._menu.connect('open-state-changed', Lang.bind(this, function (menu, isPoppedUp) {
                if (!isPoppedUp) {
                    this._onMenuPoppedDown();
                }
            }));
            Main.overview.connect('hiding', Lang.bind(this, function () { this._menu.close(); }));

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

/* This class is a fork of the upstream AppIconMenu class (ui.appDisplay.js).
 * Changes are done to make popup displayed on top side.
 */
const AtomAppIconMenu = new Lang.Class({
    Name: 'AtomAppIconMenu',
    Extends: PopupMenu.PopupMenu,

    _init: function(source) {

        this.parent(source.actor, 0.5, St.Side.TOP);

        // We want to keep the item hovered while the menu is up
        this.blockSourceEvents = true;

        this._source = source;

        this.connect('activate', Lang.bind(this, this._onActivate));

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
        this.removeAll();

        let windows = this._source.app.get_windows().filter(function(w) {
            return Shell.WindowTracker.is_window_interesting(w);
        });

        // Display the app windows menu items and the separator between windows
        // of the current desktop and other windows.
        let activeWorkspace = global.screen.get_active_workspace();
        let separatorShown = windows.length > 0 && windows[0].get_workspace() != activeWorkspace;

        for (let i = 0; i < windows.length; i++) {
            if (!separatorShown && windows[i].get_workspace() != activeWorkspace) {
                this._appendSeparator();
                separatorShown = true;
            }
            let item = this._appendMenuItem(windows[i].title);
            item._window = windows[i];
        }

        if (!this._source.app.is_window_backed()) {
            if (windows.length > 0) {
                this._appendSeparator();
            }

            let isFavorite = AppFavorites.getAppFavorites().isFavorite(this._source.app.get_id());

            this._newWindowMenuItem = this._appendMenuItem(_("New Window"));
            this._appendSeparator();

            this._toggleFavoriteMenuItem = this._appendMenuItem(isFavorite ? _("Remove from Favorites")
                                                                : _("Add to Favorites"));
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
    },

    _onActivate: function (actor, child) {
        if (child._window) {
            let metaWindow = child._window;
            this.emit('activate-window', metaWindow);
        } else if (child === this._newWindowMenuItem) {
            this._source.app.open_new_window(-1);
            this.emit('activate-window', null);
        } else if (child === this._toggleFavoriteMenuItem) {
            let favs = AppFavorites.getAppFavorites();
            let isFavorite = favs.isFavorite(this._source.app.get_id());
            if (isFavorite) {
                favs.removeFavorite(this._source.app.get_id());
            } else {
                favs.addFavorite(this._source.app.get_id());
            }
        }
        this.close();
    }
});
Signals.addSignalMethods(AtomAppIconMenu.prototype);
