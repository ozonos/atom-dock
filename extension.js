
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GnomeDash = Me.imports.gnomedash;

let old_dash;

function init() {
  old_dash = new GnomeDash.gnomeDash();
}

function enable() {
  old_dash.hideDash();
}

function disable() {
  old_dash.showDash();
}
