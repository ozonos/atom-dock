// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/*jshint esnext: true */
/*jshint indent: 4 */

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const AtomDash = Me.imports.atomdash;


/* This class handles the dock and intellihide behavior.
 * Heavily inspired from Michele's Dash to Dock extension
 * https://github.com/micheleg/dash-to-dock
 */
const AtomDock = new Lang.Class({
    Name: 'AtomDock',

    _init: function(settings) {

        // Load settings
        this._settings = settings;
        this._bindSettingsChanges();

        // initialize animation status object
        this._animStatus = new AnimationStatus(true);

        // Current autohide status
        this._autohideStatus = false;

        // Overview shown status
        this.forcedOverview = false;

        // Put dock on the primary monitor
        this._monitor = Main.layoutManager.primaryMonitor;

        // Used to store dock position for intellihide checking
        this.staticBox = new Clutter.ActorBox();

        // Create dash
        this.dash = new AtomDash.AtomDash();
        this.dash.showAppsButton.connect('notify::checked',
                Lang.bind(this, this._onShowAppsButtonToggled));

        this.actor = new St.Bin({
            name: 'atomDockContainer',
            reactive: false,
            x_align: St.Align.MIDDLE
        });

        this.actor._delegate = this;

        this._box = new St.BoxLayout({
            name: 'atomDockBox',
            reactive: true,
            track_hover: true
        });

        this._box.connect("notify::hover", Lang.bind(this, this._hoverChanged));

        this._signalHandler = new Convenience.GlobalSignalHandler();
        this._signalHandler.push(
            [
                global.screen,
                'monitors-changed',
                Lang.bind(this, this._resetPosition)
            ],
            [
                St.ThemeContext.get_for_stage(global.stage),
                'changed',
                Lang.bind(this, this._onThemeChanged)
            ],
            [
                Main.overview.viewSelector._showAppsButton,
                'notify::checked',
                Lang.bind(this, this._syncShowAppsButtonToggled)
            ],
            [
                Main.overview,
                'showing',
                Lang.bind(this, this._setTransparent)
            ],
            [
                Main.overview,
                'hiding',
                Lang.bind(this, this._setOpaque)
            ],
            [
               Main.messageTray,
                'showing',
                Lang.bind(this, this._forceHide)       
            ],
            [
               Main.messageTray,
                'hiding',
                Lang.bind(this, this._delayedSyncHover)       
            ]
        );

        // Hide the dock while setting position and theme
        this.actor.set_opacity(0);

        /* Since the actor is not a topLevel child and its parent is now not
         * added to the Chrome, the allocation change of the parent container
         * (slide in and slideout) doesn't trigger anymore an update of the
         * input regions. Force the update manually.
         */
        this.actor.connect('notify::allocation',
            Lang.bind(Main.layoutManager,
                Main.layoutManager._queueUpdateRegions
        ));

        this.dash._container.connect('allocation-changed',
            Lang.bind(this, this._updateStaticBox)
        );

        // Reset position when icon size changed
        this.dash.connect('icon-size-changed',
            Lang.bind(this, this._updateYPosition)
        );

        // sync hover after a popupmenu is closed
        this.dash.connect('menu-closed', Lang.bind(this,
            function() {
                this._box.sync_hover();
            })
        );

        // Dash accessibility
        Main.ctrlAltTabManager.addGroup(this.dash.actor, _("Dock"),
            'user-bookmarks-symbolic',
            { focusCallback: Lang.bind(this, this._onAccessibilityFocus) }
        );

        /* Delay operations that require the shell to be fully loaded and with
        * user theme applied.
        */
        this._realizeId = this.actor.connect('realize',
            Lang.bind(this, this._initialize)
        );

        // Add dash container actor and the container to the Chrome
        this.actor.set_child(this._box);
        this._box.add_actor(this.dash.actor);


        Main.uiGroup.add_child(this.actor);
        Main.layoutManager._trackActor(this._box, { trackFullscreen: true });

        /* Pretend this._box is isToplevel child so that fullscreen
         * is actually tracked.
         */
        let index = Main.layoutManager._findActor(this._box);
        Main.layoutManager._trackedActors[index].isToplevel = true;
    },

    _initialize: function() {

        if (this._realizeId > 0) {
            this.actor.disconnect(this._realizeId);
            this._realizeId = 0;
        }

        // Set the default dock style
        this._setOpaque();

        // Set initial position
        this._resetPosition();

        // Adjust dock theme to match global theme
        this._adjustTheme();

        // Show the dock;
        this.actor.set_opacity(255);
    },

    _resetPosition: function() {

        // Get primary monitor to display dock
        this._monitor = Main.layoutManager.primaryMonitor;

        // Update static box location
        this._updateStaticBox();

        this.actor.width = this._monitor.width;
        this.actor.x = this._monitor.x;
        this.actor.x_align = St.Align.MIDDLE;
        this._updateYPosition();
        this.dash._container.set_width(-1);
    },

    _updateYPosition: function() {
        this.actor.y = this._monitor.y + this._monitor.height - this._box.height;
        // Modify legacy overview each time the dock repositioned
        this._modifyLegacyOverview();
    },

    _updateStaticBox: function() {
        // Init static box in accordance with dock's placement
        this.staticBox.init_rect(
            this._monitor.x + this._box.x,
            this._monitor.y + this._monitor.height - this._box.height,
            this._box.width,
            this._box.height
        );

        this.emit('box-changed');
    },

    _onThemeChanged: function() {
        this.dash._queueRedisplay();
        this._adjustTheme();
        this._resetPosition();
    },

    _adjustTheme: function() {
        // Prevent shell crash if the actor is not on the stage.
        // It happens enabling/disabling repeatedly the extension
        if (!this.dash._container.get_stage()) {
            return;
        }

        // Remove prior style edits
        this.dash._container.set_style(null);

        let themeNode = this.dash._container.get_theme_node();
        let borderColor = themeNode.get_border_color(St.Side.TOP);
        let borderWidth = themeNode.get_border_width(St.Side.TOP);
        let borderRadius = themeNode.get_border_radius(St.Corner.TOPRIGHT);

        /* We're copying border and corner styles to left border and top-left
         * corner, also removing bottom border and bottom-right corner styles
         */
        let newStyle = 'border-bottom: none;' +
            'border-radius: ' + borderRadius + 'px ' + borderRadius + 'px 0 0;' +
            'border-left: ' + borderWidth + 'px solid ' + borderColor.to_string() + ';';

        this.dash._container.set_style(newStyle);
    },

    _modifyLegacyOverview: function() {
        // Set legacy overview bottom padding
        let actorStyle = 'padding-bottom: ' + this._box.height + 'px;';
        Main.overview.viewSelector.actor.set_style(actorStyle);
    },

    _restoreLegacyOverview: function() {
        // Remove legacy overview bottom padding
        Main.overview.viewSelector.actor.set_style(null);
    },

    _bindSettingsChanges: function() {
        // TODO
    },

    _onShowAppsButtonToggled: function() {
        /* Sync the status of the default appButtons. Only if the two statuses
         * are different, that means the user interacted with the extension
         * provided application button, cutomize the behaviour. Otherwise the
         * shell has changed the status (due to the _syncShowAppsButtonToggled
         * function below) and it has already performed the desired action.
         */

        let selector = Main.overview.viewSelector;

        if (selector._showAppsButton.checked !== this.dash.showAppsButton.checked) {

            if (this.dash.showAppsButton.checked) {

                if (!Main.overview._shown) {
                    // force entering overview if needed
                    Main.overview.show();
                    this.forcedOverview = true;
                }

                selector._showAppsButton.checked = true;
            } else {

                if (this.forcedOverview) {
                    // force exiting overview if needed
                    Main.overview.hide();
                    this.forcedOverview = false;
                }

                selector._showAppsButton.checked = false;
            }
        }

        /* Whenever the button is unactivated even if not by the user
         * still reset the forcedOverview flag.
         */
        if (this.dash.showAppsButton.checked === false) {
            this.forcedOverview = false;
        }
    },

    // Keep ShowAppsButton status in sync with the overview status
    _syncShowAppsButtonToggled: function() {
        let status = Main.overview.viewSelector._showAppsButton.checked;
        this.dash.showAppsButton.checked = status;
    },

    // Show the dock and give focus to it
    _onAccessibilityFocus: function() {
        this._box.navigate_focus(null, Gtk.DirectionType.TAB_FORWARD, false);
        this._animateIn(this._settings.get_double('animation-time'), 0);
    },

    destroy: function() {
        // Disconnect global signals
        this._signalHandler.disconnect();

        // Destroy everything
        this.dash.destroy();
        this.actor.destroy();

        // Restore legacy overview modifications
        this._restoreLegacyOverview();
    },

    _setOpaque: function() {
        this.dash._container.add_style_pseudo_class('desktop');
    },

    _setTransparent: function() {
        this.dash._container.remove_style_pseudo_class('desktop');
        this.disableAutoHide();
    },

    _hoverChanged: function() {
        /* Skip if dock is not in autohide mode for instance because it is shown
         * by intellihide. Delay the hover changes check while switching
         * workspace: the workspaceSwitcherPopup steals the hover status and it
         * is not restored until the mouse move again (sync_hover has no effect).
         */
        if (Main.wm._workspaceSwitcherPopup) {
            this._delayedSyncHover();
        } else if (this._autohideStatus) {
            if (this._box.hover) {
                this._show();
            } else {
                this._hide();
            }
        }
    },

    _show: function() {
        let anim = this._animStatus;

        if (this._autohideStatus && (anim.hidden() || anim.hiding())) {
            let delay;
            /* If the dock is hidden, wait this._settings.get_double('show-delay')
             * before showing it otherwise show it immediately.
             */
            if (anim.hidden()) {
                delay = this._settings.get_double('show-delay');
            } else if (anim.hiding()) {
                /* suppress all potential queued hiding animations
                 * (always give priority to show)
                 */
                this._removeAnimations();
                delay = 0;
            }

            this.emit('showing');
            this._animateIn(this._settings.get_double('animation-time'), delay);
        }
    },

    _hide: function() {
        let anim = this._animStatus;

        // If no hiding animation is running or queued
        if (this._autohideStatus && (anim.showing() || anim.shown())) {
            let delay;

            /* If a show is queued but still not started (i.e the mouse was
             * over the screen  border but then went away, i.e not a sufficient
             *  amount of time is passeed to trigger the dock showing) remove it.
             */
            if (anim.showing()) {
                if (anim.running) {
                    /* if a show already started, let it finish;
                     * queue hide without removing the show. To obtain this I
                     * increase the delay to avoid the overlap and interference
                     * between the animations
                     */
                    delay = this._settings.get_double('hide-delay')
                            + 1.2 * this._settings.get_double('animation-time')
                            + this._settings.get_double('show-delay');
                } else {
                    this._removeAnimations();
                    delay = 0;
                }
            } else if (anim.shown()) {
                delay = this._settings.get_double('hide-delay');
            }

            this.emit('hiding');
            this._animateOut(this._settings.get_double('animation-time'), delay);

        }
    },
    
    _forceHide: function(){
        if(this._autohideStatus === false){
            this.enableAutoHide();        
        }
        this._hide();
    },
    
    _delayedSyncHover: function(){
        Mainloop.timeout_add(500, Lang.bind(this, function() {
            this._box.sync_hover();
            this._hoverChanged();
            return false;
        }));
    },

    _removeAnimations: function() {
        Tweener.removeTweens(this.actor);
        this._animStatus.clearAll();
    },

   _animateIn: function(time, delay) {
        this._animStatus.queue(true);
        Tweener.addTween(this.actor, {
            y: this._monitor.y + this._monitor.height - this._box.height,
            time: time,
            delay: delay,
            transition: 'easeOutQuad',

            onStart:  Lang.bind(this, function() {
                this._animStatus.start();
            }),

            onOverwrite : Lang.bind(this, function() {
                this._animStatus.clear();
            }),

            onComplete: Lang.bind(this, function() {
                this._animStatus.end();
            })
        });
    },

    _animateOut: function(time, delay) {
        this._animStatus.queue(false);
        Tweener.addTween(this.actor, {
            y: this._monitor.y + this._monitor.height - 1,
            time: time,
            delay: delay,
            transition: 'easeOutQuad',

            onStart:  Lang.bind(this, function() {
                this._animStatus.start();
            }),

            onOverwrite : Lang.bind(this, function() {
                this._animStatus.clear();
            }),

            onComplete: Lang.bind(this, function() {
                this._animStatus.end();
            })
        });
    },

    // Disable autohide effect, thus show dash
    disableAutoHide: function() {

        if (this._autohideStatus === true) {
            this._autohideStatus = false;
            this._removeAnimations();
            this._animateIn(this._settings.get_double('animation-time'), 0);
        }
    },

    // Enable autohide effect, hide dash
    enableAutoHide: function() {

        if (this._autohideStatus === false) {
            // immediately fadein background if hide is blocked by mouseover,
            let delay = 0;
            // oterwise start fadein when dock is already hidden.
            this._autohideStatus = true;
            this._removeAnimations();

            if (this._box.hover === true) {
                this._box.sync_hover();
            }

            if (!this._box.hover) {
                this._animateOut(this._settings.get_double('animation-time'), 0);
                delay = this._settings.get_double('animation-time');
            } else {
                delay = 0;
            }
        }
    }

});

Signals.addSignalMethods(AtomDock.prototype);

/*
 * Store animation status in a perhaps overcomplicated way.
 * status is true for visible, false for hidden
 */
const AnimationStatus = new Lang.Class({
    Name: 'AnimationStatus',

    _init: function(initialStatus) {
        this.status = initialStatus;
        this.nextStatus  = [];
        this.queued = false;
        this.running = false;
    },

    queue: function(nextStatus) {
        this.nextStatus.push(nextStatus);
        this.queued = true;
    },

    start: function() {

        if (this.nextStatus.length === 1) {
            this.queued = false;
        }

        this.running = true;
    },

    end: function() {

        if (this.nextStatus.length === 1) {
            // in the case end is called and start was not
            this.queued = false;
        }

        this.running = false;
        this.status = this.nextStatus.shift();
    },

    clear: function() {

        if (this.nextStatus.length == 1) {
            this.queued = false;
            this.running = false;
        }

        this.nextStatus.splice(0, 1);
    },

    clearAll: function() {
        this.queued  = false;
        this.running = false;
        this.nextStatus.splice(0, this.nextStatus.length);
    },

    // Return true if a showing animation is running or queued
    showing: function() {

        if ((this.running === true || this.queued === true) &&
                this.nextStatus[0] === true) {

            return true;
        } else {

            return false;
        }
    },

    shown: function() {

        if (this.status === true &&
                !(this.queued || this.running)) {

            return true;
        } else {

            return false;
        }
    },

    // Return true if an hiding animation is running or queued
    hiding: function() {

        if ((this.running === true || this.queued === true) &&
                this.nextStatus[0] === false) {

            return true;
        } else {

            return false;
        }
    },

    hidden: function() {

        if (this.status === false && !(this.queued || this.running)) {

            return true;
        } else {

            return false;
        }
    }
});
