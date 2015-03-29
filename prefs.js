// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Mainloop = imports.mainloop;

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const Gettext = imports.gettext.domain('atomdock');
const _ = Gettext.gettext;
const N_ = function(e) { return e; };

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;


const AtomDockSettingsWidget = new GObject.Class({
    Name: 'AtomDock.AtomDockSettingsWidget',
    GTypeName: 'AtomDockSettingsWidget',
    Extends: Gtk.Box,

    _init: function(params) {
        this.parent(params);
        this.settings = Convenience.getSettings('org.gnome.shell.extensions.atom-dock');

        /* Main Settins */
        let mainSettings = new Gtk.Box({orientation:Gtk.Orientation.VERTICAL});
        let mainSettingsTitle = new Gtk.Label({label:_("Main Settings")});
        mainSettings.add(mainSettingsTitle);

        let dockSettingsMain1 = new Gtk.Box({spacing:30,orientation:Gtk.Orientation.HORIZONTAL,
                                                homogeneous:true, margin:10});
        indentWidget(dockSettingsMain1);

        /* Per-workspace-app */
        let perWorkspaceControl = new Gtk.Box({spacing:30, margin_left:10, margin_top:10, margin_right:10});
        let perWorkspaceLabel = new Gtk.Label({label: _("Only show open app per workspace"),
                                            xalign: 0, hexpand:true});
        let perWorkspace = new Gtk.Switch({halign:Gtk.Align.END});
        perWorkspace.set_active(this.settings.get_boolean('per-workspace-app'));
        perWorkspace.connect('notify::active', Lang.bind(this, function(check){
            this.settings.set_boolean('per-workspace-app', check.get_active());
        }));
        perWorkspaceControl.add(perWorkspaceLabel);
        perWorkspaceControl.add(perWorkspace);

        /* Timing settings */
        let dockSettingsGrid1= new Gtk.Grid({row_homogeneous:true,column_homogeneous:false});

        let animationTimeLabel = new Gtk.Label({label: _("Animation time [ms]"), use_markup: true, xalign: 0,hexpand:true});
        let animationTime = new Gtk.SpinButton({halign:Gtk.Align.END});
        animationTime.set_sensitive(true);
        animationTime.set_range(0, 5000);
        animationTime.set_value(this.settings.get_double('animation-time')*1000);
        animationTime.set_increments(50, 100);
        animationTime.connect('value-changed', Lang.bind(this, function(button){
            let s = button.get_value_as_int()/1000;
            this.settings.set_double('animation-time', s);
        }));

        let showDelayLabel = new Gtk.Label({label: _("Show delay [ms]"), use_markup: true, xalign: 0, hexpand:true});
        let showDelay = new Gtk.SpinButton({halign:Gtk.Align.END});
        showDelay.set_sensitive(true);
        showDelay.set_range(0, 5000);
        showDelay.set_value(this.settings.get_double('show-delay')*1000);
        showDelay.set_increments(50, 100);
        showDelay.connect('value-changed', Lang.bind(this, function(button){
            let s = button.get_value_as_int()/1000;
            this.settings.set_double('show-delay', s);
        }));

        let hideDelayLabel = new Gtk.Label({label: _("Hide delay [ms]"), use_markup: true, xalign: 0, hexpand:true});
        let hideDelay = new Gtk.SpinButton({halign:Gtk.Align.END});
        hideDelay.set_sensitive(true);
        hideDelay.set_range(0, 5000);
        hideDelay.set_value(this.settings.get_double('hide-delay')*1000);
        hideDelay.set_increments(50, 100);
        hideDelay.connect('value-changed', Lang.bind(this, function(button){
            let s = button.get_value_as_int()/1000;
            this.settings.set_double('hide-delay', s);
        }));

        dockSettingsGrid1.attach(animationTimeLabel, 0,0,1,1);
        dockSettingsGrid1.attach(animationTime, 1,0,1,1);
        dockSettingsGrid1.attach(showDelayLabel, 0,1,1,1);
        dockSettingsGrid1.attach(showDelay, 1,1,1,1);
        dockSettingsGrid1.attach(hideDelayLabel, 0,2,1,1);
        dockSettingsGrid1.attach(hideDelay, 1,2,1,1);

        dockSettingsMain1.add(dockSettingsGrid1);

        /* Add everything */
        mainSettings.add(perWorkspaceControl);
        mainSettings.add(dockSettingsMain1);

        this.add(mainSettings);
    }
});

function init() {
    Convenience.initTranslations();
}

function buildPrefsWidget() {
    let widget = new AtomDockSettingsWidget({orientation: Gtk.Orientation.VERTICAL,
                                                spacing:5, border_width:5});
    widget.show_all();
    return widget;
}

/*
* Add a margin to the widget:
* left margin in LTR
* right margin in RTL
*/
function indentWidget(widget){
    let indent = 20;
    if(Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL){
        widget.set_margin_right(indent);
    } else {
        widget.set_margin_left(indent);
    }
}