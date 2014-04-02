const Lang = imports.lang;
const Main = imports.ui.main;
const St = imports.gi.St;
const Signals = imports.signals;

const nosDock = new Lang.Class({
	Name: 'nosDock',

	_init: function() {
		this._box = new St.BoxLayout({ name: 'nosDockBox', reactive: true, track_hover:true,
            style_class: 'box'} );
        this.actor = new St.Bin({ name: 'nosDockContainer',reactive: false,
            style_class: 'helloworld-label', y_align: St.Align.MIDDLE, child: this._box});

        this.actor.height = 60;
        this.actor.width = 500;

        this._realizeId = this.actor.connect("realize", Lang.bind(this, this._initialize));

        this._monitor = Main.layoutManager.primaryMonitor;
        
        Main.uiGroup.add_child(this.actor);
	},

	_initialize: function() {
		this._resetPosition();
	},

	_resetPosition: function() {
		this.actor.set_position(Math.floor(this._monitor.width / 2 - this.actor.width / 2),
			this._monitor.height - this.actor.height);
	}
});

Signals.addSignalMethods(nosDock.prototype);