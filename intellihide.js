// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*jshint esnext: true */
/*jshint indent: 4 */

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const handledWindowTypes = [
    Meta.WindowType.NORMAL,
    Meta.WindowType.DIALOG,
    Meta.WindowType.MODAL_DIALOG,
    Meta.WindowType.TOOLBAR,
    Meta.WindowType.MENU,
    Meta.WindowType.UTILITY,
    Meta.WindowType.SPLASHSCREEN
];

/*
 * Forked from Michele's Dash to Dock extension
 * https://github.com/micheleg/dash-to-dock
 *
 * A rough and ugly implementation of the intellihide behaviour.
 * Intellihide object: call show()/hide() function based on the overlap with the
 * the target actor object;
 *
 * Target object has to contain a Clutter.ActorBox object named staticBox and
 * emit a 'box-changed' signal when this changes.
 *
 */

const Intellihide = new Lang.Class({
    Name: 'Intellihide',

    _init: function(show,hide,target) {
        this._signalHandler = new Convenience.GlobalSignalHandler();
        this._tracker = Shell.WindowTracker.get_default();
        this._focusApp = null;

        // current intellihide status
        this.status = undefined;
        // manually temporary disable intellihide update
        this._disableIntellihide = false;
        // Set base functions
        this.showFunction = show;
        this.hideFunction = hide;
        // Target object
        this._target = target;

        /* Main id of the timeout controlling timeout for updateDockVisibility
         * function when windows are dragged around (move and resize).
         */
        this._windowChangedTimeout = 0;

        // Connect global signals
        this._signalHandler.push(
            // call updateVisibility when target actor changes
            [
                this._target,
                'box-changed',
                Lang.bind(this, this._updateDockVisibility)
            ],
            /* Subscribe to dash redisplay-workspace-switched event which
             * emitted after dash finish redisplay specifically on
             * workspace-switched event.
             */
            [
                this._target.dash,
                'redisplay-workspace-switched',
                Lang.bind(this, this._switchWorkspace)
            ],
            /* Add timeout when window grab-operation begins and
             * remove it when it ends. These signals only exist starting from
             * Gnome-Shell 3.4
             */
            [
                global.display,
                'grab-op-begin',
                Lang.bind(this, this._grabOpBegin)
            ],
            [
                global.display,
                'grab-op-end',
                Lang.bind(this, this._grabOpEnd)
            ],
            // Direct maximize/unmazimize are not included in grab-operations
            [
                global.window_manager,
                'maximize',
                Lang.bind(this, this._updateDockVisibility)
            ],
            [
                global.window_manager,
                'unmaximize',
                Lang.bind(this, this._updateDockVisibility)
            ],
            /* Trigggered for instance when a window is changed
             * (also during switch-workspace).
             */
            [
                global.screen,
                'restacked',
                Lang.bind(this, this._windowRestacked)
            ],
            // Set visibility in overview mode
            [
                Main.overview,
                'showing',
                Lang.bind(this, this._overviewEnter)
            ],
            [
                Main.overview,
                'hiding',
                Lang.bind(this, this._overviewExit)
            ],
            /* update wne monitor changes, for instance in multimonitor
             * when monitor are attached
             */
            [
                global.screen,
                'monitors-changed',
                Lang.bind(this, this._updateDockVisibility)
            ]
        );

        // initialize: call show forcing to initialize status variable
        this._show(true);

        // update visibility
        this._updateDockVisibility();
    },

    destroy: function() {
        // Disconnect global signals
        this._signalHandler.disconnect();

        if (this._windowChangedTimeout > 0) {
            Mainloop.source_remove(this._windowChangedTimeout);
        }

        this._windowChangedTimeout = 0;
    },

    _show: function(force) {

        if (this.status !== true || force) {
            this.status = true;
            this.showFunction();
        }

    },

    _hide: function(force) {

        if (this.status !== false || force) {
            this.status = false;
            this.hideFunction();
        }

    },

    _overviewExit: function() {
        // Inside the overview the dash could have been hidden
        this.status = undefined;
        this._disableIntellihide = false;
        this._updateDockVisibility();
    },

    _overviewEnter: function() {
        this._disableIntellihide = true;
    },

    _grabOpBegin: function() {
        // A good compromise between reactivity and efficiency; to be tuned.
        let INTERVAL = 100;

        if (this._windowChangedTimeout > 0) {
            Mainloop.source_remove(this._windowChangedTimeout); // Just to be sure
        }

        this._windowChangedTimeout = Mainloop.timeout_add(INTERVAL,
            Lang.bind(this, function() {
                this._updateDockVisibility();
                // to make the loop continue
                return true;
            })
        );
    },

    _grabOpEnd: function() {

        if (this._windowChangedTimeout > 0) {
            Mainloop.source_remove(this._windowChangedTimeout);
        }

        this._windowChangedTimeout = 0;
        this._updateDockVisibility();
    },

    _switchWorkspace: function() {
        this._updateDockVisibility();
    },

    _windowRestacked: function() {
        /* Skip update dock on workspace switch, because we need that
         * to be handled by _switchWorkspace.
         */
        if (Main.wm._workspaceSwitcherPopup === null) {
            this._updateDockVisibility();
        }
    },

    _updateDockVisibility: function() {

        if (!this._disableIntellihide) {
            let overlaps = false;
            let windows = global.get_window_actors();

            if (windows.length > 0) {
                // This is the window on top of all others in the current workspace
                let topWindow = windows[windows.length - 1].get_meta_window();
                // If there isn't a focused app, use that of the window on top
                this._focusApp = this._tracker.focus_app ||
                    this._tracker.get_window_app(topWindow);

                windows = windows.filter(this._intellihideFilterInteresting, this);

                for (let i = 0; i < windows.length; i++) {

                    let win = windows[i].get_meta_window();
                    if (win) {
                        let rect = win.get_frame_rect();

                        let test = (rect.x < this._target.staticBox.x2) &&
                            (rect.x +rect.width > this._target.staticBox.x1) &&
                            (rect.y < this._target.staticBox.y2) &&
                            (rect.y +rect.height > this._target.staticBox.y1);

                        if (test) {
                            overlaps = true;
                            break;
                        }
                    }
                }
            }

            if (overlaps) {
                this._hide();
            } else {
                this._show();
            }
        }
    },

    /* Filter interesting windows to be considered for intellihide.
     * Consider all windows visible on the current workspace.
     * Optionally skip windows of other applications
     */
    _intellihideFilterInteresting: function(wa) {
        let currentWorkspace = global.screen.get_active_workspace_index();

        let meta_win = wa.get_meta_window();
        if (!meta_win) {
            return false;
        }

        if (!this._handledWindow(meta_win)) {
            return false;
        }

        let wksp = meta_win.get_workspace();
        let wksp_index = wksp.index();

        // Skip windows of other apps
        if (this._focusApp) {
            /* The DropDownTerminal extension is not an application per sec
             * so we match its window by wm class instead
             */
            if (meta_win.get_wm_class() === 'DropDownTerminalWindow') {
                return true;
            }

            let currentApp = this._tracker.get_window_app(meta_win);

            /* But consider half maximized windows
             * Useful if one is using two apps side by side
             */
            if (this._focusApp !== currentApp &&
                    !(meta_win.maximized_vertically &&
                        !meta_win.maximized_horizontally)) {
                return false;
            }
        }

        if (wksp_index === currentWorkspace &&
                meta_win.showing_on_its_workspace()) {
            return true;
        } else {
            return false;
        }

    },

    /* Filter windows by type
     * inspired by Opacify@gnome-shell.localdomain.pl
     */
    _handledWindow: function(metaWindow) {

        /* The DropDownTerminal extension uses the POPUP_MENU window type hint
         * so we match its window by wm class instead
         */
        if (metaWindow.get_wm_class() === 'DropDownTerminalWindow') {

            return true;
        }

        let wtype = metaWindow.get_window_type();

        for (let i = 0; i < handledWindowTypes.length; i++) {
            let hwtype = handledWindowTypes[i];

            if (hwtype === wtype) {

                return true;
            } else if (hwtype > wtype) {

                return false;
            }
        }

        return false;
    }
});
