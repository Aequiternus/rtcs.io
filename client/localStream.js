
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
