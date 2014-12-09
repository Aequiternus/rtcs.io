
function Peer(socket, id, room, user, token) {
    this.socket = socket;
    this.view = socket.view;
    this.id = id;
    this.room = room;
    this.user = user;
    this.token = token;
    this.conn = null;
    this.isCaller = false;
    this.confirmed = false;
    this.remote = null;
    this.stream = null;
    this.localIce = [];
    this.remoteIce = [];
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.volume = 1;
}

Peer.prototype.emit = function(msg) {
    msg.peer = this.id;
    if (this.token) {
        msg.token = this.token;
        this.token = null;
    }
    this.socket.io.emit('webrtc', msg);
};

Peer.prototype.createConnection = function(callback) {
    var self = this;
    localStream.start(function(stream) {
        log('PeerConnection');
        self.conn = new RTCPeerConnection(options.pcConfig, options.pcConstraints);
        log('addStream');
        self.conn.addStream(stream);
        self.conn.onicecandidate = function(event) {
            if (event && event.candidate) {
                self.sendIceCandidate(event.candidate);
            }
        };
        self.conn.onaddstream = function(event) {
            self.stream = event.stream;
            attachMediaStream(self.video, self.stream);
            self.view.peer(self);
        };
        callback();
    });
};

Peer.prototype.offer = function() {
    this.isCaller = true;
    var self = this;
    self.createConnection(function() {
        self.conn.createOffer(function(descr) {
            log('setLocalDescription');
            self.conn.setLocalDescription(descr);
            self.emit({
                descr: descr
            });
        }, function(err) {
            log(err);
        }, options.offerConstraints);
    });
};

Peer.prototype.answer = function() {
    var self = this;
    self.createConnection(function() {
        self.setRemoteDescription();
        self.conn.createAnswer(function(descr) {
            log('setLocalDescription');
            self.conn.setLocalDescription(descr);
            self.emit({
                descr: descr
            });
        }, function(err) {
            log(err);
        }, options.answerConstraints);
    });
};

Peer.prototype.setRemoteDescription = function(descr) {
    if (descr) {
        this.remote = descr;
    }
    if (!this.conn) {
        this.answer();
    } else if (this.remote) {
        log('setRemoteDescription');
        this.conn.setRemoteDescription(new RTCSessionDescription(this.remote));
        if (this.isCaller) {
            this.confirm();
        }
    }
};

Peer.prototype.confirm = function() {
    if (this.isCaller) {
        this.emit({
            confirm: true
        });
    }
    this.confirmed = true;
    this.sendIceCandidate();
    this.addIceCandidate();
};

Peer.prototype.sendIceCandidate = function(candidate) {
    if (candidate) {
        if (this.confirmed) {
            log('sendIceCandidate');
            this.emit({
                ice: candidate
            });
        } else {
            this.localIce.push(candidate);
        }
    } else {
        if (this.confirmed) {
            for (var i = 0, l = this.localIce.length; i < l; i++) {
                log('sendIceCandidate');
                this.emit({
                    ice: this.localIce[i]
                });
            }
        }
    }
};

Peer.prototype.addIceCandidate = function(candidate) {
    if (candidate) {
        if (this.confirmed) {
            log('addIceCandidate');
            this.conn.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
            this.remoteIce.push(candidate);
        }
    } else {
        if (this.confirmed) {
            for (var i = 0, l = this.remoteIce.length; i < l; i++) {
                log('addIceCandidate');
                this.conn.addIceCandidate(new RTCIceCandidate(this.remoteIce[i]));
            }
        }
    }
};

Peer.prototype.close = function() {
    delete this.socket.peers[this.id];
    if (this.conn) {
        this.conn.close();
        this.conn = null;
        this.emit({
            close: true
        });
    }
    this.view.unpeer(this);
};
