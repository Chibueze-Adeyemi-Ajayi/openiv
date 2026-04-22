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
 *   <li><b>SameSite=Lax</b> in dev (so Vite on :5173 can talk to the API on :8080 — same-site
 *       by cookie rules, different port doesn't matter), <b>Strict</b> in prod.</li>
 *   <li><b>Path=/</b> — available to the whole origin.</li>
 *   <li><b>No Domain attribute</b> — the cookie becomes host-only, which is the narrowest
 *       scope and avoids accidental delivery to subdomains.</li>
 * </ul>
 *
 * <p>CSRF posture: SameSite=Lax blocks cross-site POSTs; SameSite=Strict goes further. For
 * tier-1 banking we still want an additional Origin/Referer check on state-changing requests,
 * which the request arrives with automatically for fetch() — handlers can inspect it if needed.
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
        .setSameSite(production ? CookieSameSite.STRICT : CookieSameSite.LAX);
    ctx.response().addCookie(c);
  }

  public static void clear(RoutingContext ctx, boolean production) {
    Cookie c = Cookie.cookie(NAME, "")
        .setHttpOnly(true)
        .setSecure(production)
        .setPath("/")
        .setMaxAge(0)
        .setSameSite(production ? CookieSameSite.STRICT : CookieSameSite.LAX);
    ctx.response().addCookie(c);
  }

  public static String read(RoutingContext ctx) {
    Cookie c = ctx.request().getCookie(NAME);
    return c == null ? null : c.getValue();
  }
}
