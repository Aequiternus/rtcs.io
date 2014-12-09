
module.exports = Server;

var events      = require('events');
var cookie      = require('cookie');
var log         = require('./log');
var Room        = require('./Room');
var User        = require('./User');
var Peer        = require('./Peer');
var storage     = require('rtcs.io-storage');

function Server(io, options) {
    log.silly('new Server');
    this.io = io;
    this.options = options;

    this.setData(new storage.Data(options.data));
    this.setTemp(new storage.Temp(options.temp));

    var self = this;

    //self.io.httpServer.on('close', function() {
    //    self.close();
    //});

    io.use(function(socket, next) {
        log.debug('[%s] authentication', socket.id);
        self.emit('authentication', socket);
        var cookies = socket.request
            && socket.request.headers
            && socket.request.headers.cookie
            && cookie.parse(socket.request.headers.cookie);
        var sessionId = cookies && cookies[self.options.sessionCookie];
        var err;
        if (sessionId) {
            self.data.getSession(sessionId, function(err, userId) {
                if (err) {
                    log.error('[%s] getSession: %s', socket.id, err);
                } else if (userId) {
                    socket.user = new User(self, userId);
                } else {
                    err = new Error('wrong session');
                    log.debug('[%s] getSession: %s', socket.id, err);
                }
                next(err);
            });
        } else if (self.options.guestAllowed) {
            var name = cookies && cookies[self.options.guestCookie];
            if (name || self.options.guestAnonymous) {
                self.data.getGuest(cookies && cookies[self.options.guestCookie], function (err, userId) {
                    if (err) {
                        log.error('[%s] getGuest: %s', socket.id, err);
                    } else {
                        socket.user = new User(self, userId);
                    }
                    next(err);
                });
            } else {
                err = new Error('no session and anonymous not allowed');
                log.debug('[%s] authentication: %s', socket.id, err);
                next(err);
            }
        } else {
            err = new Error('no session and guests not allowed');
            log.debug('[%s] authentication: %s', socket.id, err);
            next(err);
        }
    });

    io.on('connection', function(socket) {
        fire('connection');
        socket.peers = {};
        socket.user.connect(socket);

        socket.on('disconnect', function() {
            fire('disconnect');
            if (socket.user) {
                socket.user.disconnect(socket);
            }
            Peer.closeAll(socket);
        });

        socket.on('webrtc', function(msg) {
            fire('webrtc', msg);
            getPeer(msg, function(err, peer) {
                if (err) {
                    log.error('[%s] webrtc: %s', socket.id, err);
                } else if (peer) {
                    peer.emit(msg);
                } else {
                    log.debug('[%s] webrtc: no peer', socket.id);
                }
            });
        });

        socket.on('join',   function(msg) {
            roomEvent('join',   'canJoin', msg, [socket, msg]);
        });

        socket.on('leave',  function(msg) {
            roomEvent('leave',  'canJoin', msg, [socket]);
        });

        socket.on('chat',   function(msg) {
            roomEvent('chat',   'canChat', msg, [socket, msg]);
        });

        socket.on('peer',   function(msg) {
            roomEvent('peer',   'canPeer', msg, [socket]);
        });

        socket.on('unpeer', function(msg) {
            roomEvent('unpeer', 'canPeer', msg, [socket]);
        });

        function roomEvent(evt, can, msg, args) {
            fire(evt, msg);
            if (socket.user && (msg.room || msg.user)) {
                self.data[can](socket, msg, function(err) {
                    if (err) {
                        log.error('[%s] %s: %s', socket.id, evt, err);
                    } else {
                        var room = getRoom(msg);
                        if (room) {
                            room[evt].apply(room, args);
                        } else {
                            log.debug('[%s] %s: no room', socket.id, evt);
                        }
                    }
                });
            }
        }

        function roomEvent(evt, can, msg, args) {
            fire(evt, msg);
            if (socket.user && (msg.room || msg.user)) {
                var room = getRoom(msg);
                if (room) {
                    room.check(evt, msg, function(err, data) {

                    });
                    room[evt].apply(room, args);
                } else {
                    log.debug('[%s] %s: no room', socket.id, evt);
                }
            }
        }

        function fire(evt, msg) {
            if (msg) {
                log.debug('[%s] %s: %j', socket.id, evt, msg);
                self.emit(evt, msg, socket);
            } else {
                log.debug('[%s] %s', socket.id, evt);
                self.emit(evt, socket);
            }
        }

        function getRoom(msg) {
            if (msg.room) {
                if (msg.room.match(/^[-_0-9a-z]+$/)) {
                    return new Room(self, msg.room);
                } else {
                    var uid;
                    var m = msg.room.match(/^([-_0-9a-z]+)\/([-_0-9a-z]+)$/);
                    if (m) {
                        if (m[1] === socket.user.id) {
                            uid = m[2];
                        } else if (m[2] === socket.user.id) {
                            uid = m[1];
                        }
                    }
                    if (uid) {
                        return new Room(self, msg.room, uid);
                    } else {
                        log.debug('[%s] getRoom: invalid room', socket.id);
                    }
                }
            } else if (msg.user) {
                return new Room(
                    self,
                    socket.user.id > msg.user
                        ? socket.user.id + '/' + msg.user
                        : msg.user + '/' + socket.user.id,
                    msg.user
                );
            } else {
                log.debug('[%s] getRoom: invalid message', socket.id);
            }
        }

        function getPeer(msg, callback) {
            if (msg.peer) {
                var msg_peer = msg.peer;
                delete msg.peer;
                log.silly('[%s] socket peers: %j', socket.id, Object.keys(socket.peers));
                if (socket.peers[msg_peer]) {
                    log.silly('[%s] getPeer: peer found');
                    if (msg.token) {
                        self.temp.releaseToken(msg.token, function(err, data) {
                            log.silly('[%s] releaseToken: %j', socket.id, data);
                            delete msg.token;
                            if (err) {
                                callback(err);
                            } else if (data && data.peer) {
                                socket.peers[msg_peer].setRemotePeer(data.peer);
                                callback(null, socket.peers[msg_peer]);
                            } else {
                                log.debug('[%s] getPeer: invalid token', socket.id);
                                callback(null, null);
                            }
                        });
                    } else {
                        process.nextTick(callback.bind(null, null, socket.peers[msg_peer]));
                    }
                } else if (msg.token) {
                    log.silly('[%s] getPeer: peer not found');
                    self.temp.releaseToken(msg.token, function(err, data) {
                        log.silly('[%s] releaseToken: %j', socket.id, data);
                        delete msg.token;
                        if (err) {
                            callback(err);
                        } else if (data && data.socket) {
                            callback(null, new Peer(self, socket, msg_peer, data.room, data.socket, data.peer));
                        } else {
                            log.debug('[%s] getPeer: invalid token', socket.id);
                            callback(null, null);
                        }
                    });
                } else {
                    log.debug('[%s] getPeer: no token for unknown peer', socket.id);
                    process.nextTick(callback.bind(null, null, null));
                }
            } else {
                log.debug('[%s] getPeer: invalid message', socket.id);
                process.nextTick(callback.bind(null, null, null));
            }
        }

    });
}

Server.prototype.__proto__ = events.EventEmitter.prototype;

Server.prototype.setData = function(data) {
    this.data = data;
    this.data.on('error', function(err) {
        log.error('data: %s', err);
    });
};

Server.prototype.setTemp = function(temp) {
    this.temp = temp;
    this.temp.on('error', function(err) {
        log.error('temp: %s', err);
    });
};

Server.prototype.close = function() {
    this.data.close();
    this.temp.close();
};
