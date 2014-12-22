
var socketIO    = require('socket.io');
var log         = require('./log');
var Server      = require('./Server');
var Room        = require('./Room');
var User        = require('./User');
var Peer        = require('./Peer');

module.exports.createServer = createServer;
module.exports.log          = log;
module.exports.Server       = Server;
module.exports.Room         = Room;
module.exports.User         = User;
module.exports.Peer         = Peer;

function createServer() { // ( [ io | port | server ], [ options ] )
    var options = {
        "logLevel":         "info", // silly, debug, info, warn, error, silent
        "sessionCookie":    "sid",
        "guestAllowed":     true,
        "guestAnonymous":   false,
        "guestCookie":      "rtcs.io-guest"
    };

    var opts;
    var io;
    var createType;

    var args = Array.prototype.slice.call(arguments);
    var arg = args.shift();
    if (!arg) {
        createType = 1;
        io = socketIO();
    } else if (arg instanceof socketIO) { // Socket.IO Server
        createType = 2;
        opts = args.shift();
        io = arg;
    } else if ('number' === typeof arg) { // Port
        createType = 3;
        opts = args.shift();
        io = socketIO(arg, opts);
    } else if (arg.listen) { // HTTP(S) Server
        createType = 4;
        opts = args.shift();
        io = socketIO(arg, opts);
    } else {
        createType = 5;
        opts = arg;
        io = socketIO(opts);
    }

    if (opts) {
        for (var name in opts) {
            if (opts.hasOwnProperty(name)) {
                if ('object' === typeof opts[name] && 'object' === typeof options[name]) {
                    for (var subname in opts[name]) {
                        if (opts[name].hasOwnProperty(subname)) {
                            options[name][subname] = opts[name][subname];
                        }
                    }
                } else {
                    options[name] = opts[name];
                }
            }
        }
    }

    log.level = options.logLevel;

    switch (createType) {
        case 1: log.debug('create default socket.io'); break;
        case 2: log.debug('use existing socket.io server'); break;
        case 3: log.debug('create socket.io at port %s', arg); break;
        case 4: log.debug('create socket.io with http(s) server'); break;
        case 5: log.debug('create socket.io'); break;
    }

    return new Server(io, options);
}
