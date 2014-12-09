
module.exports = Peer;

var log = require('./log');

function Peer(server, socket, peerId, roomId, remoteSocketId, remotePeerId) {
    log.silly('new Peer');
    this.server = server;
    this.socket = socket;
    this.peerId = peerId;
    this.roomId = roomId;
    this.remoteSocketId = remoteSocketId;
    this.remotePeerId = remotePeerId;
    this.peerIdSent = false;
    this.queue = [];

    socket.peers[peerId] = this;
}

Peer.closeAll = function(socket) {
    log.silly('Peer.closeAll');
    if (socket.peers) {
        for (var peerId in socket.peers) {
            if (socket.peers.hasOwnProperty(peerId)) {
                socket.peers[peerId].close();
            }
        }
    }
};

Peer.prototype.setRemotePeer = function(peerId) {
    log.silly('Peer.setRemotePeer');
    this.remotePeerId = peerId;
    if (this.queue.length) {
        var msg;
        while (msg = this.queue.shift()) {
            this.emit(msg);
        }
    }
};

Peer.prototype.emit = function(msg) {
    if (msg.close) {
        this.close();
    } else {
        if (this.peerIdSent) {
            if (this.remotePeerId) {
                msg.peer = this.remotePeerId;
                log.silly('Peer.emit webrtc: %s %j', this.remoteSocketId, msg);
                this.server.io.to(this.remoteSocketId).emit('webrtc', msg);
            } else {
                this.queue.push(msg);
            }
        } else {
            var self = this;
            this.peerIdSent = true;
            var tokenData = {
                peer: this.peerId
            };
            if (this.remotePeerId) {
                msg.peer = this.remotePeerId;
            } else {
                tokenData.socket = this.socket.id;
                msg.user = this.socket.user.id;
                if (this.roomId) {
                    tokenData.room = this.roomId;
                    msg.room = this.roomId;
                }
            }
            this.server.temp.createToken(tokenData, function(err, token) {
                if (err) {
                    log.error(err);
                } else {
                    msg.token = token;
                    log.silly('Peer.emit webrtc: %s %j', self.remoteSocketId, msg);
                    self.server.io.to(self.remoteSocketId).emit('webrtc', msg);
                }
            });
        }
    }
};

Peer.prototype.close = function() {
    log.silly('Peer.close');
    if (this.remoteSocketId && this.remotePeerId) {
        this.server.io.to(this.remoteSocketId).emit('webrtc', {
            peer: this.remotePeerId,
            close: true
        });
    }
    delete this.socket.peers[this.peerId];
};
