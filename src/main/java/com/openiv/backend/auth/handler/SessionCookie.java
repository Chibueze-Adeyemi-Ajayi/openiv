package com.openiv.backend.auth.handler;

import io.vertx.core.http.Cookie;
import io.vertx.core.http.CookieSameSite;
import io.vertx.ext.web.RoutingContext;

/**
 * Session cookie helpers.
 *
 * <p>The cookie:
 * <ul>
 *   <li><b>HttpOnly</b> — inaccessible to JS; XSS cannot read it.</li>
 *   <li><b>Secure</b> in non-dev environments — only sent over TLS.</li>
 *   <li><b>SameSite=Lax</b> in dev; <b>None</b> in prod. The frontend (www.openiv.ng) and the
 *       API (api.openiv.ng) are on different subdomains, so the browser treats fetch() calls as
 *       cross-origin. SameSite=Strict would silently drop the cookie on every request; None+Secure
 *       is required for cross-subdomain credential flows. CSRF is mitigated by the CORS
 *       allowCredentials + allowedOrigins allowlist.</li>
 *   <li><b>Path=/</b> — available to the whole origin.</li>
 *   <li><b>No Domain attribute</b> — the cookie becomes host-only (api.openiv.ng only).</li>
 */
public final class SessionCookie {

  public static final String NAME = "openiv_sid";

  private SessionCookie() {}

  public static void set(RoutingContext ctx, String sessionToken, int maxAgeSeconds, boolean production) {
    Cookie c = Cookie.cookie(NAME, sessionToken)
        .setHttpOnly(true)
        .setSecure(production)
        .setPath("/")
        .setMaxAge(maxAgeSeconds)
        .setSameSite(production ? CookieSameSite.NONE : CookieSameSite.LAX);
    ctx.response().addCookie(c);
  }

  public static void clear(RoutingContext ctx, boolean production) {
    Cookie c = Cookie.cookie(NAME, "")
        .setHttpOnly(true)
        .setSecure(production)
        .setPath("/")
        .setMaxAge(0)
        .setSameSite(production ? CookieSameSite.NONE : CookieSameSite.LAX);
    ctx.response().addCookie(c);
  }

  public static String read(RoutingContext ctx) {
    Cookie c = ctx.request().getCookie(NAME);
    return c == null ? null : c.getValue();
  }
}
