package com.openiv.backend.auth.handler;

import com.openiv.backend.auth.model.SessionState;
import com.openiv.backend.auth.repository.SessionRepository;
import com.openiv.backend.auth.service.AuthService;
import io.vertx.core.Handler;
import io.vertx.core.Vertx;
import io.vertx.core.http.ServerWebSocket;
import io.vertx.core.buffer.Buffer;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class WebSocketSessionHandler implements Handler<ServerWebSocket> {

  private static final Logger log = LoggerFactory.getLogger(WebSocketSessionHandler.class);
  private static final String WS_PATH = "/api/v1/ws/session";

  private final SessionRepository sessions;
  private final AuthService auth;
  private final Vertx vertx;

  public WebSocketSessionHandler(SessionRepository sessions, AuthService auth, Vertx vertx) {
    this.sessions = sessions;
    this.auth = auth;
    this.vertx = vertx;
  }

  @Override
  @SuppressWarnings("deprecation")
  public void handle(ServerWebSocket ws) {
    // 1. Validate path.
    if (!WS_PATH.equals(ws.path())) {
      ws.reject(404);
      return;
    }

    // 2. Extract the session cookie from Upgrade request headers.
    String cookieHeader = ws.headers().get("cookie");
    String token = extractSid(cookieHeader);
    if (token == null || token.isEmpty()) {
      ws.reject(401);
      return;
    }

    // 3. Resolve the session — auth.resolve() hashes the token, touches last_used_at.
    auth.resolve(token)
        .onFailure(err -> {
          log.debug("WS auth rejected: {}", err.getMessage());
          ws.reject(401);
        })
        .onSuccess(session -> {
          if (ws.isClosed()) return;

          // Only allow AUTHENTICATED sessions — not mid-flow states.
          if (session.state() != SessionState.AUTHENTICATED) {
            try { ws.reject(403); } catch (IllegalStateException ignored) {}
            return;
          }

          // 4. Accept the WebSocket upgrade now that auth is confirmed.
          try {
            ws.accept();
          } catch (IllegalStateException e) {
            return;
          }

          // 5. Generate a stable socket ID for this connection lifetime.
          String socketId = UUID.randomUUID().toString();

          // 6. Persist: socket_active = TRUE, socket_id = socketId.
          sessions.markSocketConnected(session.id(), socketId)
              .onFailure(err -> log.error("Failed to mark socket connected [sid={}]", session.id(), err));

          // 7. Send an acknowledgment frame so the frontend knows the backend received it.
          try {
            ws.writeTextMessage("{\"type\":\"session_socket_ack\"}");
          } catch (IllegalStateException ignored) {}

          // 8. Heartbeat: backend → frontend ping every 25s so NAT/proxy doesn't kill it.
          //    Must be < 30s idle timeout in HttpServerOptions.
          long pingTimer = vertx.setPeriodic(25_000, id -> {
            if (!ws.isClosed()) {
              try { ws.writePing(Buffer.buffer("ping")); } catch (IllegalStateException ignored) {}
            }
          });

          // 9. On close → mark socket dead, cancel timer.
          try {
            ws.closeHandler(v -> {
              vertx.cancelTimer(pingTimer);
              sessions.markSocketDisconnected(socketId)
                  .onFailure(err ->
                      log.error("Failed to mark socket disconnected [socketId={}]", socketId, err));
              log.debug("WS disconnected [userId={}, socketId={}]", session.userId(), socketId);
            });
          } catch (IllegalStateException e) {
            vertx.cancelTimer(pingTimer);
          }

          // 10. On exception → same cleanup path.
          try {
            ws.exceptionHandler(err -> {
              log.debug("WS error [userId={}, socketId={}]: {}", session.userId(), socketId, err.getMessage());
              vertx.cancelTimer(pingTimer);
              sessions.markSocketDisconnected(socketId)
                  .onFailure(e ->
                      log.error("Failed to mark socket disconnected after exception [socketId={}]", socketId, e));
            });
          } catch (IllegalStateException ignored) {}
        });
  }

  /**
   * Parses "Cookie: openiv_sid=abc123; other=x" → "abc123".
   * Does not use RoutingContext (not available for WebSocket upgrades).
   */
  static String extractSid(String cookieHeader) {
    if (cookieHeader == null) return null;
    for (String part : cookieHeader.split(";")) {
      String trimmed = part.strip();
      if (trimmed.startsWith(SessionCookie.NAME + "=")) {
        return trimmed.substring(SessionCookie.NAME.length() + 1).strip();
      }
    }
    return null;
  }
}
