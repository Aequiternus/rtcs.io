
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

    var args = Array.prototype.slice.call(arguments);
    var arg = args.shift();
    if (!arg) {
        log.debug('create default socket.io');
        io = socketIO();
    } else if (arg instanceof socketIO) { // Socket.IO Server
        log.debug('use existing socket.io server');
        opts = args.shift();
        io = arg;
    } else if ('number' === typeof arg) { // Port
        log.debug('create socket.io at port %s', arg);
        opts = args.shift();
        io = socketIO(arg, opts);
    } else if (arg.listen) { // HTTP(S) Server
        log.debug('create socket.io with http(s) server');
        opts = args.shift();
        io = socketIO(arg, opts);
    } else {
        log.debug('create socket.io');
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

    log.debug('create rtcs.io server');
    return new Server(io, options);
}
