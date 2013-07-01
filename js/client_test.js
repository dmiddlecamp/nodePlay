var net = require('net');


//create client
//auth, id, mesage, alive timer

function proxy(fn, scope) {
    return function () {
        return fn.apply(scope, arguments);
    }
}


var TalkativeSpark = function (id, msg, client) {
    this._id = id;
    this._msg = msg;

    var that = this;
    this._client = net.connect({port: 8124}, function (client) {
        that.init();
    });
};
TalkativeSpark.prototype = {
    isAuthed: false,
    isIdentified: false,

    init: function () {
        if (!this._client) {
            console.log("error no client connection!");
        }

        this._client.on('data', proxy(this.onData, this));
        this._client.on('end', proxy(this.onEnd, this));

        this.handshake();
    },

    handshake: function () {
        this.isIdentified = this.isAuthed = false;
        this._client.write('secret\n');
    },


    onData: function (data) {
        var msg = data.toString();
        msg = (msg) ? msg.trim() : "";

        if (!this.isAuthed && msg == "who") {
            this.isAuthed = true;
            this._client.write(this._id + '\n');
        }
        else if (!this.isIdentified && msg == "alive") {
            this.isIdentified = true;
            this.startTimer();
        }
        else {
            console.log('received: ' + msg);
        }
    },
    onEnd: function () {
        this._destroy();
    },


    _destroy: function () {
        if (!this._client) {
            console.log('double dispose');
            return;
        }

        console.log('destroying device');
        this._client.end();
        delete this._client;
        this._client = null;

    },

    startTimer: function () {
        console.log('client sending alive');
        this._client.write('alive\n');

        this._client.write(this._msg + '\n');

        this._aliveTimerHandle = setTimeout(proxy(this.startTimer, this), 7500);
    }
};

for (var i = 0; i < 1000; i++) {

    var spark = new TalkativeSpark("test" + i, "hello world");


}


