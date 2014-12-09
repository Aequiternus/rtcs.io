
module.exports = new Log();

var levels = {
    silly: 0,
    debug: 1,
    info:  2,
    warn:  3,
    error: 4,
    silent: 5
};

function Log() {
    this.level = "info";
}

Log.prototype.log = function(level, message) {
    if (levels[level] >= levels[this.level]) {
        message = "%s [%s] " + message;
        var args = [message, new Date().toISOString(), level];
        for (var i = 2, l = arguments.length; i < l; i++) {
            if (
                levels[this.level] < 2
                && levels[level] > 2
                && arguments[i] instanceof Error
                && arguments[i].stack
            ) {
                args.push(arguments[i].stack);
            } else {
                args.push(arguments[i]);
            }
        }
        console[level === "debug" || level === "silent" || level === "silly" ? "error" : level].apply(console, args);
    }
};

for (var level in levels) {
    (function(level) {
        Log.prototype[level] = function() {
            var args = Array.prototype.slice.call(arguments);
            args.unshift(level);
            this.log.apply(this, args);
        }
    }(level));
}
