package com.openiv.backend.api;

import com.openiv.backend.security.RequestId;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Safe error translation. Never returns stack traces, exception messages, or internal paths
 * to the client — those go to the server log only, keyed by the correlation ID so an operator
 * can join them to what the client saw.
 */
final class ErrorHandler {

  private static final Logger log = LoggerFactory.getLogger(ErrorHandler.class);

  private ErrorHandler() {}

  static void handle(RoutingContext ctx) {
    Throwable failure = ctx.failure();
    int status = ctx.statusCode() > 0 ? ctx.statusCode() : 500;
    String correlationId = RequestId.of(ctx);

    if (status >= 500) {
      log.error("rid={} method={} path={} status={} error",
          correlationId, ctx.request().method(), ctx.request().path(), status, failure);
    } else if (status >= 400) {
      log.warn("rid={} method={} path={} status={} msg={}",
          correlationId, ctx.request().method(), ctx.request().path(), status,
          failure == null ? "-" : failure.getClass().getSimpleName());
    }

    JsonObject body = new JsonObject()
        .put("error", statusText(status))
        .put("code", status)
        .put("correlationId", correlationId);

    if (ctx.response().ended()) {
      return;
    }
    ctx.response()
        .setStatusCode(status)
        .putHeader("content-type", "application/json; charset=utf-8")
        .end(body.encode());
  }

  private static String statusText(int status) {
    return switch (status) {
      case 400 -> "bad_request";
      case 401 -> "unauthorized";
      case 403 -> "forbidden";
      case 404 -> "not_found";
      case 405 -> "method_not_allowed";
      case 409 -> "conflict";
      case 413 -> "payload_too_large";
      case 415 -> "unsupported_media_type";
      case 422 -> "unprocessable_entity";
      case 429 -> "rate_limited";
      default -> status >= 500 ? "internal_error" : "error";
    };
  }
}
