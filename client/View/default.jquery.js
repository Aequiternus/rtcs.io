
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
