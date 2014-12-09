
function Socket(io) {
    this.io = io;
    this.localStream = localStream;
    this.peers = {};
    this.peerId = 0;
    this.media = null;
    this.rooms = {};
    this.users = {};
    this.user = {};
    this.view = new View(this);

    var self = this;

    io.on('connect', function() {
        log('connect');
    });

    io.on('disconnect', function() {
        log('disconnect');
    });

    io.on('error', function(msg) {
        error(msg);
        window.location = options.authPage;
    });

    io.on('init', function(msg) {
        log('init', msg);
        if (msg.user) {
            self.user = msg.user;
            self.view.init();
            if (msg.rooms) {
                msg.rooms.forEach(function(room) {
                    self.getRoom(room).join();
                });
            }
        }
    });

    io.on('webrtc', function(msg) {
        log('webrtc', msg);
        if (
            self.media &&
            (msg.peer || (msg.token && msg.user)) &&
            (msg.descr || msg.ice || msg.confirm || msg.close)
        ) {
            var peer = self.getPeer(msg.peer, msg.room, msg.user, msg.token);
            if (peer) {
                if (msg.descr) {
                    peer.setRemoteDescription(msg.descr);
                } else if (msg.ice) {
                    peer.addIceCandidate(msg.ice)
                } else if (msg.confirm) {
                    peer.confirm();
                } else if (msg.close) {
                    peer.close();
                }
            }
        }
    });

    io.on('open', function(msg) {
        roomEvent('open', msg, [msg]);
    });

    io.on('close', function(msg) {
        roomEvent('close', msg);
    });

    io.on('invite', function(msg) {
        roomEvent('invite', msg);
    });

    io.on('join', function(msg) {
        if (msg.user) {
            roomEvent('join', msg, [msg.user]);
        }
    });

    io.on('leave', function(msg) {
        if (msg.user) {
            roomEvent('leave', msg, [msg.user]);
        }
    });

    io.on('chat', function(msg) {
        roomEvent('chat', msg, [msg]);
    });

    io.on('peer', function(msg) {
        if (msg.user && msg.token) {
            roomEvent('peer', msg, [msg.user, msg.token]);
        }
    });

    io.on('unpeer', function(msg) {
        if (msg.user) {
            roomEvent('unpeer', msg, [msg.user]);
        }
    });

    function roomEvent(evt, msg, args) {
        log(evt, msg);
        if (self.user && (msg.room || msg.user)) {
            var room = self.getRoomByMessage(msg);
            var method = 'receive' + evt.charAt(0).toUpperCase() + evt.substr(1, evt.length - 1);
            room[method].apply(room, args || []);
        }
    }
}

Socket.prototype.getRoom = function(room, userId) {
    room = 'object' === typeof room ? room.id : room;
    return this.rooms[room] || (this.rooms[room] = new Room(this, room, userId));
};

Socket.prototype.getUser = function(user) {
    user = 'object' === typeof user ? user.id : user;
    return this.getRoom(
        this.user.id > user
            ? this.user.id + '/' + user
            : user + '/' + this.user.id,
        user
    );
};

Socket.prototype.getRoomByMessage = function(msg) {
    if (msg.room) {
        return this.getRoom(msg.room);
    } else if (msg.user) {
        return this.getUser(msg.user);
    }
};

Socket.prototype.getPeer = function(id, room, user, token) {
    if (id) {
        this.peers[id].token = token;
        return this.peers[id];
    } else if (user && token) {
        id = ++this.peerId;
        return this.peers[id] = new Peer(this, id, room, user, token);
    }
};

Socket.prototype.start = function(room) {
    this.stop(true);
    this.media = room;
    var self = this;
    localStream.start(function() {
        self.view.start(room);
    });
};

Socket.prototype.stop = function(keep) {
    if (this.media) {
        this.view.stop(this.media);
        this.media = null;
        for (var id in this.peers) {
            this.peers[id].close();
        }
    }
    if (!keep) {
        localStream.stop();
    }
};
