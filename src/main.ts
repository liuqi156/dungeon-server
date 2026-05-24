import { Application, Router } from "https://deno.land/x/oak/mod.ts";
import { Server } from "npm:socket.io";

const app = new Application();
const router = new Router();

const httpServer = Deno.serve({ port: 3000 }, async (req) => {
  const resp = await app.handle(req);
  return resp ?? new Response("Not Found", { status: 404 });
});

const io = new Server(httpServer, { cors: { origin: "*" } });
const players = new Map();

router.get("/", (ctx) => {
  ctx.response.body = "地下城服务器运行中 (Deno Deploy)";
});

io.on("connection", (socket) => {
  console.log("新连接:", socket.id);
  socket.on("login", (playerName) => {
    players.set(socket.id, { name: playerName, gold: 200, buildings: 0 });
    socket.emit("loginSuccess", players.get(socket.id));
    io.emit("message", { type: "system", text: `${playerName} 进入了地下城` });
  });
  socket.on("chat", (text) => {
    const player = players.get(socket.id);
    if (!player) return;
    io.emit("message", { type: "chat", username: player.name, text });
  });
  socket.on("explore", () => {
    const player = players.get(socket.id);
    if (!player) return;
    const earn = Math.floor(Math.random() * 80) + 20;
    player.gold += earn;
    socket.emit("updatePlayer", player);
    io.emit("message", { type: "system", text: `${player.name} 探索地下城，获得了 ${earn} 金币！` });
  });
  socket.on("build", () => {
    const player = players.get(socket.id);
    if (!player) return;
    if (player.gold < 50) {
      socket.emit("error", "金币不足，需要50金币！");
      return;
    }
    player.gold -= 50;
    player.buildings += 1;
    socket.emit("updatePlayer", player);
    io.emit("message", { type: "system", text: `${player.name} 建造了一座设施（已建造${player.buildings}座）！` });
  });
  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    if (player) {
      io.emit("message", { type: "system", text: `${player.name} 离开了地下城` });
      players.delete(socket.id);
    }
  });
});

app.use(router.routes());
app.use(router.allowedMethods());
