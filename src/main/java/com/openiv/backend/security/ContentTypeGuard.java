package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.core.http.HttpMethod;
import io.vertx.ext.web.RoutingContext;

import java.util.Set;

/**
 * Enforces {@code Content-Type: application/json} on any request that carries a body. Blocks
 * the common class of attack where a browser-origin {@code text/plain} form is used to bypass
 * CORS preflight and hit a JSON endpoint.
 */
public final class ContentTypeGuard {

  private static final Set<HttpMethod> BODY_METHODS = Set.of(
      HttpMethod.POST, HttpMethod.PUT, HttpMethod.PATCH
  );

  private ContentTypeGuard() {}

  public static Handler<RoutingContext> create() {
    return ctx -> {
      if (!BODY_METHODS.contains(ctx.request().method())) {
        ctx.next();
        return;
      }
      String contentLength = ctx.request().getHeader("Content-Length");
      boolean hasBody = ctx.request().getHeader("Transfer-Encoding") != null
          || (contentLength != null && !"0".equals(contentLength));
      if (!hasBody) {
        ctx.next();
        return;
      }
      String ct = ctx.request().getHeader("Content-Type");
      if (ct == null || !ct.toLowerCase().startsWith("application/json")) {
        ctx.response()
            .setStatusCode(415)
            .putHeader("Accept", "application/json")
            .end();
        return;
      }
      ctx.next();
    };
  }
}
