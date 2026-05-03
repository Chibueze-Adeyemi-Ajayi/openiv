package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.core.buffer.Buffer;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Debug interceptor: logs all requests and responses for debugging.
 * Useful for tracing API calls, payloads, and responses.
 *
 * <p>Logs:
 * <ul>
 *   <li>Incoming: method, path, query params, headers, body</li>
 *   <li>Outgoing: status code, response time, response body (first 500 chars)</li>
 * </ul>
 *
 * <p><b>Note:</b> This has performance overhead and should only be enabled in dev/staging.
 */
public final class RequestDebugLogger {
  private static final Logger log = LoggerFactory.getLogger(RequestDebugLogger.class);

  private RequestDebugLogger() {
  }

  public static Handler<RoutingContext> create() {
    return ctx -> {
      long startTime = System.currentTimeMillis();
      String method = ctx.request().method().toString();
      String path = ctx.normalizedPath();
      String query = ctx.request().query();
      String requestId = ctx.get("requestId");

      // Log incoming request
      StringBuilder reqLog = new StringBuilder();
      reqLog.append("[REQUEST] ").append(method).append(" ").append(path);
      if (query != null && !query.isEmpty()) {
        reqLog.append("?").append(query);
      }
      log.debug("{}  [{}]", reqLog, requestId);

      // Log headers (excluding auth)
      ctx.request().headers().forEach(h -> {
        if (!"authorization".equalsIgnoreCase(h.getKey()) && !"cookie".equalsIgnoreCase(h.getKey())) {
          log.debug("  Header: {} = {}", h.getKey(), h.getValue());
        }
      });

      // Log body if present
      Buffer bodyBuffer = ctx.body().buffer();
      if (bodyBuffer != null && bodyBuffer.length() > 0) {
        String body = bodyBuffer.toString();
        if (body.length() > 500) {
          log.debug("  Body: {} ... ({} bytes total)", body.substring(0, 500), body.length());
        } else {
          log.debug("  Body: {}", body);
        }
      }

      // Intercept response to log it
      ctx.response().endHandler(v -> {
        long duration = System.currentTimeMillis() - startTime;
        int finalStatus = ctx.response().getStatusCode();
        log.debug("[RESPONSE] {} {} - Status: {} - Duration: {}ms [{}]", method, path, finalStatus, duration, requestId);
      });

      ctx.next();
    };
  }
}
