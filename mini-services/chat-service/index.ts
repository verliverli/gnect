import { createServer } from "http";
import { Server } from "socket.io";

// ── Configuration ──────────────────────────────────────────
const PORT = 3003;
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://verliverli-gnect.hf.space",
  // Add your production Vercel domain here when deployed
];

// Link filter — block URLs in messages for security (phishing, spam, doxxing)
// Users are free to say anything — only links are blocked
const LINK_PATTERN = /https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|[a-z0-9-]+\.(com|net|org|tz|io|co|me|info|xyz|app|dev|cc|tv|ly|gl|bit|tiny|shorty|rebrand|smarturl|click|link|url|page|site|web|online|shop|store|buzz|zone|space|live|world|life|club|fun|top|one|mobi|pro|tech|design|studio|agency)\b/i;

function containsLink(text: string | undefined | null): boolean {
  if (!text) return false;
  return LINK_PATTERN.test(text);
}

// ── In-memory maps ─────────────────────────────────────────
/** userId → Set of socketIds (a user may open multiple tabs) */
const userSockets = new Map<string, Set<string>>();
/** socketId → userId */
const socketUsers = new Map<string, string>();

// ── HTTP + Socket.io server ────────────────────────────────
const httpServer = createServer((req, res) => {
  // CORS headers for HTTP endpoints
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  // POST /emit-notification — Next.js backend pushes notification to a specific user
  if (req.method === "POST" && req.url === "/emit-notification") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const data = JSON.parse(body) as NotificationPayload;
        const { userId: targetUserId, notification } = data;
        if (!targetUserId || !notification?.id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing userId or notification.id" }));
          return;
        }
        io.to(`user:${targetUserId}`).emit("notification", notification);
        console.log(`[emit-notification] user:${targetUserId} notif:${notification.id} type:${notification.type}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
      }
    });
    return;
  }

  // POST /emit-broadcast — Admin broadcast to all connected users
  if (req.method === "POST" && req.url === "/emit-broadcast") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const data = JSON.parse(body) as { notification: NotificationPayload["notification"] };
        if (!data.notification?.id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: false, error: "Missing notification.id" }));
          return;
        }
        io.emit("broadcast", data.notification);
        console.log(`[emit-broadcast] notif:${data.notification.id} type:${data.notification.type}`);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, onlineUsers: userSockets.size }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ── Types ──────────────────────────────────────────────────
interface MessagePayload {
  id: string;
  sender_id: string;
  content?: string;
  media_url?: string;
  media_type?: string;
  is_view_once: boolean;
  sent_at: string;
  reply_to_id?: string;
}

interface SendMessageData {
  chatId: string;
  message: MessagePayload;
}

interface JoinLeaveChatData {
  chatId: string;
}

interface TypingData {
  chatId: string;
  userId: string;
  nickname: string;
}

interface StopTypingData {
  chatId: string;
  userId: string;
}

interface MessageViewedData {
  chatId: string;
  messageId: string;
  viewerId: string;
}

interface ViewOnceOpenedData {
  chatId: string;
  messageId: string;
}

interface MessageUnsentData {
  chatId: string;
  messageId: string;
}

interface NotificationPayload {
  userId: string;
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data?: Record<string, unknown>;
    is_read: boolean;
    created_at: string;
  };
}

// ── Helpers ────────────────────────────────────────────────
function registerSocket(userId: string, socketId: string): void {
  socketUsers.set(socketId, userId);
  if (!userSockets.has(userId)) {
    userSockets.set(userId, new Set());
  }
  userSockets.get(userId)!.add(socketId);
}

function unregisterSocket(socketId: string): string | null {
  const userId = socketUsers.get(socketId);
  if (!userId) return null;
  socketUsers.delete(socketId);
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(userId);
    }
  }
  return userId;
}

function isUserOnline(userId: string): boolean {
  return userSockets.has(userId) && userSockets.get(userId)!.size > 0;
}

// ── Connection handler ─────────────────────────────────────
io.on("connection", (socket) => {
  // Extract userId from handshake query
  const userId = socket.handshake.query.userId as string | undefined;

  if (!userId || typeof userId !== "string" || userId.trim() === "") {
    console.log(`[reject] ${socket.id} — no userId provided`);
    socket.disconnect(true);
    return;
  }

  // Register socket mapping
  registerSocket(userId, socket.id);

  // Join personal room for push notifications (e.g. chat-updated)
  socket.join(`user:${userId}`);

  console.log(`[connect] ${socket.id} → user:${userId} (online: ${isUserOnline(userId)})`);

  // ── join-notifications ────────────────────────────────
  // Reconfirm personal room join (already joined on connect, but
  // this allows the frontend hook to explicitly request it)
  socket.on("join-notifications", (data: { userId: string }) => {
    if (!data.userId) return;
    socket.join(`user:${data.userId}`);
    console.log(`[join-notifications] user:${data.userId} socket:${socket.id}`);
  });

  // ── join-chat ──────────────────────────────────────────
  socket.on("join-chat", (data: JoinLeaveChatData) => {
    const { chatId } = data;
    if (!chatId) return;
    socket.join(`chat:${chatId}`);
    console.log(`[join-chat] user:${userId} joined chat:${chatId}`);
  });

  // ── leave-chat ─────────────────────────────────────────
  socket.on("leave-chat", (data: JoinLeaveChatData) => {
    const { chatId } = data;
    if (!chatId) return;
    socket.leave(`chat:${chatId}`);
    console.log(`[leave-chat] user:${userId} left chat:${chatId}`);
  });

  // ── send-message ───────────────────────────────────────
  socket.on("send-message", (data: SendMessageData) => {
    const { chatId, message } = data;
    if (!chatId || !message?.id) return;

    // Link filter — block URLs for security (phishing, spam, doxxing)
    // Users are free to say anything — only links are blocked
    if (containsLink(message.content)) {
      const blockedMessage = { ...message, content: "🔗 Links are not allowed" };
      socket.to(`chat:${chatId}`).emit("new-message", { chatId, message: blockedMessage });
      io.to(`chat:${chatId}`).emit("chat-updated", {
        chatId,
        preview: {
          lastMessage: "🔗 Links are not allowed",
          senderId: message.sender_id,
          sentAt: message.sent_at,
          isViewOnce: message.is_view_once,
        },
      });
      console.log(`[send-message LINK-BLOCKED] chat:${chatId} msg:${message.id} from user:${userId}`);
      return;
    }

    // Broadcast to everyone in the chat room EXCEPT sender
    socket.to(`chat:${chatId}`).emit("new-message", { chatId, message });

    // Emit chat-updated to ALL members of the chat room (including sender's other tabs)
    // This handles the personal room notification for the OTHER user
    io.to(`chat:${chatId}`).emit("chat-updated", {
      chatId,
      preview: {
        lastMessage:
          message.content ||
          (message.media_type ? `📷 ${message.media_type}` : ""),
        senderId: message.sender_id,
        sentAt: message.sent_at,
        isViewOnce: message.is_view_once,
      },
    });

    console.log(
      `[send-message] chat:${chatId} msg:${message.id} from user:${userId}`
    );
  });

  // ── typing ─────────────────────────────────────────────
  socket.on("typing", (data: TypingData) => {
    const { chatId, userId: typingUserId, nickname } = data;
    if (!chatId || !typingUserId) return;
    socket
      .to(`chat:${chatId}`)
      .emit("typing", { chatId, userId: typingUserId, nickname });
  });

  // ── stop-typing ────────────────────────────────────────
  socket.on("stop-typing", (data: StopTypingData) => {
    const { chatId, userId: typingUserId } = data;
    if (!chatId || !typingUserId) return;
    socket
      .to(`chat:${chatId}`)
      .emit("stop-typing", { chatId, userId: typingUserId });
  });

  // ── message-viewed ─────────────────────────────────────
  socket.on("message-viewed", (data: MessageViewedData) => {
    const { chatId, messageId, viewerId } = data;
    if (!chatId || !messageId) return;
    // Broadcast to the chat room so the sender knows their message was read
    io.to(`chat:${chatId}`).emit("message-viewed", {
      chatId,
      messageId,
      viewerId,
    });
    console.log(
      `[message-viewed] chat:${chatId} msg:${messageId} by user:${viewerId}`
    );
  });

  // ── view-once-opened ───────────────────────────────────
  socket.on("view-once-opened", (data: ViewOnceOpenedData) => {
    const { chatId, messageId } = data;
    if (!chatId || !messageId) return;
    // Broadcast to the chat room so sender knows it was viewed
    io.to(`chat:${chatId}`).emit("view-once-opened", { chatId, messageId });
    console.log(`[view-once-opened] chat:${chatId} msg:${messageId}`);
  });

  // ── message-unsent ─────────────────────────────────────
  socket.on("message-unsent", (data: MessageUnsentData) => {
    const { chatId, messageId } = data;
    if (!chatId || !messageId) return;
    // Broadcast to the chat room so other user's UI removes it
    io.to(`chat:${chatId}`).emit("message-unsent", { chatId, messageId });
    console.log(`[message-unsent] chat:${chatId} msg:${messageId}`);
  });

  // ── message-ghost-deleted ──────────────────────────────
  // Ghost delete only affects the deleter's view — no broadcast needed.
  // We still accept and log for debugging / UI consistency tracking.
  socket.on(
    "message-ghost-deleted",
    (data: { chatId: string; messageId: string }) => {
      console.log(
        `[message-ghost-deleted] chat:${data.chatId} msg:${data.messageId} (local only)`
      );
    }
  );

  // ── chat-deleted ────────────────────────────────────────
  // Entire chat deleted by one user — notify the other user so their UI removes it
  socket.on(
    "chat-deleted",
    (data: { chatId: string; deletedBy: string }) => {
      const { chatId, deletedBy } = data;
      if (!chatId || !deletedBy) return;
      // Broadcast to everyone in the chat room so the OTHER user's UI removes it
      io.to(`chat:${chatId}`).emit("chat-deleted", { chatId, deletedBy });
      console.log(`[chat-deleted] chat:${chatId} by user:${deletedBy}`);
    }
  );

  // ── push-notification ──────────────────────────────────
  // Server-to-server: Next.js backend pushes notification to a specific user
  socket.on("push-notification", (data: NotificationPayload) => {
    const { userId: targetUserId, notification } = data;
    if (!targetUserId || !notification?.id) return;

    // Emit to the target user's personal room
    io.to(`user:${targetUserId}`).emit("notification", notification);
    console.log(`[push-notification] user:${targetUserId} notif:${notification.id} type:${notification.type}`);
  });

  // ── broadcast-notification ─────────────────────────────
  // Server-to-server: Admin broadcast to all online users
  socket.on("broadcast-notification", (data: { notification: NotificationPayload["notification"]; targetRegion?: string }) => {
    if (!data.notification?.id) return;

    // For now, broadcast to all connected users
    // Region filtering is handled by the Next.js backend when creating DB records
    io.emit("broadcast", data.notification);
    console.log(`[broadcast-notification] notif:${data.notification.id} type:${data.notification.type}`);
  });

  // ── disconnect ─────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    const disconnectedUserId = unregisterSocket(socket.id);
    if (disconnectedUserId) {
      socket.leave(`user:${disconnectedUserId}`);
      const stillOnline = isUserOnline(disconnectedUserId);
      console.log(
        `[disconnect] user:${disconnectedUserId} socket:${socket.id} (${reason}) stillOnline:${stillOnline}`
      );
    } else {
      console.log(`[disconnect] unknown socket:${socket.id} (${reason})`);
    }
  });

  // ── error ──────────────────────────────────────────────
  socket.on("error", (err: Error) => {
    console.error(`[error] socket:${socket.id} — ${err.message}`);
  });
});

// ── Start server ───────────────────────────────────────────
httpServer.listen(PORT, () => {
  console.log(`GNECT messaging service running on port ${PORT}`);
});

// ── Graceful shutdown ──────────────────────────────────────
const shutdown = () => {
  console.log("Shutting down messaging service...");
  io.disconnectSockets(true);
  httpServer.close(() => {
    console.log("Messaging service stopped");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
