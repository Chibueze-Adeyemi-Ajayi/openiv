package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;

/**
 * Installs response headers that constitute the minimum bar for a hardened API surface.
 *
 * <p>Applied unconditionally to every response. Per-endpoint overrides (e.g. a different
 * Cache-Control for a public discovery endpoint) should be set by the specific handler after
 * this one runs.
 *
 * <p>The CSP is deliberately API-shaped: {@code default-src 'none'} with no script/style/image
 * sources. If any handler returns HTML it must set its own CSP (browsers enforce the first
 * CSP header they see).
 */
public final class SecurityHeaders {

  private SecurityHeaders() {}

  public static Handler<RoutingContext> create(SecurityConfig cfg) {
    final String csp = cfg.contentSecurityPolicy();
    final boolean hsts = cfg.hstsEnabled();
    final String hstsValue = "max-age=" + cfg.hstsMaxAgeSeconds() + "; includeSubDomains; preload";

    return ctx -> {
      var response = ctx.response();
      response.putHeader("X-Content-Type-Options", "nosniff");
      response.putHeader("X-Frame-Options", "DENY");
      response.putHeader("Referrer-Policy", "no-referrer");
      response.putHeader("Permissions-Policy",
          "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), "
          + "microphone=(), payment=(), usb=(), interest-cohort=()");
      response.putHeader("Cross-Origin-Opener-Policy", "same-origin");
      response.putHeader("Cross-Origin-Resource-Policy", "same-origin");
      response.putHeader("Cross-Origin-Embedder-Policy", "require-corp");
      response.putHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
      response.putHeader("Pragma", "no-cache");
      response.putHeader("Content-Security-Policy", csp);

      if (hsts) {
        response.putHeader("Strict-Transport-Security", hstsValue);
      }

      // Prevent identity disclosure.
      response.headers().remove("Server");
      response.headers().remove("X-Powered-By");

      ctx.next();
    };
  }
}
