
const St = imports.gi.St;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const GnomeDash = Me.imports.gnomedash;
const NosDock = Me.imports.nosdock;

let old_dash;
let nosDock;

function init() {
  old_dash = new GnomeDash.gnomeDash();
}

function enable() {
  old_dash.hideDash();
  nosDock = new NosDock.nosDock();
}

function disable() {
  old_dash.showDash();
  nosDock.destroy();
}
