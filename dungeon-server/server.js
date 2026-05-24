const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' } // 允许所有来源，生产环境可限制
});

// 游戏状态存储（内存中，重启会丢失，适合演示）
const players = {}; // { socketId: { name, gold, buildings } }

// 静态文件服务（可选）
app.get('/', (req, res) => res.send('地下城服务器运行中'));

io.on('connection', (socket) => {
  console.log('新连接:', socket.id);

  // 玩家登录/注册
  socket.on('login', (playerName) => {
    // 初始化玩家数据，如果之前已存在则保留
    if (!players[socket.id]) {
      players[socket.id] = {
        name: playerName,
        gold: 200,
        buildings: 0
      };
    }
    // 通知该玩家登录成功，返回当前数据
    socket.emit('loginSuccess', players[socket.id]);
    // 广播系统消息
    io.emit('message', {
      type: 'system',
      text: `${playerName} 进入了地下城`
    });
  });

  // 聊天消息
  socket.on('chat', (text) => {
    const player = players[socket.id];
    if (!player) return;
    io.emit('message', {
      type: 'chat',
      username: player.name,
      text
    });
  });

  // 探索
  socket.on('explore', () => {
    const player = players[socket.id];
    if (!player) return;
    const earn = Math.floor(Math.random() * 80) + 20;
    player.gold += earn;
    socket.emit('updatePlayer', player);
    io.emit('message', {
      type: 'system',
      text: `${player.name} 探索地下城，获得了 ${earn} 金币！`
    });
  });

  // 建造
  socket.on('build', () => {
    const player = players[socket.id];
    if (!player) return;
    if (player.gold < 50) {
      socket.emit('error', '金币不足，需要50金币！');
      return;
    }
    player.gold -= 50;
    player.buildings += 1;
    socket.emit('updatePlayer', player);
    io.emit('message', {
      type: 'system',
      text: `${player.name} 建造了一座设施（已建造${player.buildings}座）！`
    });
  });

  // 断开连接
  socket.on('disconnect', () => {
    const player = players[socket.id];
    if (player) {
      io.emit('message', {
        type: 'system',
        text: `${player.name} 离开了地下城`
      });
      delete players[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`地下城服务器运行在端口 ${PORT}`);
});