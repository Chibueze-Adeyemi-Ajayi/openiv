package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.RoutingContext;

import java.util.Set;

/**
 * Rejects HTTP methods that have no place in an API surface: {@code TRACE}, {@code CONNECT},
 * and anything else outside the explicit allowlist. {@code TRACE} is a known XST vector,
 * {@code CONNECT} is for proxies only.
 */
public final class MethodGuard {

  private static final Set<HttpMethod> ALLOWED = Set.of(
      HttpMethod.GET,
      HttpMethod.HEAD,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.PATCH,
      HttpMethod.DELETE,
      HttpMethod.OPTIONS
  );

  private MethodGuard() {}

  public static Handler<RoutingContext> create() {
    return ctx -> {
      if (!ALLOWED.contains(ctx.request().method())) {
        ctx.response()
            .setStatusCode(405)
            .putHeader("Allow", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
            .end();
        return;
      }
      ctx.next();
    };
  }
}
