var http = require('http');
var fs = require('fs');
var crypto = require('crypto');
var users = [];
var port = 3000;
var html = fs.readFileSync(__dirname + '/html/page.html', {encoding: 'utf8'});
var css = fs.readFileSync(__dirname + '/css/styles.css', {encoding: 'utf8'});
var chatRooms = ["all", "room 1", "room 2"];
var numUsers = 0;

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
	numUsers++;
	users.push({ socket: socket, id: id, userName: 'Guest'+numUsers });
	socket.emit('welcome', { message: 'Welcome to ' + chatRooms[0] + ' Guest' + numUsers + '!', id: id, numID: numUsers, chatRoom : chatRooms[0] });

	// Automatically join a room and send list of available rooms.
	socket.room = chatRooms[0];
	socket.join(socket.room);
	socket.emit('rooms', chatRooms);

	sendUsers();

	// Attach "send" event to everyone.
	socket.on('send', function(data) {
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
	})
	// Sent when user changes rooms.
	.on('change-room', function(data) {
		// Notify users in the room that a user has left the room.
		socket.broadcast.to(socket.room).emit('leave-room', { name: data.name, colour: data.colour });

		// Changing room for user.
		socket.leave(socket.room);
		socket.join(data.room);
		socket.room = data.room;

		// Notify users in the new room that a user has joined the room.
		socket.broadcast.to(socket.room).emit('join-room', { name: data.name, colour: data.colour });
		socket.emit('receive', { userName: '', message: 'Welcome to ' + socket.room + ' ' + data.name + '!', colour: data.colour });
	})
	// Sent when a user creates a new room.
	.on('create-room', function(data) {
		// Notify all users that a new room was created.
		if(chatRooms.indexOf(data.roomName) < 0) {
			chatRooms.push(data.roomName);
			io.sockets.emit('rooms', chatRooms);
		}
	})
	// Update number of users when a disconnection occurs.
	.on('disconnect', function(data) {
		var i = users.indexOf(socket);
		var target = users.splice(i, 1);
		numUsers--;
		socket.broadcast.to(socket.room).emit('leave-room', { name: target[0].userName, colour: "red" });
		sendUsers();
	});
})
