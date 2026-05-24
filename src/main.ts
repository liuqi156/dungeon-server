// 使用 Deno 原生 WebSocket，完全兼容 Deno Deploy
const clients = new Map<string, WebSocket>();
const players = new Map<string, any>();

function broadcast(msg: any) {
  for (const ws of clients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }
}

function handleMessage(socketId: string, data: any) {
  const { type, text, playerName } = data;
  switch (type) {
    case "login": {
      const p = { name: playerName, gold: 200, buildings: 0 };
      players.set(socketId, p);
      // 单独通知该玩家数据
      const ws = clients.get(socketId);
      if (ws) ws.send(JSON.stringify({ type: "loginSuccess", data: p }));
      broadcast({ type: "message", msg: { type: "system", text: `${playerName} 进入了地下城` } });
      break;
    }
    case "chat": {
      const p = players.get(socketId);
      if (!p) return;
      broadcast({ type: "message", msg: { type: "chat", username: p.name, text } });
      break;
    }
    case "explore": {
      const p = players.get(socketId);
      if (!p) return;
      const earn = Math.floor(Math.random() * 80) + 20;
      p.gold += earn;
      const ws = clients.get(socketId);
      if (ws) ws.send(JSON.stringify({ type: "updatePlayer", data: p }));
      broadcast({ type: "message", msg: { type: "system", text: `${p.name} 探索地下城，获得了 ${earn} 金币！` } });
      break;
    }
    case "build": {
      const p = players.get(socketId);
      if (!p) return;
      if (p.gold < 50) {
        const ws = clients.get(socketId);
        if (ws) ws.send(JSON.stringify({ type: "error", text: "金币不足，需要50金币！" }));
        return;
      }
      p.gold -= 50;
      p.buildings += 1;
      const ws = clients.get(socketId);
      if (ws) ws.send(JSON.stringify({ type: "updatePlayer", data: p }));
      broadcast({ type: "message", msg: { type: "system", text: `${p.name} 建造了一座设施（已建造${p.buildings}座）！` } });
      break;
    }
  }
}

Deno.serve({ port: 3000 }, (req) => {
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const socketId = crypto.randomUUID();
    clients.set(socketId, socket);

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleMessage(socketId, data);
      } catch (_) { /* ignore */ }
    };

    socket.onclose = () => {
      const p = players.get(socketId);
      if (p) {
        broadcast({ type: "message", msg: { type: "system", text: `${p.name} 离开了地下城` } });
        players.delete(socketId);
      }
      clients.delete(socketId);
    };

    return response;
  }

  return new Response("地下城服务器运行中 (Deno Deploy)", { status: 200 });
});
