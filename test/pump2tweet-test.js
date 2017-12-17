// test the pump2tweet model module
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
    assert = vows.assert;

vows.describe("Pump2Tweet application model").addBatch({
	"When we require the module": {
		topic: function() {
			return require("../models/pump2tweet");
		},
		"it works": function(err) {
			assert.ifError(err);
		},
		"it exports an object": function(err, Pump2Tweet) {
			assert.isObject(Pump2Tweet);
		},
		"the object has the right properties": function(err, Pump2Tweet) {
			assert.includes(Pump2Tweet, "name");
			assert.isNull(Pump2Tweet.name);
			assert.includes(Pump2Tweet, "hostname");
			assert.isNull(Pump2Tweet.hostname);
			assert.includes(Pump2Tweet, "description");
			assert.isNull(Pump2Tweet.description);
			assert.includes(Pump2Tweet, "protocol");
			assert.isString(Pump2Tweet.protocol);
			assert.equal(Pump2Tweet.protocol, "http");
			assert.includes(Pump2Tweet, "url");
			assert.isFunction(Pump2Tweet.url);
			assert.includes(Pump2Tweet, "asService");
			assert.isFunction(Pump2Tweet.asService);
		},
		"and we set up a bunch of config values": {
			topic: function(Pump2Tweet) {
				Pump2Tweet.name = "Test Pump2Tweet";
				Pump2Tweet.hostname = "pump2tweet.local";
				Pump2Tweet.description = "A Pump2Tweet that will be slain if it breaks its vows";
				return Pump2Tweet;
			},
			"it works": function(err) {
				assert.ifError(err);
			},
			"and we call Pump2Tweet.url()": {
				topic: function(Pump2Tweet) {
					return Pump2Tweet.url("/authorized");
				},
				"it works": function(err) {
					assert.ifError(err);
				},
				"it returns the right URL": function(err, url) {
					assert.isString(url);
					assert.equal(url, "http://pump2tweet.local/authorized");
				}
			},
			"and we call Pump2Tweet.asService()": {
				topic: function(Pump2Tweet) {
					return Pump2Tweet.asService();
				},
				"it works": function(err) {
					assert.ifError(err);
				},
				"it returns an ActivityStreams service object": function(err, obj) {
					assert.isObject(obj);
					assert.includes(obj, "objectType");
					assert.equal(obj.objectType, "service");
					assert.includes(obj, "displayName");
					assert.equal(obj.displayName, "Test Pump2Tweet");
					assert.includes(obj, "id");
					assert.equal(obj.id, "http://pump2tweet.local/");
					assert.includes(obj, "url");
					assert.equal(obj.url, "http://pump2tweet.local/");
					assert.includes(obj, "description");
					// Doesn't seem worth asserting on the whole thing, the one
					// I made up was kinda long. But, if I changed it then I
					// wouldn't get to use the word "slain", which is fun.
					assert.isTrue(obj.description.includes("slain"));
				}
			},
			"and we muck with the protocol scheme": {
				topic: function(Pump2Tweet) {
					Pump2Tweet.protocol = "https";
					return Pump2Tweet;
				},
				"it works": function(err) {
					assert.ifError(err);
				},
				"and we call Pump2Tweet.url() again": {
					topic: function(Pump2Tweet) {
						return Pump2Tweet.url("/authorized");
					},
					"it works": function(err) {
						assert.ifError(err);
					},
					"it returns the right URL": function(err, url) {
						assert.isString(url);
						assert.equal(url, "https://pump2tweet.local/authorized");
					}
				}
			}
		}
	}
}).export(module);
