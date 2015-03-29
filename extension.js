// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*jshint esnext: true */
/*jshint indent: 4 */

/* Numix/Ozon Project 2015
 * Extension's version: 0.3.2
 *
 * Changelog was moved to README.md
 * 
 * TODO(s):
 *  - bug on each initialization, dock stuck not hiding until hovered out
 *  - add animation of adding-removing app icon on redisplay and only shows that
 *    animation when dock is not hidden
 *  - app label only shows when animation not running (see #18)
 *  - check behavior on multiple monitor
 *  - add settings schema
 *  - implement workspace button
 */

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
//const GnomeDash = Me.imports.gnomedash;
        /* Not needed anymore, it was a pure 'less is more decision' since it's 2 lines vs. a separate file and an extra Class*/
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
const Main = imports.ui.main;

let injections = {};
let oldDash;
let atomDock;
let intellihide;

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

function init() {
       
}

function enable() {
    /* Make sure we don't see the old Dash anymore */    
    Main.overview._dash.actor.get_parent().hide();    
    oldDash = Main.overview._dash; 

    /* Enable new dock */
    atomDock = new AtomDock.AtomDock();
    intellihide = new Intellihide.Intellihide(show, hide, atomDock);

    /* Make Shell respect our custom Dock as the 'real deal' :) */    
    Main.overview._dash = atomDock.dash;    

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
    
    /*Make sure the original Dock is usable after disabling Atom Dock*/        
    Main.overview._dash = oldDash;    
    Main.overview._dash.actor.get_parent().show();

    for (i in injections) {
        removeInjection(AppDisplay.AppIconMenu.prototype, injections, i);
    }

    /*Cleanup*/    
    injections = {};
    atomDock= null;
    intellihide=null;
    oldDash=null;    
}
