
module.exports = Room;

var log  = require('./log');
var User  = require('./User');

function Room(server, id, userId) {
    log.silly('new Room');
    this.server = server;
    this.id = id;
    this.userId = userId;
    this.data = null;
    this.dataReceived = false;
}

Room.prototype.getData = function(callback) {
    log.silly('Room.getData');
    var self = this;
    if (self.dataReceived) {
        process.nextTick(callback.bind(null, null, self.data));
    } else {
        if (self.userId) {
            self.server.data.getUser(self.userId, dataReceived);
        } else {
            self.server.data.getRoom(self.id, dataReceived);
        }
        function dataReceived(err, data) {
            if (err) {
                callback(err);
            } else {
                self.data = data;
                self.dataReceived = true;
                callback(null, data);
            }
        }
    }
};

Room.prototype.allowed = function(socket, evt, msg, callback) {
    log.silly('Room.allowed');
    var self = this;
    self.getData(function(err, data) {
        if (err) {
            callback(err);
        } else if (data) {
            var allowed;
            if (data.allow) {
                if ('object' === typeof data.allow) {
                    allowed = (-1 !== data.allow.indexOf(socket.user.id));
                } else if (self.server.allow[data.allow]) {
                    allowed = self.server.allow[data.allow](socket.user, data, evt, msg);
                }
            } else {
                allowed = true;
            }
            if (allowed && data.disallow) {
                allowed = (-1 === data.disallow.indexOf(socket.user.id));
            }
            callback(null, allowed);
        } else {
            callback(null, true);
        }
    });
};

Room.prototype.join = function(socket, msg) {
    log.silly('Room.join');
    var self = this;

    if (!self.userId) {
        socket.join('room:' + self.id);
        socket.user.broadcast(socket, 'invite', {
            room: self.id
        });
    }

    self.server.temp.addUserToRoom(socket.user.id, self.id, function(err, already) {
        if (err) {
            log.error(err);
        } else {
            log.silly('Room.join: temp.addUserToRoom: %j', already);
            if (already) {
                log.debug('[%s] Room.join: already in room', socket.id);
            } else {
                self.server.data.getUser(socket.user.id, function(err, data) {
                    if (err) {
                        log.error(err);
                    } else {
                        log.silly('Room.join: data.getUser: %j', data);
                        data = data.public;
                        data.id = socket.user.id;
                        self.broadcast(socket, 'join', {
                            user: data
                        });
                    }
                });
            }
        }
    });

    var res = {};
    var pending = 3;

    if (self.userId) {
        self.server.data.getUser(self.userId, function(err, data) {
            if (err) {
                done(err);
            } else {
                log.silly('Room.join: data.getUser: %j', data);
                if (data) {
                    res.user = (data && data.public) || {};
                    res.user.id = self.userId;
                    done();
                } else {
                    log.debug('[%s] Room.join: no user data for %s', socket.id, self.userId);
                }
            }
        });
    } else {
        self.server.data.getRoom(self.id, function(err, data) {
            if (err) {
                done(err);
            } else {
                log.silly('Room.join: data.getRoom: %j', data);
                res.room = (data && data.public) || {};
                res.room.id = self.id;
                done();
            }
        });
    }

    self.server.temp.getRoomUsers(self.id, function(err, userIds) {
        if (err) {
            done(err);
        } else {
            log.silly('Room.join: temp.getRoomUsers: %j', userIds);
            self.server.data.getUsers(userIds, function(err, users) {
                if (err) {
                    done(err);
                } else {
                    log.silly('Room.join: data.getUsers: %j', users);
                    if (users) {
                        res.users = {};
                        for (var userId in users) {
                            if (users.hasOwnProperty(userId)) {
                                res.users[userId] = (users[userId] && users[userId].public) || {};
                                res.users[userId].id = userId;
                            }
                        }
                    }
                    done();
                }
            })
        }
    });

    self.server.data.getLog(self.id, msg && msg.time, function(err, msglog) {
        if (err) {
            done(err);
        } else {
            log.silly('Room.join: data.getLog: %j', msglog);
            if (msglog) {
                res.log = msglog;
            }
            done();
        }
    });

    function done(err) {
        if (err) {
            log.error(err);
        } else if (!--pending) {
            log.silly('[%s] Room.join: open: %j', socket.id, res);
            socket.emit('open', res);
        }
    }
};

Room.prototype.leave = function(socket, disconnect) {
    log.silly('Room.leave');
    var self = this;

    if (!disconnect && !self.userId) {
        socket.leave('room:' + self.id);
        socket.user.broadcast(socket, 'close', {
            room: self.id
        });
    }

    self.server.temp.removeUserFromRoom(socket.user.id, self.id, function(err, already, has) {
        if (err) {
            log.error(err);
        } else if (already) {
            log.debug('[%s] Room.leave: already not in room', socket.id);
        } else {
            if (has) {
                self.broadcast(socket, 'leave', {
                    user: socket.user.id
                });
            } else {
                log.debug('[%s] Room.leave: has no users', socket.id);
            }
        }
    });
};

Room.prototype.chat = function(socket, msg) {
    log.silly('Room.chat');
    var self = this;
    var time = + new Date();
    self.server.data.addLog(self.id, {
        time: time,
        user: socket.user.public,
        message: msg.message
    }, function(err) {
        if (err) {
            log.error(err);
        } else {
            self.broadcast(socket, 'chat', {
                time: time,
                user: socket.user.id,
                message: msg.message
            });
        }
    });
};

Room.prototype.peer = function(socket) {
    log.silly('Room.peer');
    var self = this;
    var tokenData = {
        socket: socket.id
    };
    if (!this.userId) {
        tokenData.room = this.id;
    }
    this.server.temp.createToken(tokenData, function(err, token) {
        if (err) {
            log.error(err);
        } else {
            self.broadcast(socket, 'peer', {
                user: socket.user.id,
                token: token
            });
        }
    });
};

Room.prototype.unpeer = function(socket) {
    log.silly('Room.unpeer');
    this.broadcast(socket, 'unpeer', {
        user: socket.user.id
    });
};

Room.prototype.broadcast = function(socket, evt, msg) {
    if (this.userId) {
        socket.user.broadcast(socket, evt, msg);
        if (this.userId !== socket.user.id) {
            new User(this.server, this.userId).emit(evt, msg);
        }
    } else {
        if (!msg.room) {
            msg.room = this.id;
        }
        log.silly('Room.broadcast %s: %s %j', evt, socket.id, msg);
        socket.to('room:' + this.id).emit(evt, msg);
    }
};
