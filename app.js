#!/usr/bin/env node

// app.js
//
// main function for live updates
//
// Copyright 2013, StatusNet Inc.
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

var fs = require("fs"),
    async = require("async"),
    path = require("path"),
    _ = require("underscore"),
    express = require('express'),
    DialbackClient = require("dialback-client"),
    Logger = require("bunyan"),
    routes = require('./routes'),
    databank = require("databank"),
    uuid = require("node-uuid"),
    Databank = databank.Databank,
    DatabankObject = databank.DatabankObject,
    DatabankStore = require('connect-databank')(express),
    RequestToken = require("./models/requesttoken"),
    User = require("./models/user"),
    Host = require("./models/host"),
    Pump2Tweet = require("./models/pump2tweet"),
    StatusNetUser = require("./models/statusnetuser"),
    StatusNet = require("./models/statusnet"),
    Shadow = require("./models/shadow"),
    Edge = require("./models/edge"),
    Updater = require("./lib/updater"),
    yargs = require("yargs"),
    ua = require("./lib/useragent"),
    defaults = {
        config: "/etc/pump2tweet.json",
        port: 4000,
        address: "localhost",
        hostname: "localhost",
        driver: "disk",
        // TODO just crash instead of doing something stupid, poorly
        sessionSecret: "insecure",
        name: "Pump2Tweet",
        description: "Find your Twitter friends on pump.io.",
        logLevel: "info"
    },
    config = yargs
             .usage("Usage: $0 [options]")
             .alias({c: "config", h: "help", v: "version"})
             .describe({config: "JSON configuration file path",
                        port: "Port that the HTTP server will bind to",
                        address: "Address that the HTTP server will bind to",
                        hostname: "Hostname the server's running on",
                        driver: "Databank driver",
                        params: "Databank driver parameters",
                        key: "Path to a private key file, if you're using HTTPS",
                        cert: "Path to a certificate file, if you're using HTTPS",
                        sessionSecret: "A session-generating secret, server-wide password",
                        name: "Name of the Pump2Tweet service",
                        description: "A nice human-readable description of the service",
                        logfile: "Path to a Bunyan logfile",
                        logLevel: "Bunyan log level that decides what goes into the logfile",
                        nologger: "Disable the logger, regardless of `logfile`"
                       })
             .defaults(defaults)
             .env("PUMP2TWEET")
             .config()
             .help()
             .version()
             .argv,
    log,
    logParams = {
        name: "pump2tweet",
        level: config.logLevel,
        serializers: {
            req: Logger.stdSerializers.req,
            res: Logger.stdSerializers.res
        }
    };

if (config.logfile) {
    logParams.streams = [{path: config.logfile}];
} else if (config.nologger) {
    logParams.streams = [{path: "/dev/null"}];
} else {
    logParams.streams = [{stream: process.stderr}];
}

log = new Logger(logParams);

log.info("Initializing pump live");

if (!config.params) {
    if (config.driver == "disk") {
        config.params = {dir: "/var/lib/pump2tweet/"};
    } else {
        config.params = {};
    }
}

// Define the database schema

if (!config.params.schema) {
    config.params.schema = {};
}

_.extend(config.params.schema, DialbackClient.schema);
_.extend(config.params.schema, DatabankStore.schema);

// Now, our stuff

_.each([RequestToken, Host, User, StatusNetUser, StatusNet, Shadow, Edge], function(Cls) {
    config.params.schema[Cls.type] = Cls.schema;
});

var db = Databank.get(config.driver, config.params);

async.waterfall([
    function(callback) {
        log.debug({driver: config.driver, params: config.params}, "Connecting to DB");
        db.connect({}, callback);
    },
    function(callback) {

        var app,
            bounce,
            client,
            useHTTPS = Boolean(config.key),
            requestLogger = function(log) {
                return function(req, res, next) {
                    var weblog = log.child({"req_id": uuid.v4(), component: "web"});
                    var end = res.end;
                    req.log = weblog;
                    res.end = function(chunk, encoding) {
                        var rec;
                        res.end = end;
                        res.end(chunk, encoding);
                        rec = {req: req, res: res};
                        weblog.info(rec);
                    };
                    next();
                };
            };

        // Set global databank info

        DatabankObject.bank = db;

        if (useHTTPS) {

            log.info("Using SSL");

            app = express.createServer({key: fs.readFileSync(config.key),
                                        cert: fs.readFileSync(config.cert)});
            bounce = express.createServer(function(req, res, next) {
                var host = req.header('Host');
                res.redirect('https://'+host+req.url, 301);
            });

        } else {

            log.debug("Not using SSL");

            app = express.createServer();
        }

        // Configuration

        var dbstore = new DatabankStore(db, log, 60000);

        log.debug("Configuring app");

        app.configure(function(){
            app.set('views', __dirname + '/views');
            app.set('view engine', 'utml');
            app.use(requestLogger(log));
            app.use(express.bodyParser());
            app.use(express.cookieParser());
            app.use(express.methodOverride());
            app.use(express.session({secret: config.sessionSecret,
                                     store: dbstore}));
            app.use(app.router);
            app.use(express.static(__dirname + '/public'));
        });

        app.configure('development', function(){
            app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
        });

        app.configure('production', function(){
            app.use(express.errorHandler());
        });

        // Auth middleware

        var userAuth = function(req, res, next) {

            req.user = null;
            res.local("user", null);

            if (!req.session.userID) {
                next();
            } else {
                User.get(req.session.userID, function(err, user) {
                    if (err) {
                        next(err);
                    } else {
                        req.user = user;
                        res.local("user", user);
                        next();
                    }
                });
            }
        };

        var userOptional = function(req, res, next) {
            next();
        };

        var userRequired = function(req, res, next) {
            if (!req.user) {
                next(new Error("User is required"));
            } else {
                next();
            }
        };

        var noUser = function(req, res, next) {
            if (req.user) {
                next(new Error("Already logged in"));
            } else {
                next();
            }
        };

        var userIsUser = function(req, res, next) {
            if (req.params.webfinger && req.user.id == req.params.webfinger) {
                next();
            } else {
                next(new Error("Must be the same user"));
            }
        };

        var reqSnuser = function(req, res, next) {
            var snuid = req.params.snuid;

            StatusNetUser.get(snuid, function(err, snuser) {
                if (err) {
                    next(err);
                } else {
                    req.snuser = snuser;
                    next();
                }
            });
        };

        var userIsSnuser = function(req, res, next) {
            
            Shadow.get(req.snuser.id, function(err, shadow) {
                if (err) {
                    next(err);
                } else if (shadow.pumpio != req.user.id) {
                    next(new Error("Must be same user"));
                } else {
                    next();
                }
            });
        };

        // Routes

        log.debug("Initializing routes");

        app.get('/', userAuth, userOptional, routes.index);
        app.get('/login', userAuth, noUser, routes.login);
        app.post('/login', userAuth, noUser, routes.handleLogin);
        app.post('/logout', userAuth, userRequired, routes.handleLogout);
        app.get('/about', userAuth, userOptional, routes.about);
        app.get('/authorized/:hostname', routes.authorized);
        app.get('/.well-known/host-meta.json', routes.hostmeta);
        app.get('/add-account', userAuth, userRequired, routes.addAccount);
        app.post('/add-account', userAuth, userRequired, routes.handleAddAccount);
        app.get('/authorized/statusnet/:hostname', userAuth, userRequired, routes.authorizedStatusNet);
        app.get('/find-friends/:snuid', userAuth, userRequired, reqSnuser, userIsSnuser, routes.findFriends);
        app.post('/find-friends/:snuid', userAuth, userRequired, reqSnuser, userIsSnuser, routes.saveFriends);

        // Create a dialback client

        log.debug("Initializing dialback client");

        client = new DialbackClient({
            hostname: config.hostname,
            app: app,
            bank: db,
            userAgent: ua
        });

        // Configure this global object

        Host.dialbackClient = client;

        // Configure the service object

        Pump2Tweet.name        = config.name;
        Pump2Tweet.description = config.description;
        Pump2Tweet.hostname    = config.hostname;

        Pump2Tweet.protocol = useHTTPS ? "https" : "http";

        log.debug({Pump2Tweet: _.omit(Pump2Tweet, "url", "asService")},
                   "Initializing Pump2Tweet object");

        // Let Web stuff get to config

        app.config = config;

        // For handling errors

        app.log = function(obj) {
            if (obj instanceof Error) {
                log.error(obj);
            } else {
                log.info(obj);
            }
        };

        // updater -- keeps the world up-to-date
        // XXX: move to master process when clustering

        log.debug("Initializing updater");

        app.updater = new Updater({log: log});

        app.updater.start();

        // Start the app

        log.debug({port: config.port, address: config.address}, "Starting app listener");

        app.listen(config.port, config.address, callback);

        // Start the bouncer

        if (bounce) {
            log.debug({port: 80, address: config.address}, "Starting bounce listener");
            bounce.listen(80, config.address);
        }

    }], function(err) {
        if (err) {
            log.error(err);
        } else {
            log.info("Express server listening on port "+config.port+" for address "+config.address);
        }
});    
