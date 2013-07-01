var cluster = require('cluster');
var http = require('http');
var net = require('net');
var redis = require("redis")


// FANCY THREAD PER CPU CORE STUFF
//http://nodejs.org/api/cluster.html#cluster_worker_process


//spin up a server


//auth or drop
//alive every 5 seconds or drop
//on redis event -> client send
//on client event -> redis send

function proxy(fn, scope) {
    return function () {
        return fn.apply(scope, arguments);
    }
}


var device = function (parent, client) {
    this._parent = parent;
    this._client = client;
    this.init();
};
device.prototype = {
    _parent: null,
    _client: null,
    _id: null,
    isAuthed: false,


    init: function () {
        this._client.on('data', proxy(this.onData, this));
        this._client.on('end', proxy(this.onEnd, this));

        this.redisClient = redis.createClient();
        this.redisClient.on("error", proxy(this.onRedisError, this));
        this.redisClient.on("message", proxy(this.onRedisMessage, this));

        //TODO: init alive timer
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
        console.log("Message sent to socket");
    },


    _destroy: function () {
        this._client.end();
        delete this._client;

        this.redisClient.unsubscribe();
        this.redisClient.end();

        //todo: dispose redis handle?

        console.log('object destroyed?');
    },

    _tryAuth: function (msg) {
        if (msg == 'secret') {
            this.isAuthed = true;
            this.askWho();
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
        console.log('data received ' + msg);

        if (!this.isAuthed) {
            this._tryAuth(msg);
        }
        else if (this._askedWho && !this._id) {
            this._id = msg;
            this._askedWho = false;

            //hand off to redis
            this.redisClient.subscribe(this._id);
        }
        else {
            //send to our redis Client
            this.redisClient.publish(this._id, msg);
        }
    },
    onEnd: function () {
        console.log('socket closed');

    }
};


var serverLoop = function (client) {
    console.log('client connected');

    client.on('data', function (data) {

        client.end();
    });
    c.on('end', function () {
        console.log('server disconnected');
    });
    c.write('hello\r\n');
    c.pipe(c);
};


var server = net.createServer(serverLoop);
server.listen(8124, function () { //'listening' listener
    console.log('server bound');
});