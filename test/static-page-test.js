// that static pages are served properly
//
// Copyright 2017 AJ Jordan
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

var vows = require("perjury"),
    assert = vows.assert,
    apputil = require("./lib/app"),
    Browser = require("zombie"),
    withAppSetup = apputil.withAppSetup;

function standardTitle(err, br) {
	assert.ifError(err);
	br.assert.text("title", "Pump2Tweet");
}

function standardNavbar(err, br) {
	// XXX is this coupling too much to implementation?
	// I'm leaning on the side of more specificity for good blowups but I'm not sure

	// Hamburger overflow
	br.assert.elements(".navbar .btn.btn-navbar span.icon-bar", 3);

	// Brand link
	br.assert.text(".navbar a.brand", "Pump2Tweet");
	br.assert.attribute(".navbar a.brand", "href", "/");

	// "Home" link
	br.assert.text(".navbar ul.nav li:nth-of-type(1)", "Home");
	br.assert.text(".navbar ul.nav li:nth-of-type(1) a", "Home");
	br.assert.attribute(".navbar ul.nav li:nth-of-type(1) a", "href", "/");

	// "About" link
	br.assert.text(".navbar ul.nav li:nth-of-type(2)", "About");
	br.assert.text(".navbar ul.nav li:nth-of-type(2) a", "About");
	br.assert.attribute(".navbar ul.nav li:nth-of-type(2) a", "href", "/about");

	// "Login" link
	br.assert.text(".navbar ul.nav li:nth-of-type(3)", "Login");
	br.assert.text(".navbar ul.nav li:nth-of-type(3) a", "Login");
	br.assert.attribute(".navbar ul.nav li:nth-of-type(3) a", "href", "/login");
}

function standardFooter(err, br) {
	br.assert.text("footer", "Pump2Tweet is brought to you by E14N, because we think you're awesome.");
}

vows.describe("static webpage content").addBatch(withAppSetup({
	"and we visit the root URL": {
		topic: function() {
			var cb = this.callback,
			    browser = new Browser();

			browser.visit("http://localhost:58185/", function(err) {
				cb(err, browser);
			});
		},
		teardown: function(br) {
			if (br && br.window.close) {
				br.window.close();
				this.callback();
			}
		},
		"it works": function(err, br) {
			assert.ifError(err);
			br.assert.success();
		},
		"it has the right title": standardTitle,
		"it has the right H1": function(err, br) {
			assert.ifError(err);
			br.assert.text("h1", "Pump2Tweet");
		},
		"it has a Get Started button": function(err, br) {
			br.assert.text("a.btn.btn-primary", "Get started »");
		},
		"it has an image": function(err, br) {
			br.assert.element("img");
		},
		"it has some explanatory paragraphs": function(err, br) {
			br.assert.elements(".content p", {atLeast: 3});
		},
		"it includes the standard footer": standardFooter,
		"the standard navbar is present": standardNavbar,
		"the right navbar element is highlighted": function(err, br) {
			br.assert.element(".navbar ul.nav li.active");
			br.assert.text(".navbar ul.nav li.active", "Home");
		}
	},
	"and we visit the About page": {
		topic: function() {
			var cb = this.callback,
			    browser = new Browser();

			browser.visit("http://localhost:58185/about", function(err) {
				cb(err, browser);
			});
		},
		teardown: function(br) {
			if (br && br.window.close) {
				br.window.close();
				this.callback();
			}
		},
		"it works": function(err, br) {
			assert.ifError(err);
			br.assert.success();
		},
		"it has the right title": standardTitle,
		"it has no H1": function(err, br) {
			assert.ifError(err);
			br.assert.elements("h1", 0);
		},
		"it has a lot of explanatory paragraphs": function(err, br) {
			br.assert.elements(".content p", {atLeast: 4});
		},
		"it includes the standard footer": standardFooter,
		"the standard navbar is present": standardNavbar,
		"the right navbar element is highlighted": function(err, br) {
			br.assert.element(".navbar ul.nav li.active");
			// TODO uncomment this assertion when bug #22 is fixed
			// br.assert.text(".navbar ul.nav li.active", "About");
		}
	},
	"and we visit the login page": {
		topic: function() {
			var cb = this.callback,
			    browser = new Browser();

			browser.visit("http://localhost:58185/login", function(err) {
				cb(err, browser);
			});
		},
		teardown: function(br) {
			if (br && br.window.close) {
				br.window.close();
				this.callback();
			}
		},
		"it works": function(err, br) {
			assert.ifError(err);
			br.assert.success();
		},
		"it has the right title": standardTitle,
		"it has the right H1": function(err, br) {
			assert.ifError(err);
			br.assert.text("h1", "Login");
		},
		"it has a short instructional paragraph": function(err, br) {
			br.assert.element(".content p");
		},
		"the instructions include a link to try pump.io": function(err, br) {
			br.assert.text(".content p a", "Try it");
		},
		"it has a the right form elements": function(err, br) {
			br.assert.text(".content form label", "Webfinger ID");
			br.assert.element(".content form input[id='webfinger']");
			br.assert.attribute(".content form input#webfinger", "placeholder", "you@example.com");
			br.assert.text(".content form span.help-block", /^Enter your ID on your pump.io site.*server$/);
		},
		"it has a Login button": function(err, br) {
			br.assert.attribute(".content form input.btn.btn-primary[type='submit']", "value", "Login");
		},
		"it includes the standard footer": standardFooter,
		"the standard navbar is present": standardNavbar,
		"the right navbar element is highlighted": function(err, br) {
			br.assert.element(".navbar ul.nav li.active");
			// TODO uncomment this assertion when bug #22 is fixed
			// br.assert.text(".navbar ul.nav li.active", "Login");
		}
	}
})).export(module);
