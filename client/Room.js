
function Room(socket, roomId, userId) {
    if (!userId) {
        var parts = roomId.toString().split('/');
        if (2 === parts.length) {
            if (parts[0] === socket.user.id) {
                userId = parts[1];
            } else if (parts[1] === socket.user.id) {
                userId = parts[0];
            }
        }
    }
    this.joined = false;
    this.socket = socket;
    this.view = socket.view;
    this.id = roomId;
    this.userId = userId;
    this.users = {};
    this.log = [];
    this.public = {
        id: roomId
    };
    this.needOpen = false;
    this.needHighlight = false;
    this.lastTime = null;
}

Room.prototype.emit = function(evt, msg) {
    if (!msg) {
        msg = {};
    }
    if (this.userId) {
        msg.user = this.userId
    } else {
        msg.room = this.id;
    }
    this.socket.io.emit(evt, msg);
};

Room.prototype.join = function(needOpen) {
    if (this.joined) {
        if (needOpen) {
            this.view.open(this);
        }
    } else {
        var msg = {};
        if (this.lastTime) {
            msg.time = this.lastTime;
        }
        this.emit('join', msg);
        this.needOpen = needOpen;
    }
};

Room.prototype.leave = function() {
    if (this.joined) {
        this.emit('leave');
        this.joined = false;
        this.view.remove(this);
        delete this.socket.rooms[this.id];
    }
};

Room.prototype.chat = function(message) {
    this.emit('chat', {
        message: message
    });
    var msg = {
        time: + new Date(),
        user: this.socket.user,
        message: message
    };
    this.log.push(msg);
    this.view.chat(this, msg);
};

Room.prototype.peer = function() {
    this.emit('peer');
    this.socket.start(this);
};

Room.prototype.unpeer = function() {
    this.emit('unpeer');
    this.socket.stop();
};

Room.prototype.receiveOpen = function(msg) {
    if (this.joined) {
        return;
    } else {
        this.joined = true;
    }

    if (msg.room) {
        this.public = msg.room;
        this.public.id = this.id;
    } else if (msg.user) {
        this.public = msg.user;
        this.public.id = this.id;
    }

    this.view.add(this);

    var userId;
    if (msg.users) {
        for (userId in msg.users) {
            this.receiveJoin(msg.users[userId]);
        }
        for (userId in this.users) {
            if (!msg.users[userId]) {
                this.receiveLeave(userId);
            }
        }
    } else {
        for (userId in this.users) {
            this.receiveLeave(userId);
        }
    }

    if (msg.log) {
        msg.log.forEach(function(msg) {
            this.receiveChat(msg, !this.needHighlight);
        }, this);
    }

    this.needHighlight = false;

    if (this.needOpen) {
        this.view.open(this);
        this.needOpen = false;
    }
};

Room.prototype.receiveClose = function() {
    this.leave();
};

Room.prototype.receiveInvite = function() {
    this.join();
};

Room.prototype.receiveJoin = function(user) {
    if (!user.id || this.users[user.id] || user.id === this.socket.user.id) {
        return;
    }
    this.users[user.id] = user;
    this.view.join(this, user);
};

Room.prototype.receiveLeave = function(userId) {
    if (!this.users[userId]) {
        return;
    }
    this.view.leave(this, this.users[userId]);
    delete this.users[userId];
};

Room.prototype.receiveChat = function(msg, noHighlight) {
    if (this.joined) {
        if (!msg.time || !msg.user || !msg.message) {
            return;
        }
        if ('object' !== typeof msg.user) {
            if (!this.users[msg.user]) {
                return;
            }
            msg.user = this.users[msg.user];
        }
        this.log.push(msg);
        this.view.chat(this, msg, noHighlight);
        this.lastTime = msg.time;
    } else {
        this.needHighlight = true;
        this.join();
    }
};

Room.prototype.receivePeer = function(userId, token) {
    if (!this.users[userId]) {
        return;
    }
    this.view.media(this, this.users[userId]);
    if (this === this.socket.media) {
        this.socket.getPeer(null, this.id, userId, token).offer();
    }
};

Room.prototype.receiveUnpeer = function(userId) {
    if (!this.users[userId]) {
        return;
    }
    this.view.unmedia(this, this.users[userId]);
};
