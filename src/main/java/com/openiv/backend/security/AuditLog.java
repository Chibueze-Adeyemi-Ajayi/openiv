package com.openiv.backend.security;

import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.Instant;

/**
 * Structured audit log. Writes to the SLF4J logger named {@code AUDIT} which logback routes
 * to a separate file. Every security-relevant event passes through here.
 *
 * <p>Never log raw request/response bodies — they'll leak PAN, PII, session tokens. Log the
 * category, who, what resource, and the outcome. Hash large identifiers if they must be logged.
 */
public final class AuditLog {

  private static final Logger AUDIT = LoggerFactory.getLogger("AUDIT");

  private AuditLog() {}

  public static void authFailure(RoutingContext ctx, String reason) {
    emit("auth.failure", ctx, new JsonObject().put("reason", reason));
  }

  public static void authSuccess(RoutingContext ctx, String subject) {
    emit("auth.success", ctx, new JsonObject().put("subject", subject));
  }

  public static void rateLimited(RoutingContext ctx) {
    emit("ratelimit.exceeded", ctx, new JsonObject());
  }

  public static void forbidden(RoutingContext ctx, String scope) {
    emit("authz.forbidden", ctx, new JsonObject().put("requiredScope", scope));
  }

  public static void securityException(RoutingContext ctx, String category, String detail) {
    emit("security." + category, ctx, new JsonObject().put("detail", detail));
  }

  private static void emit(String event, RoutingContext ctx, JsonObject detail) {
    JsonObject entry = new JsonObject()
        .put("ts", Instant.now().toString())
        .put("event", event)
        .put("rid", RequestId.of(ctx))
        .put("method", ctx.request().method().name())
        .put("path", ctx.request().path())
        .put("remote", ctx.request().remoteAddress().hostAddress())
        .mergeIn(detail);
    AUDIT.info(entry.encode());
  }
}
