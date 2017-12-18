// Utilities to set up app instances
//
// Copyright 2012-2013 E14N https://e14n.com/
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

"use strict";

var cp = require("child_process"),
    path = require("path"),
    vows = require("perjury"),
    assert = vows.assert;

var withAppSetup = function(batchConfig) {
    batchConfig.topic = function() {
        // XXX fix this hack when we separate the daemon from app startup logic
        var callback = this.callback,
            child = cp.fork(path.join(__dirname, "../../app.js"), ["--nologger", "true",
                                                                   "--port", "58185",
                                                                   "--driver", "memory",
                                                                   "--name", "Pump2Tweet test harness"]);

        // XXX yes, this is super dirty.
        setTimeout(function() {
            callback(null, child);
        }, 1500);

        child.on("error", function(err) {
            callback(err, null);
        });

	    child.on("exit", function(code, signal) {
            if (code !== 0 && signal !== "SIGTERM") {
                callback(new Error("Child process exited with exit code " + code), null);
            }
        });
    };

    batchConfig.teardown = function(child) {
        child.kill();
	    this.callback();
    };

	batchConfig["it works"] = function(err) {
        assert.ifError(err);
    };

    return {
        "When we set up the app": batchConfig
    };
};

exports.withAppSetup = withAppSetup;
