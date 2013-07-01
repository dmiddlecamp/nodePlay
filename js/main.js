var cluster = require('cluster');
var http = require('http');
var net = require('net');
var redis = require("redis");
var moment = require("moment");

// FANCY THREAD PER CPU CORE STUFF
//http://nodejs.org/api/cluster.html#cluster_worker_process


//spin up a server


//auth or drop
//alive every 5 seconds or drop
//on redis event -> client send
//on client event -> redis send

function proxy(fn, scope) {
    return function () {
        try {
            return fn.apply(scope, arguments);
        }
        catch (ex) {
            console.log('error bubbled up ' + ex);
        }
    }
}

var config = {
    //in seconds
    aliveThreshold: 60,

    redisHostName: 'localhost',
    redisPort: 6379,

    // in ms
    clientTimerLength: 5000
};


var Device = function (parent, client) {
    this._parent = parent;
    this._client = client;
    this.init();
};
Device.prototype = {
    _parent: null,
    _client: null,
    _id: null,
    _lastAlive: null,
    _aliveTimerHandle: null,
    isAuthed: false,

    init: function () {
        this._client.on('data', proxy(this.onData, this));
        this._client.on('end', proxy(this.onEnd, this));


        this.redisClient = this.createRedisClient();

        this.redisClient.on("error", proxy(this.onRedisError, this));
        this.redisClient.on("message", proxy(this.onRedisMessage, this));
    },

    createRedisClient : function () {
        return redis.createClient(config.redisPort, config.redisHostName, {detect_buffers: false});
    },

    startAliveTimer: function (first) {
        if (!first && this._lastAlive) {
            //have I received an alive in the last xx seconds?
            //send an alive to the client
            var delta = moment().diff(this._lastAlive, 'seconds');
            if (delta > config.aliveThreshold) {
                this._destroy();
                return;
            }
        }

        try {
            if (this._client) {
                this._client.write("alive\n");
            }
        }
        catch (ex) {
            this._destroy();
            return;
        }
        this._aliveTimerHandle = setTimeout(proxy(this.startAliveTimer, this), config.clientTimerLength);
    },

    onRedisError: function (err) {
        console.log("Error " + err);
    },
    onRedisMessage: function (channel, msg) {
        if (channel != this._id) {
            //this shouldn't happen.
            return;
        }

        this._client.write(msg + '\n');
        //console.log("Message sent to socket");
    },


    _destroy: function () {
        if (!this._client) {
            console.log('double dispose');
            return;
        }

        //console.log('destroying device');
        this._client.end();
        delete this._client;
        this._client = null;

        this.redisClient.unsubscribe();
        this.redisClient.end();


        if (this._aliveTimerHandle) {
            clearTimeout(this._aliveTimerHandle);
        }
        this._aliveTimerHandle = null;

        //todo: dispose redis handle?

        //console.log('object destroyed?');
    },

    _numAuthTries: 0,
    _tryAuth: function (msg) {

        if (msg == 'secret') {
            this.isAuthed = true;
            this.askWho();
        }
        else if (this._numAuthTries < 3) {
            this._numAuthTries++;
        }
        else {
            this._destroy();
        }
    },
    askWho: function () {
        this._askedWho = true;
        this._client.write('who\n');
    },

    /**
     * Route incoming data from spark core
     * @param data
     */
    onData: function (data) {
        var msg = data.toString();
        msg = (msg) ? msg.trim() : "";

        //console.log('data received ' + msg);

        if (!this.isAuthed) {
            this._tryAuth(msg);
        }
        else if (this._askedWho && !this._id) {
            console.log('authed and asked who, message is:' + msg);
            this._id = msg;
            this._askedWho = false;

            console.log('this._id:' + this._id);

            //hand off to redis
            this.redisClient.subscribe(this._id);
            this.startAliveTimer(true);
        }
        else if (msg == "alive") {
            this._lastAlive = new Date();
        }
        else if (msg == "_goodbye") {
            this._destroy();
        }
        else {
            //send to our redis Client
            var pubClient = this.createRedisClient();
            pubClient.publish(this._id, msg);
            pubClient.end();
        }
    },
    onEnd: function () {
        this._destroy();
    }
};


var serverLoop = function (client) {
    console.log('client connected');

    try {
        var d = new Device(this, client);
    }
    catch (ex) {
        console.log('boom ' + ex);
    }
};


var server = net.createServer(serverLoop);
server.listen(8124, function () { //'listening' listener
    console.log('server bound');
});

server.on('error', function() {
    console.log("???");
});
