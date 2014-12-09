
module.exports = User;

var log = require('./log');
var Room = require('./Room');

function User(server, id) {
    log.silly('new User');
    this.server = server;
    this.id = id;
    this.public = {
        id: id
    };
}

User.prototype.connect = function(socket) {
    log.silly('User.connect');
    var self = this;

    socket.join('user:' + self.id);

    var res = {};
    var pending = 3;

    self.server.temp.addSocket(socket.id, self.id, done);
    self.server.data.getUser(self.id, function(err, data) {
        if (!err) {
            if (data.rooms && !res.rooms) {
                res.rooms = data.rooms;
            }
            data = (data && data.public) || {};
            data.id = self.id;
            res.user = data;
            self.public = data;
        }
        done(err);
    });
    self.server.temp.getUserRooms(self.id, function(err, rooms) {
        if (!err) {
            if (rooms) {
                res.rooms = rooms;
            }
        }
        done(err);
    });

    function done(err) {
        if (err) {
            log.error(err);
        } else if (!--pending) {
            socket.emit('init', res);
        }
    }
};

User.prototype.disconnect = function(socket) {
    log.silly('User.disconnect');
    var self = this;
    self.server.temp.removeSocket(socket.id, self.id, function(err, has) {
        if (err) {
            log.error(err);
        } else if (!has) {
            self.server.temp.getUserRooms(self.id, function(err, rooms) {
                if (err) {
                    log.error(err);
                } else {
                    if (rooms) {
                        rooms.forEach(function(room) {
                            new Room(self.server, room).leave(socket, true);
                        });
                    }
                }
            });
            self.server.data.removeGuest(self.id, function(err) {
                if (err) {
                    log.error(err);
                }
            });
        }
    });
};

User.prototype.emit = function(evt, msg) {
    log.silly('User.emit %s: %j', evt, msg);
    return this.server.io.to('user:' + this.id).emit(evt, msg);
};

User.prototype.broadcast = function(socket, evt, msg) {
    log.silly('User.broadcast %s: %s %j', evt, socket.id, msg);
    return socket.to('user:' + this.id).emit(evt, msg);
};
