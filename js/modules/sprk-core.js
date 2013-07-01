




1 process (master)
    8 threads (listeners)

listeners
    waits http
        sends hello world


listeners
    while listen
        new device(socket, redis.new, whatever)


light listeners
    while listen
        connections.push(socket)

    on redis event:
        msg -> socket

    on socket event:
        msg -> redis

    on timer:
        'alive' -> socket


promise.then(foo...)
promise.resolve(bar)














