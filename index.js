var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var users = [];
var port = 3000;
var html = fs.readFileSync(__dirname + '/html/page.html', {encoding: 'utf8'});
var css = fs.readFileSync(__dirname + '/css/styles.css', {encoding: 'utf8'});
var chatRooms = ["all", "room 1"];
var numUsers = 0;

var sendUsers = function() {
	io.sockets.emit('users', users.map(function(user) {
		return { id: user.id, name: user.userName };
	}));
}

var sendRooms = function() {
	io.sockets.emit('rooms', chatRooms);
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
	numUsers++;
	users.push({ socket: socket, id: id, name: null });
	socket.emit('welcome', { message: 'Welcome to ' + chatRooms[0] + '!', id: id, numID: numUsers });

	// Automatically join a room.
	socket.room = chatRooms[0];
	socket.join(socket.room);

	sendUsers();
	sendRooms();

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
			// Send message to everyone in the room.
			io.sockets.in(socket.room).emit('receive', data);
		}
	})
	// Send everyone in the room an update message to a user's name change.
	.on('change-name', function(data) {
		socket.broadcast.to(socket.room).emit('update-name', data);
	});
})
