const jwt = require('jsonwebtoken');
const User = require('../models/User');

function initSocket(io) {
  // Authenticate socket connections using the JWT from the client
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`Socket connected: ${user.name} (${socket.id})`);

    // Personal room for direct notifications
    socket.join(`user:${user._id}`);

    // Mark user online and broadcast
    await User.findByIdAndUpdate(user._id, { online: true, lastSeen: new Date() });
    io.emit('userOnline', { userId: user._id, name: user.name });

    socket.on('joinProject', (projectId) => {
      socket.join(`project:${projectId}`);
      socket.to(`project:${projectId}`).emit('userJoinedProject', { userId: user._id, name: user.name });
    });

    socket.on('leaveProject', (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    // Real-time team chat
    socket.on('sendMessage', ({ projectId, message }) => {
      const payload = {
        userId: user._id,
        name: user.name,
        avatar: user.avatar,
        message,
        timestamp: new Date(),
      };
      io.to(`project:${projectId}`).emit('messageReceived', payload);
    });

    socket.on('typing', ({ projectId, isTyping }) => {
      socket.to(`project:${projectId}`).emit('userTyping', { userId: user._id, name: user.name, isTyping });
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${user.name}`);
      await User.findByIdAndUpdate(user._id, { online: false, lastSeen: new Date() });
      io.emit('userOffline', { userId: user._id, name: user.name });
    });
  });
}

module.exports = initSocket;
