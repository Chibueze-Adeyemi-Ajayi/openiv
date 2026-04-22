package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;
import io.vertx.ext.web.handler.CorsHandler;

import java.util.HashSet;
import java.util.Set;

/**
 * Strict CORS. No wildcard origins, no credentials unless explicitly opted in.
 *
 * <p>If no origins are configured, CORS is disabled entirely — same-origin only. This is
 * the safest posture for an API that's only consumed from your own trusted clients via the
 * same host (or via a reverse proxy that rewrites origin).
 */
public final class Cors {

  private Cors() {}

  public static Handler<RoutingContext> create(SecurityConfig cfg) {
    if (cfg.corsAllowedOrigins().isEmpty()) {
      // No-op pass-through: no Access-Control-Allow-* headers emitted. Cross-origin requests
      // fail closed in the browser, which is exactly what we want by default.
      return RoutingContext::next;
    }

    Set<String> methods = new HashSet<>(cfg.corsAllowedMethods());
    Set<String> headers = new HashSet<>(cfg.corsAllowedHeaders());

    CorsHandler handler = CorsHandler.create()
        .allowedMethods(asHttpMethods(methods))
        .allowedHeaders(headers)
        .allowCredentials(cfg.corsAllowCredentials())
        .maxAgeSeconds(600);

    // addOrigin expects a literal origin URL. Iterating is how you allow multiple exact
    // origins; there is no API for a list. Wildcards are explicitly rejected upstream.
    for (String origin : cfg.corsAllowedOrigins()) {
      validateOrigin(origin);
      handler.addOrigin(origin);
    }

    return handler;
  }

  private static void validateOrigin(String origin) {
    if (origin == null || origin.isBlank() || origin.contains("*")) {
      throw new IllegalArgumentException("CORS origin must be an exact URL, got: " + origin);
    }
  }

  private static Set<io.vertx.core.http.HttpMethod> asHttpMethods(Set<String> names) {
    Set<io.vertx.core.http.HttpMethod> out = new HashSet<>();
    for (String n : names) {
      out.add(io.vertx.core.http.HttpMethod.valueOf(n.trim().toUpperCase()));
    }
    return out;
  }
}
