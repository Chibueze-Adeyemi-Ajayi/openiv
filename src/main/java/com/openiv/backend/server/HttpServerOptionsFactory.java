package com.openiv.backend.server;

import io.vertx.core.http.ClientAuth;
import io.vertx.core.http.Http2Settings;
import io.vertx.core.http.HttpServerOptions;
import io.vertx.core.net.JksOptions;
import io.vertx.core.net.PemKeyCertOptions;

/**
 * Tuned and hardened {@link HttpServerOptions}.
 *
 * <p>Security choices and <i>why</i>:
 * <ul>
 *   <li><b>HTTP/2 MAX_CONCURRENT_STREAMS = 128</b> — mitigates CVE-2023-44487 (rapid reset
 *       amplification). Vert.x 4.5 also caps RST frames internally; this is a belt-and-braces.</li>
 *   <li><b>Smaller header + initial line limits</b> — shrinks parse surface, reduces log
 *       bloat, and limits header-smuggling primitives.</li>
 *   <li><b>Idle timeout 30s</b> — reclaims slow/abandoned connections (slowloris mitigation).</li>
 *   <li><b>No compression at this layer</b> — compression oracle avoidance on sensitive
 *       responses (BREACH). Handle compression at the edge on static/public content only.</li>
 *   <li><b>Log activity off</b> — otherwise Netty debug dumps wire bytes.</li>
 * </ul>
 *
 * <p>Performance choices:
 * <ul>
 *   <li><b>SO_REUSEPORT</b> (Linux + native transport only) — lets the kernel balance accepts
 *       across event loops.</li>
 *   <li><b>TCP_NODELAY</b> — disable Nagle; tail latency matters.</li>
 *   <li><b>Large accept backlog</b> — absorbs connection bursts.</li>
 * </ul>
 *
 * <p>TLS: pass a non-null {@link TlsOptions} to terminate TLS at this process. Typical banking
 * deployments terminate at the load balancer (TLS 1.3, managed certs), so defaults leave TLS
 * off here. When you do terminate at the app, enable {@code mTLS} if this is a service-to-
 * service endpoint.
 */
public final class HttpServerOptionsFactory {

  /** TLS configuration. Supply either JKS keystore or PEM key+cert. Exactly one must be set. */
  public record TlsOptions(
      String jksPath,
      String jksPassword,
      String pemKeyPath,
      String pemCertPath,
      boolean requireClientAuth,
      String trustStorePath,
      String trustStorePassword
  ) {}

  private HttpServerOptionsFactory() {}

  public static HttpServerOptions forProduction(int port, String host, boolean nativeTransport) {
    return forProduction(port, host, nativeTransport, null);
  }

  public static HttpServerOptions forProduction(int port, String host, boolean nativeTransport,
      TlsOptions tls) {
    Http2Settings http2 = new Http2Settings()
        .setInitialWindowSize(1024 * 1024)
        .setMaxConcurrentStreams(128);

    HttpServerOptions opts = new HttpServerOptions()
        .setPort(port)
        .setHost(host)
        .setReuseAddress(true)
        .setTcpNoDelay(true)
        .setTcpKeepAlive(true)
        .setAcceptBacklog(8192)
        .setIdleTimeout(30)
        .setCompressionSupported(false)
        .setDecompressionSupported(false)
        .setMaxInitialLineLength(4096)
        .setMaxHeaderSize(8 * 1024)
        .setInitialSettings(http2)
        .setLogActivity(false);

    if (nativeTransport) {
      opts.setReusePort(true).setTcpFastOpen(true);
    }

    if (tls != null) {
      opts.setSsl(true).setUseAlpn(true);
      if (tls.jksPath() != null) {
        opts.setKeyCertOptions(new JksOptions()
            .setPath(tls.jksPath())
            .setPassword(tls.jksPassword()));
      } else if (tls.pemKeyPath() != null) {
        opts.setKeyCertOptions(new PemKeyCertOptions()
            .setKeyPath(tls.pemKeyPath())
            .setCertPath(tls.pemCertPath()));
      } else {
        throw new IllegalArgumentException("TLS enabled but no key material configured");
      }
      opts.addEnabledSecureTransportProtocol("TLSv1.3");
      if (tls.requireClientAuth()) {
        opts.setClientAuth(ClientAuth.REQUIRED);
        if (tls.trustStorePath() != null) {
          opts.setTrustOptions(new JksOptions()
              .setPath(tls.trustStorePath())
              .setPassword(tls.trustStorePassword()));
        }
      }
    }

    return opts;
  }
}
