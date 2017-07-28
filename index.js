var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var users = [];
var port = 3000;
var html = fs.readFileSync(__dirname + '/html/page.html', {encoding: 'utf8'});
var css = fs.readFileSync(__dirname + '/css/styles.css', {encoding: 'utf8'});

var sendUsers = function() {
	io.sockets.emit('users', users.map(function(user) {
		return { id: user.id, name: user.userName };
	}));
}

var app = http.createServer(function(req, res) {
	if(req.url === '/styles.css') {
		res.writeHead(200, {'Content-Type': 'text/css'});
		res.end(css);
	} else {
		res.writeHead(200, {'Content-Type': 'text/html'});
		res.end(html);
	}
}).listen(port, '127.0.0.1');

var setUserName = function(id, name) {
	users.forEach(function(user) {
		if(user.id === id) {
			user.userName = name;
			sendUsers();
		}
	});
}

var io = require('socket.io').listen(app);
io.sockets.on('connection', function(socket) {
	var id = crypto.randomBytes(20).toString('hex');
	users.push({ socket: socket, id: id, name: null });
	socket.emit('welcome', { message: 'Welcome!', id: id });
	sendUsers();
	// Attach "send" event to everyone.
	socket.on('send', function(data) {
		if(data.userName !== '') {
			setUserName(id, data.userName);
		}
		if(data.toUser !== '') {
			// Send to the owner and target of the message.
			users.forEach(function(user) {
				if(user.id === data.toUser || user.id === data.fromUser) {
					user.socket.emit('receive', data);
				}
			});
		} else {
			// Send message to everyone.
			io.sockets.emit('receive', data);
		}
	});
})
