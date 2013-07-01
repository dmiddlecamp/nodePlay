


//create client
//auth, id, mesage, alive timer

function proxy(fn, scope) {
    return function () {
        return fn.apply(scope, arguments);
    }
}


var TalkativeSpark = function(id, msg, client) {
    this._id = id;
    this._msg = msg;
    this._client = client;
};
TalkativeSpark.prototype = {
    isAuthed: false,
    isIdentified: false,

    init: function() {
        this._client.on('data', proxy(this.onData, this));
        this._client.on('end', proxy(this.onEnd, this));

        this.handshake();
    },

    handshake: function() {
        this.isIdentified = this.isAuthed = false;
        this._client.write('secret\n');
    },


    onData: function(data) {
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
    },
    onEnd: function() {
        this._destroy();
    },


    _destroy: function() {
        if (!this._client) {
            console.log('double dispose');
            return;
        }

        console.log('destroying device');
        this._client.end();
        delete this._client;
        this._client = null;

    },

    startTimer: function() {
        client.write('alive\n');

        this._aliveTimerHandle = setTimeout(proxy(this.startTimer, this), config.clientTimerLength);
    }
};



var net = require('net');
var client = net.connect({port: 8124},
    function() { //'connect' listener
  console.log('client connected');
  client.write('world!\r\n');
});
client.on('data', function(data) {
  console.log(data.toString());
  client.end();
});
client.on('end', function() {
  console.log('client disconnected');
});