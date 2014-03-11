const Lang = imports.lang;
const Main = imports.ui.main;

let gnomeDash = function(){
	this.init();
}

gnomeDash.prototype = {
	init: function(){
		this.dash = Main.overview._dash.actor.get_parent();
	},

	hideDash: function(){
		this.dash.hide();
	},

	showDash: function(){
		this.dash.show();
	},
};