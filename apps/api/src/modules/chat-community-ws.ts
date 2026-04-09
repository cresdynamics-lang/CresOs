import type http from "http";
import type { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import { getUserIdsInOrg } from "./chat-community-helpers";

type WsAuthContext = {
  userId: string;
  orgId: string;
  roleKeys: string[];
  sessionId?: string;
};

type SignalMessage =
  | {
      type: "call_request";
      callId: string;
      toUserId: string;
      callType: "voice" | "video";
    }
  | {
      type: "call_accept";
      callId: string;
      toUserId: string;
    }
  | {
      type: "call_reject";
      callId: string;
      toUserId: string;
      reason?: string;
    }
  | {
      type: "call_offer";
      callId: string;
      toUserId: string;
      sdp: unknown;
    }
  | {
      type: "call_answer";
      callId: string;
      toUserId: string;
      sdp: unknown;
    }
  | {
      type: "ice_candidate";
      callId: string;
      toUserId: string;
      candidate: unknown;
    }
  | {
      type: "call_hangup";
      callId: string;
      toUserId: string;
      reason?: string;
    };

function wsSend(ws: WebSocket, payload: unknown) {
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function parseTokenFromReq(req: http.IncomingMessage): string | null {
  const url = req.url ?? "";
  const qIndex = url.indexOf("?");
  if (qIndex >= 0) {
    const query = new URLSearchParams(url.slice(qIndex + 1));
    const t = query.get("token");
    if (t) return t;
  }
  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  return null;
}

export function attachChatCommunityWs(server: http.Server, prisma: PrismaClient) {
  const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

  const wss = new WebSocketServer({ server, path: "/chat-community/ws" });

  const socketsByUserId = new Map<string, Set<WebSocket>>();
  const userIdBySocket = new Map<WebSocket, string>();

  async function setPresence(userId: string, isOnline: boolean) {
    try {
      await prisma.chatUser.update({
        where: { userId },
        data: {
          isOnline,
          status: isOnline ? "online" : "offline",
          lastSeen: new Date()
        }
      });
    } catch {
      // ignore
    }
  }

  function addSocket(userId: string, ws: WebSocket) {
    let set = socketsByUserId.get(userId);
    if (!set) {
      set = new Set();
      socketsByUserId.set(userId, set);
    }
    set.add(ws);
    userIdBySocket.set(ws, userId);
  }

  function removeSocket(ws: WebSocket) {
    const uid = userIdBySocket.get(ws);
    if (!uid) return;
    userIdBySocket.delete(ws);
    const set = socketsByUserId.get(uid);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        socketsByUserId.delete(uid);
        void setPresence(uid, false);
      }
    }
  }

  function forward(fromUserId: string, toUserId: string, msg: SignalMessage) {
    const set = socketsByUserId.get(toUserId);
    if (!set || set.size === 0) {
      const fromSockets = socketsByUserId.get(fromUserId);
      if (fromSockets) {
        for (const s of fromSockets) {
          wsSend(s, {
            type: "error",
            code: "RECIPIENT_OFFLINE",
            message: "Recipient is offline",
            callId: (msg as { callId?: string }).callId
          });
        }
      }
      return;
    }

    for (const s of set) {
      wsSend(s, { ...msg, fromUserId });
    }
  }

  wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
    const token = parseTokenFromReq(req);
    if (!token) {
      ws.close(1008, "Missing token");
      return;
    }

    let auth: WsAuthContext;
    try {
      auth = jwt.verify(token, JWT_SECRET) as WsAuthContext;
    } catch {
      ws.close(1008, "Invalid token");
      return;
    }

    // Some access tokens may not include sessionId. Prefer verifying by sessionId when present,
    // otherwise fall back to an active, non-revoked session for the user.
    let sessionUserId: string | null = null;
    if (auth.sessionId) {
      const session = await prisma.session.findUnique({ where: { id: auth.sessionId } });
      if (!session || session.revokedAt) {
        ws.close(1008, "Session revoked");
        return;
      }
      sessionUserId = session.userId;
    } else {
      const session = await prisma.session.findFirst({
        where: { userId: auth.userId, revokedAt: null },
        orderBy: { createdAt: "desc" }
      });
      if (!session) {
        ws.close(1008, "Could not verify session");
        return;
      }
      sessionUserId = session.userId;
    }

    const user = await prisma.user.findUnique({ where: { id: sessionUserId } });
    if (!user || user.status !== "active") {
      ws.close(1008, "User not active");
      return;
    }

    const userId = auth.userId;
    const orgId = auth.orgId;

    const orgUserIds = await getUserIdsInOrg(prisma, orgId);
    if (!orgUserIds.includes(userId)) {
      ws.close(1008, "Not in org");
      return;
    }

    addSocket(userId, ws);
    if ((socketsByUserId.get(userId)?.size ?? 0) === 1) {
      void setPresence(userId, true);
    }

    wsSend(ws, { type: "ready", userId });

    ws.on("message", (raw: RawData) => {
      try {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        const parsed = JSON.parse(text) as Partial<SignalMessage>;
        if (!parsed || typeof parsed !== "object") return;

        const type = parsed.type;
        const toUserId = (parsed as { toUserId?: string }).toUserId;
        const callId = (parsed as { callId?: string }).callId;
        if (!type || !toUserId || !callId) return;

        switch (type) {
          case "call_request":
          case "call_accept":
          case "call_reject":
          case "call_offer":
          case "call_answer":
          case "ice_candidate":
          case "call_hangup":
            forward(userId, toUserId, parsed as SignalMessage);
            break;
          default:
            break;
        }
      } catch {
        // ignore
      }
    });

    ws.on("close", () => removeSocket(ws));
    ws.on("error", () => removeSocket(ws));
  });

  return wss;
}
