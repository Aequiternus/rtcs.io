(function($){
var RTCPeerConnection = null;
var getUserMedia = null;
var attachMediaStream = null;
var reattachMediaStream = null;
var webrtcDetectedBrowser = null;
var webrtcDetectedVersion = null;

function trace(text) {
  // This function is used for logging.
  if (text[text.length - 1] == '\n') {
    text = text.substring(0, text.length - 1);
  }
  console.log((performance.now() / 1000).toFixed(3) + ": " + text);
}

if (navigator.mozGetUserMedia) {
  console.log("This appears to be Firefox");

  webrtcDetectedBrowser = "firefox";

  webrtcDetectedVersion =
           parseInt(navigator.userAgent.match(/Firefox\/([0-9]+)\./)[1], 10);

  // The RTCPeerConnection object.
  RTCPeerConnection = mozRTCPeerConnection;

  // The RTCSessionDescription object.
  RTCSessionDescription = mozRTCSessionDescription;

  // The RTCIceCandidate object.
  RTCIceCandidate = mozRTCIceCandidate;

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.mozGetUserMedia.bind(navigator);

  // Creates iceServer from the url for FF.
  createIceServer = function(url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = { 'url': url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      if (webrtcDetectedVersion < 27) {
        // Create iceServer with turn url.
        // Ignore the transport parameter from TURN url for FF version <=27.
        var turn_url_parts = url.split("?");
        // Return null for createIceServer if transport=tcp.
        if (turn_url_parts[1].indexOf('transport=udp') === 0) {
          iceServer = { 'url': turn_url_parts[0],
                        'credential': password,
                        'username': username };
        }
      } else {
        // FF 27 and above supports transport parameters in TURN url,
        // So passing in the full url to create iceServer.
        iceServer = { 'url': url,
                      'credential': password,
                      'username': username };
      }
    }
    return iceServer;
  };

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    console.log("Attaching media stream");
    element.mozSrcObject = stream;
    element.play();
  };

  reattachMediaStream = function(to, from) {
    console.log("Reattaching media stream");
    to.mozSrcObject = from.mozSrcObject;
    to.play();
  };

  // Fake get{Video,Audio}Tracks
  if (!MediaStream.prototype.getVideoTracks) {
    MediaStream.prototype.getVideoTracks = function() {
      return [];
    };
  }

  if (!MediaStream.prototype.getAudioTracks) {
    MediaStream.prototype.getAudioTracks = function() {
      return [];
    };
  }
} else if (navigator.webkitGetUserMedia) {
  console.log("This appears to be Chrome");

  webrtcDetectedBrowser = "chrome";
  webrtcDetectedVersion =
         parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2], 10);

  // Creates iceServer from the url for Chrome.
  createIceServer = function(url, username, password) {
    var iceServer = null;
    var url_parts = url.split(':');
    if (url_parts[0].indexOf('stun') === 0) {
      // Create iceServer with stun url.
      iceServer = { 'url': url };
    } else if (url_parts[0].indexOf('turn') === 0) {
      // Chrome M28 & above uses below TURN format.
      iceServer = { 'url': url,
                    'credential': password,
                    'username': username };
    }
    return iceServer;
  };

  // The RTCPeerConnection object.
  RTCPeerConnection = webkitRTCPeerConnection;

  // Get UserMedia (only difference is the prefix).
  // Code from Adam Barth.
  getUserMedia = navigator.webkitGetUserMedia.bind(navigator);

  // Attach a media stream to an element.
  attachMediaStream = function(element, stream) {
    if (typeof element.srcObject !== 'undefined') {
      element.srcObject = stream;
    } else if (typeof element.mozSrcObject !== 'undefined') {
      element.mozSrcObject = stream;
    } else if (typeof element.src !== 'undefined') {
      element.src = URL.createObjectURL(stream);
    } else {
      console.log('Error attaching stream to element.');
    }
    element.play();
  };

  reattachMediaStream = function(to, from) {
    to.src = from.src;
    to.play();
  };
} else {
  console.log("Browser does not appear to be WebRTC-capable");
}

var options = {
    "pcConfig": {
        "iceServers": []
    },
    "pcConstraints": {
        "optional": [
            {"googImprovedWifiBwe": true},
            {"DtlsSrtpKeyAgreement": true},
            {"RtpDataChannels": true}
        ],
        "mandatory": {}
    },
    "offerConstraints": {
        "optional": [
            {"VoiceActivityDetection": false}
        ],
        "mandatory": {
            "OfferToReceiveAudio": true,
            "OfferToReceiveVideo": true
        }
    },
    "answerConstraints": {
        "optional": [],
        "mandatory": {
            "OfferToReceiveAudio": true,
            "OfferToReceiveVideo": true
        }
    },
    "localConstraints": {
        "audio": true,
        "video": {
            "optional": [],
            "mandatory": {}
        }
    },
    "authPage": null
};

function rtcsio() { // ( [ io | url ], [ opts ]  )
    var socket;
    var opts;

    var args = Array.prototype.slice.call(arguments);
    var arg = args.shift();
    if (!arg) {
        log('create default socket.io');
        socket = io();
    } else if ('string' === typeof arg) { // url
        log('create socket.io at url', arg);
        opts = args.shift();
        socket = io(arg, opts);
    } else if (arg.emit) { // io
        log('use existing socket.io');
        opts = args.shift();
        socket = arg;
    } else {
        log('create socket.io');
        opts = arg;
        socket = io(opts);
    }

    if (opts) {
        for (var name in opts) {
            options[name] = opts[name];
        }
    }

    var iceServers = options.pcConfig.iceServers;
    options.pcConfig.iceServers = [];
    for (var i = 0, l = iceServers.length; i < l; i++) {
        var iceServer = createIceServer(
            iceServers[i].url,
            iceServers[i].username,
            iceServers[i].credential
        );
        if (iceServer) {
            options.pcConfig.iceServers.push(iceServer);
        }
    }

    log('create');
    return new Socket(socket);
}

function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[rtcs.io]');
    console.log.apply(console, args);
}

function error() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[rtcs.io]');
    console.error.apply(console, args);
}

rtcsio.localStream = localStream;
rtcsio.Socket = Socket;
rtcsio.Room = Room;
rtcsio.Peer = Peer;
rtcsio.View = View;
window.rtcsio = rtcsio;


var localStream = {
    need: false,
    stream: null,
    queue: false,
    video: true,
    audio: true,
    videoEnabled: function(enabled) {
        this.video = enabled;
        if (this.stream) {
            this.tracksEnabled(this.stream.getVideoTracks(), enabled);
        }
    },
    audioEnabled: function(enabled) {
        this.audio = enabled;
        if (this.stream) {
            this.tracksEnabled(this.stream.getAudioTracks(), enabled);
        }
    },
    tracksEnabled: function(tracks, enabled) {
        for (var i = 0; i < tracks.length; i++) {
            tracks[i].enabled = enabled;
        }
    },
    start: function(callback) {
        var self = this;
        self.need = true;
        if (self.stream) {
            if (callback) {
                callback(self.stream);
            }
        } else {
            if (self.queue) {
                self.queue.push(callback);
            } else {
                self.queue = [];
                getUserMedia(options.localConstraints, function(stream) {
                    self.stream = stream;
                    if (!self.need) {
                        self.stop();
                    }
                    if (self.stream) {
                        self.videoEnabled(self.video);
                        self.audioEnabled(self.audio);
                        if (callback) {
                            callback(self.stream);
                        }
                        self.queue.forEach(function(callback) {
                            if (callback) {
                                callback(self.stream);
                            }
                        });
                    }
                    self.queue = false;
                }, function(err) {
                    log(err);
                    self.queue = false;
                });
            }
        }
    },
    stop: function() {
        this.need = false;
        if (this.stream) {
            this.stream.stop();
            this.stream = null;
        }
    }
};


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


function View(socket) {
    this.socket         = socket;
    this.localStream    = socket.localStream;
    this.main           = $('.rtcsio');
    this.box            = $('.rtcsio-box');
    this.contacts       = $('.rtcsio-contacts');
    this.peers          = $('.rtcsio-peers');
    this.logs           = $('.rtcsio-logs');
    this.rooms          = $('.rtcsio-rooms');
    this.videoBox       = $('.rtcsio-video');
    this.video          = this.videoBox.find('video').get(0);
    this.selfVideoBox   = $('.rtcsio-self');
    this.selfVideo      = this.selfVideoBox.find('video').get(0);
    this.messageForm    = $('.rtcsio-message-form');
    this.contactsForm   = $('.rtcsio-contacts-form');
    this.inputMessage   = $('.rtcsio-input-message');
    this.inputName      = $('.rtcsio-input-name');
    this.btnMenu        = $('.rtcsio-btn-menu');
    this.btnSend        = $('.rtcsio-btn-send');
    this.btnVideo       = $('.rtcsio-btn-video');
    this.btnAudio       = $('.rtcsio-btn-audio');
    this.btnMedia       = $('.rtcsio-btn-media');
    this.btnRoom        = $('.rtcsio-btn-room');
    this.btnUser        = $('.rtcsio-btn-user');
    this.btnContacts    = $('.rtcsio-btn-contacts');
    this.btnLog         = $('.rtcsio-btn-log');
    this.btnMembers     = $('.rtcsio-btn-members');
    this.tplRoom        = $('.rtcsio-tpl-room');
    this.tplUser        = $('.rtcsio-tpl-user');
    this.tplMessage     = $('.rtcsio-tpl-message');
    this.tplMember      = $('.rtcsio-tpl-member');
    this.tplPeer        = $('.rtcsio-tpl-peer');
    this.activeContact  = null;
    this.activePeer     = null;
    this.mediaContact   = null;

    var self = this;
    this.video.autoplay = true;
    this.video.volume = 0;
    this.selfVideo.autoplay = true;
    this.selfVideo.volume = 0;
    this.selfVideoBox
        .click(function() {
            reattachMediaStream(self.video, self.selfVideo);
            if (self.activePeer) {
                self.activePeer.viewPeer
                    .slideDown()
                    .fadeIn();
            }
            self.selfVideoBox
                .slideUp()
                .fadeOut();
            self.activePeer = null;
        });

    this.messageForm.submit(function() {
        if (self.activeContact) {
            var msg = self.inputMessage.val().trim();
            if (msg) {
                self.activeContact.chat(msg);
                self.inputMessage.val('');
            }
        }
        self.inputMessage.focus();
        return false;
    });

    this.btnMenu.click(function() {
        self.box.toggleClass('rtcsio-box-min');
        return false;
    });

    this.btnRoom.click(function() {
        var room = self.inputName.val().trim();
        if (room) {
            self.socket.getRoom(room).join(true);
            self.inputName.val('');
        }
        self.btnLog.click();
        self.inputMessage.focus();
        return false;
    });

    this.btnUser.click(function() {
        var user = self.inputName.val().trim();
        if (user) {
            self.socket.getUser(user).join(true);
            self.inputName.val('');
        }
        self.btnLog.click();
        self.inputMessage.focus();
        return false;
    });

    this.btnMedia.click(function() {
        self.mediaToggle();
        return false;
    });

    this.btnVideo.click(function() {
        self.videoToggle();
        return false;
    });

    this.btnAudio.click(function() {
        self.audioToggle();
        return false;
    });

    this.btnContacts.click(function() {
        self.box
            .removeClass('rtcsio-box-log')
            .removeClass('rtcsio-box-members')
            .addClass('rtcsio-box-contacts');
    });

    this.btnLog.click(function() {
        self.box
            .removeClass('rtcsio-box-contacts')
            .removeClass('rtcsio-box-members')
            .addClass('rtcsio-box-log');
    });

    this.btnMembers.click(function() {
        self.box
            .removeClass('rtcsio-box-contacts')
            .removeClass('rtcsio-box-log')
            .addClass('rtcsio-box-members');
    });
}

View.prototype.name = function(callback) {
    var name = localStorage.getItem('rtcsio.name');
    if (!name) {
        name = prompt('Enter your name');
        localStorage.setItem('rtcsio.name', name);
    }
    callback(name);
};

View.prototype.init = function() {
    this.main.fadeIn();
    this.inputMessage.focus();

    //var activeRoom = localStorage.getItem('rtcsio.room');
    //var rooms = localStorage.getItem('rtcsio.rooms');
    //if (rooms) {
    //    try {
    //        rooms = JSON.parse(rooms);
    //        if (rooms) {
    //            rooms.forEach(function(room) {
    //                this.socket.getRoom(room).join(room === activeRoom);
    //            }, this);
    //        }
    //    } catch (e) {}
    //}
    //
    //var self = this;
    //$(window).bind('unload', function() {
    //    var rooms = [];
    //    for (var id in self.socket.rooms) {
    //        var room = self.socket.rooms[id];
    //        if (room.viewContact) {
    //            if (!room.public.users || (!room.public.users[0].guest && !room.public.users[1].guest)) {
    //                rooms.push(id);
    //            }
    //        }
    //    }
    //    localStorage.setItem('rtcsio.rooms', JSON.stringify(rooms));
    //    localStorage.setItem('rtcsio.room', self.activeContact ? self.activeContact.id : null);
    //});
};

View.prototype.add = function(contact, noHighlight) {
    if (contact.viewContact) {
        return;
    }

    contact.viewContact = $('<div>')
        .hide()
        .addClass('rtcsio-contact')
        .html(this.tpl(contact.userId ? this.tplUser : this.tplRoom, contact.public))
        .appendTo(this.contacts)
        .slideDown()
        .fadeIn();

    contact.viewLog = $('<div>')
        .hide()
        .addClass('rtcsio-log')
        .appendTo(this.logs);

    contact.log.forEach(function(msg) {
        this.chat(contact, msg, noHighlight);
    }, this);

    contact.viewMembers = {};
    contact.viewRoom = $('<div>')
        .hide()
        .addClass('rtcsio-room')
        .appendTo(this.rooms);

    for (var id in contact.users) {
        this.join(contact, contact.users[id]);
    }

    var self = this;
    contact.viewContact.click(function() {
        self.open(contact);
    });

    contact.viewContact.find('.rtcsio-contact-close').click(function() {
        contact.leave();
        return false;
    });

    if (!self.activeContact) {
        self.open(contact);
    }
};

View.prototype.remove = function(contact) {
    if (contact === this.activeContact) {
        var prev = contact.viewContact.prev();
        if (prev.length) {
            prev.click();
        } else {
            contact.viewContact.next().click();
        }
    }

    if (contact.viewContact) {
        contact.viewContact
            .slideUp()
            .fadeOut(function() {
                contact.viewContact.remove();
                delete contact.viewContact;
            });
    }
    if (contact.viewLog) {
        contact.viewLog.remove();
        delete contact.viewLog;
    }
    if (contact.viewRoom) {
        contact.viewRoom.remove();
        delete contact.viewRoom;
        delete contact.viewMembers;
    }
};

View.prototype.open = function(contact) {
    this.add(contact);
    this.close();
    if (contact.viewContact) {
        contact.viewContact.removeClass('rtcsio-contact-highlight');
        contact.viewContact.addClass('rtcsio-contact-active');
    }
    if (contact.viewLog) {
        contact.viewLog.show();
    }
    if (contact.viewRoom) {
        contact.viewRoom.show();
    }
    this.activeContact = contact;

    this.btnLog.click();
};

View.prototype.close = function() {
    if (this.activeContact) {
        if (this.activeContact.viewContact) {
            this.activeContact.viewContact.removeClass('rtcsio-contact-active');
        }
        if (this.activeContact.viewLog) {
            this.activeContact.viewLog.hide();
        }
        if (this.activeContact.viewRoom) {
            this.activeContact.viewRoom.hide();
        }
        this.activeContact = null;
    }
};

View.prototype.join = function(contact, user) {
    if (contact.viewRoom && !contact.viewMembers[user.id]) {
        contact.viewMembers[user.id] = $('<div>')
            .hide()
            .addClass('rtcsio-member')
            .html(this.tpl(this.tplMember, user))
            .appendTo(contact.viewRoom)
            .slideDown()
            .fadeIn()
            .click(function() {
                contact.socket.getUser(user.id).join(true);
            });
    }
};

View.prototype.leave = function(contact, user) {
    if (contact.viewMembers && user.id && contact.viewMembers[user.id]) {
        contact.viewMembers[user.id]
            .slideUp()
            .fadeOut(function() {
                contact.viewMembers[user.id].remove();
                delete contact.viewMembers[user.id];
            });
    }
};

View.prototype.chat = function(contact, msg, noHighlight) {
    if (contact.viewContact && contact.viewLog) {
        if (this.activeContact !== contact && !noHighlight) {
            contact.viewContact.addClass('rtcsio-contact-highlight');
        }

        var canScroll = contact.viewLog.prop('scrollHeight') - contact.viewLog.height() - contact.viewLog.scrollTop() < 50;

        contact.viewLog.append(
            this.tpl(this.tplMessage, msg.user)
                .replace('{time}', this.time(msg.time))
                .replace('{message}', this.message(msg.message))
        );

        if (canScroll) {
            contact.viewLog.stop().animate({scrollTop: contact.viewLog.prop('scrollHeight') - contact.viewLog.height()}, 'fast');
        }
    }
};

View.prototype.peer = function(peer) {
    var self = this;
    peer.viewPeer = $('<div>')
        .hide()
        .addClass('rtcsio-peer')
        .click(function() {
            reattachMediaStream(self.video, peer.video);
            if (self.activePeer) {
                self.activePeer.viewPeer
                    .slideDown()
                    .fadeIn();
            } else {
                self.selfVideoBox
                    .slideDown()
                    .fadeIn();
            }
            peer.viewPeer
                .slideUp()
                .fadeOut();
            self.activePeer = peer;
        })
        .html(this.tpl(this.tplPeer, peer.user));

    peer.viewPeer.find('video').replaceWith(peer.video);

    peer.viewPeer
        .appendTo(this.peers)
        .slideDown()
        .fadeIn();

    if (!this.activePeer) {
        peer.viewPeer.click();
    }
};

View.prototype.unpeer = function(peer) {
    if (peer.viewPeer) {
        peer.viewPeer
            .slideUp()
            .fadeOut(function() {
                peer.viewPeer.remove();
                delete peer.viewPeer;
            });

        if (peer === this.activePeer) {
            this.activePeer = null;
            var hasActive = false;
            for (var id in this.socket.peers) {
                if (this.socket.peers[id].confirmed && this.socket.peers[id].viewPeer) {
                    this.socket.peers[id].viewPeer.click();
                    hasActive = true;
                    break;
                }
            }
            if (!hasActive) {
                this.selfVideoBox.click();
            }
        }
    }
};

View.prototype.media = function(contact, user) {
    if (contact.viewMembers && contact.viewMembers[user.id]) {
        contact.viewMembers[user.id].viewHasMedia = true;
        contact.viewMembers[user.id].addClass('rtcsio-member-media');
    }
    if (contact.viewContact) {
        contact.viewContact.addClass('rtcsio-contact-media');
    }
};

View.prototype.unmedia = function(contact, user) {
    if (contact.viewMembers) {
        if (contact.viewMembers[user.id]) {
            contact.viewMembers[user.id].viewHasMedia = false;
            contact.viewMembers[user.id].removeClass('rtcsio-member-media');
        }
        if (contact.viewContact) {
            var hasMedia = false;
            for (var id in contact.viewMembers) {
                if (contact.viewMembers[id].viewHasMedia) {
                    hasMedia = true;
                    break;
                }
            }
            if (!hasMedia) {
                contact.viewContact.removeClass('rtcsio-contact-media');
            }
        }
    }
};

View.prototype.start = function(contact) {
    attachMediaStream(this.selfVideo, this.socket.localStream.stream);
    this.selfVideoBox.hide().click();
    this.videoBox.fadeIn();

    if (contact.viewContact) {
        contact.viewContact.addClass('rtcsio-contact-media-active');
    }
    this.mediaContact = contact;
};

View.prototype.stop = function() {
    this.selfVideoBox
        .slideUp()
        .fadeOut();
    this.videoBox.fadeOut();

    if (this.mediaContact) {
        if (this.mediaContact.viewContact) {
            this.mediaContact.viewContact.removeClass('rtcsio-contact-media-active');
        }
        this.mediaContact = null;
    }
};

View.prototype.mediaToggle = function() {
    if (this.mediaContact) {
        this.mediaContact.unpeer();
        this.btnMedia.removeClass('rtcsio-btn-active');
        this.box.removeClass('rtcsio-box-min');
    } else if (this.activeContact) {
        this.activeContact.peer();
        this.btnMedia.addClass('rtcsio-btn-active');
        this.box.addClass('rtcsio-box-min');
    }
};

View.prototype.videoToggle = function() {
    var v = this.localStream.video;
    this.localStream.videoEnabled(!v);
    if (v) {
        this.btnVideo.removeClass('rtcsio-btn-active');
    } else {
        this.btnVideo.addClass('rtcsio-btn-active');
    }
};

View.prototype.audioToggle = function() {
    var a = this.localStream.audio;
    this.localStream.audioEnabled(!a);
    if (a) {
        this.btnAudio.removeClass('rtcsio-btn-active');
    } else {
        this.btnAudio.addClass('rtcsio-btn-active');
    }
};

View.prototype.tpl = function(tpl, obj) {
    var html = tpl.html();
    for (var i in obj) {
        html = html.replace('{' + i + '}', escapeHTML(obj[i]));
    }
    if (obj.id && !obj.name) {
        html = html.replace('{name}', escapeHTML(obj.id));
    }
    return html;
};

View.prototype.time = function(time) {
    return new Date(time).toTimeString().substr(0, 8);
};

View.prototype.message = function(message) {
    return escapeHTML(message);
};

var entityMap = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': '&quot;'
};

function escapeHTML(string) {
    return String(string).replace(/[&<>"]/g, function (s) {
        return entityMap[s];
    });
}

}(jQuery));