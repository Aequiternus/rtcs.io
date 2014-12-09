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
