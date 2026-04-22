package com.openiv.backend.security;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.time.Duration;
import java.util.Set;
import java.util.concurrent.atomic.LongAdder;

/**
 * Per-remote-IP fixed-window rate limiter, in-process.
 *
 * <p>This is a per-node limiter: at 3 nodes behind an LB with a 600/min limit each, a
 * client effectively has 1800/min globally. For a global cap, swap the backing map for a
 * Redis or memcached-backed counter (the {@link #tokens} shape is identical — only the
 * implementation of "increment and check" changes).
 *
 * <p>Bypass list: health/readiness probes, so LB health checks don't get throttled. Extend
 * as needed (e.g. for internal service callers identified by mTLS or a service token).
 */
public final class RateLimit {

  private static final Set<String> BYPASS = Set.of("/healthz", "/readyz");

  private final Cache<String, LongAdder> tokens;
  private final int maxPerMinute;
  private final Iterable<String> trustedProxies;

  private RateLimit(int maxPerMinute, Iterable<String> trustedProxies) {
    this.maxPerMinute = maxPerMinute;
    this.trustedProxies = trustedProxies;
    this.tokens = Caffeine.newBuilder()
        .expireAfterWrite(Duration.ofMinutes(1))
        .maximumSize(100_000)
        .build();
  }

  public static Handler<RoutingContext> create(SecurityConfig cfg) {
    RateLimit limiter = new RateLimit(cfg.rateLimitRequestsPerMinute(), cfg.trustedProxies());
    return limiter::handle;
  }

  private void handle(RoutingContext ctx) {
    if (BYPASS.contains(ctx.request().path())) {
      ctx.next();
      return;
    }
    String client = clientIp(ctx);
    LongAdder counter = tokens.get(client, k -> new LongAdder());
    counter.increment();
    long used = counter.sum();

    ctx.response().putHeader("X-RateLimit-Limit", Integer.toString(maxPerMinute));
    ctx.response().putHeader("X-RateLimit-Remaining",
        Long.toString(Math.max(0, maxPerMinute - used)));

    if (used > maxPerMinute) {
      ctx.response()
          .setStatusCode(429)
          .putHeader("Retry-After", "60")
          .putHeader("content-type", "application/json; charset=utf-8")
          .end(new JsonObject()
              .put("error", "rate_limited")
              .put("correlationId", RequestId.of(ctx))
              .encode());
      return;
    }
    ctx.next();
  }

  /**
   * Returns the client IP. If the request came via a trusted proxy, honors the
   * {@code X-Forwarded-For} leftmost entry. Otherwise ignores the header to prevent spoofing.
   */
  private String clientIp(RoutingContext ctx) {
    String remote = ctx.request().remoteAddress().hostAddress();
    for (String trusted : trustedProxies) {
      if (trusted.equals(remote)) {
        String fwd = ctx.request().getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) {
          int comma = fwd.indexOf(',');
          return (comma > 0 ? fwd.substring(0, comma) : fwd).trim();
        }
      }
    }
    return remote;
  }
}
