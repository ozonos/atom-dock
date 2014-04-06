// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Signals = imports.signals;
const Lang = imports.lang;
const St = imports.gi.St;

const Main = imports.ui.main;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const NosDash = Me.imports.nosdash;

/* This class handles the dock and intellihide behavior.
 * Heavily inspired from Michele's Dash to Dock extension
 * https://github.com/micheleg/dash-to-dock
 */
const NosDock = new Lang.Class({
    Name: 'NosDock',

    _init: function() {
        this._signalHandler = new Convenience.GlobalSignalHandler();

        this.dash = new NosDash.NosDash();
        this.forcedOverview = false;

        this.dash.showAppsButton.connect('notify::checked', Lang.bind(this, this._onShowAppsButtonToggled));

        this._box = new St.BoxLayout({ name: 'nosDockBox', reactive: true, track_hover: true,
            style_class: 'box' });
        this.actor = new St.Bin({ name: 'nosDockContainer',reactive: false,
            style_class: 'container', x_align: St.Align.MIDDLE, child: this._box});

        this._realizeId = this.actor.connect('realize', Lang.bind(this, this._initialize));

        this._box.add_actor(this.dash.actor);

        // Reset position when icon size changed
        this.dash.connect('icon-size-changed', Lang.bind(this, this._resetPosition));

        Main.uiGroup.add_child(this.actor);
        Main.layoutManager._trackActor(this._box, { trackFullscreen: true });
        Main.layoutManager._trackActor(this.dash._box, { affectsStruts: false });

        this._signalHandler.push(
            [
                global.screen,
                'monitors-changed',
                Lang.bind(this, this._resetPosition)
            ],
            [
                Main.overview.viewSelector._showAppsButton,
                'notify::checked',
                Lang.bind(this, this._syncShowAppsButtonToggled)
            ]);
    },

    _initialize: function() {
        if (this._realizeId > 0){
            this.actor.disconnect(this._realizeId);
            this._realizeId = 0;
        }

        // Set initial position
        this._resetPosition();
    },

    _resetPosition: function() {
        // Get the monitor
        this._monitor = Main.layoutManager.primaryMonitor;

        this.actor.width = Math.round(this._monitor.width);
        this.actor.x = this._monitor.x;
        this.actor.x_align = St.Align.MIDDLE;
        this.actor.y = this._monitor.height - this.actor.height;
        this.dash._container.set_width(-1);
    },

    _onShowAppsButtonToggled: function() {

        // Sync the status of the default appButtons. Only if the two statuses are
        // different, that means the user interacted with the extension provided
        // application button, cutomize the behaviour. Otherwise the shell has changed the
        // status (due to the _syncShowAppsButtonToggled function below) and it
        // has already performed the desired action.

        let selector = Main.overview.viewSelector;

        if(selector._showAppsButton.checked !== this.dash.showAppsButton.checked){

            if(this.dash.showAppsButton.checked){
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

        // whenever the button is unactivated even if not by the user still reset the
        // forcedOverview flag
        if( this.dash.showAppsButton.checked==false)
            this.forcedOverview = false;
    },

    // Keep ShowAppsButton status in sync with the overview status
    _syncShowAppsButtonToggled: function() {
        let status = Main.overview.viewSelector._showAppsButton.checked;
        if(this.dash.showAppsButton.checked !== status)
            this.dash.showAppsButton.checked = status;
    },

    destroy: function() {
        // Disconnect global signals
        this._signalHandler.disconnect();

        // Destroy everything
        this.dash.destroy();
        this.actor.destroy();
    }

});

Signals.addSignalMethods(NosDock.prototype);
