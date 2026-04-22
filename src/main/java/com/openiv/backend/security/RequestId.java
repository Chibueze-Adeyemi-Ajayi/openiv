package com.openiv.backend.security;

import io.vertx.core.Handler;
import io.vertx.ext.web.RoutingContext;
import org.slf4j.MDC;

import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Correlation ID propagation.
 *
 * <p>Honors an inbound {@code X-Request-ID} if it matches a conservative pattern (ASCII
 * alphanumerics plus {@code -_}, 8-128 chars). Anything else is replaced — we never trust an
 * arbitrary client-supplied string that ends up in logs.
 *
 * <p>The ID is placed both on the routing context ({@link #KEY}) and SLF4J MDC so any log line
 * inside the request lifecycle can be grepped by request. The response echoes it for client
 * correlation with server-side traces.
 */
public final class RequestId {

  public static final String HEADER = "X-Request-ID";
  public static final String KEY = "requestId";
  public static final String MDC_KEY = "rid";

  private static final Pattern SAFE = Pattern.compile("[A-Za-z0-9_-]{8,128}");

  private RequestId() {}

  public static Handler<RoutingContext> create() {
    return ctx -> {
      String inbound = ctx.request().getHeader(HEADER);
      String id = (inbound != null && SAFE.matcher(inbound).matches())
          ? inbound
          : UUID.randomUUID().toString();

      ctx.put(KEY, id);
      MDC.put(MDC_KEY, id);
      ctx.response().putHeader(HEADER, id);
      ctx.addEndHandler(v -> MDC.remove(MDC_KEY));
      ctx.next();
    };
  }

  public static String of(RoutingContext ctx) {
    String id = ctx.get(KEY);
    return id == null ? "-" : id;
  }
}
