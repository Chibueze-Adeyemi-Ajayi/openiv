package com.openiv.backend.api.dev;

import io.vertx.ext.web.Router;
import io.vertx.ext.web.RoutingContext;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Developer-only API documentation: the OpenAPI YAML spec and a Swagger UI shell that loads
 * Swagger-UI assets from unpkg (no webjar bundled). Mounted by {@link
 * com.openiv.backend.api.ApiRouter} only when {@code environment=development}.
 *
 * <p>Never mount this in production. The spec reveals every endpoint and shape; Swagger UI is
 * a fine phishing / reconnaissance aid for an attacker who reaches it.
 */
public final class DocsHandler {

  private static final String OPENAPI_RESOURCE = "/openapi.yaml";
  private static final String SWAGGER_UI_VERSION = "5.17.14";

  private DocsHandler() {}

  public static void mount(Router router) {
    router.get("/api/openapi.yaml").handler(DocsHandler::serveSpec);
    router.get("/docs").handler(DocsHandler::serveSwaggerUi);
    router.get("/docs/").handler(DocsHandler::serveSwaggerUi);
  }

  private static void serveSpec(RoutingContext ctx) {
    try (InputStream in = DocsHandler.class.getResourceAsStream(OPENAPI_RESOURCE)) {
      if (in == null) {
        ctx.response().setStatusCode(404).end();
        return;
      }
      String yaml = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      ctx.response()
          .putHeader("content-type", "application/yaml; charset=utf-8")
          // Swagger UI fetches with CORS; same-origin here so no extra headers needed.
          .end(yaml);
    } catch (IOException e) {
      ctx.fail(e);
    }
  }

  private static void serveSwaggerUi(RoutingContext ctx) {
    // Swagger UI is loaded from unpkg; the CSP set by SecurityHeaders blocks this by default,
    // so we relax CSP for /docs only.
    ctx.response().putHeader("Content-Security-Policy",
        "default-src 'self'; "
        + "script-src 'self' 'unsafe-inline' https://unpkg.com; "
        + "style-src 'self' 'unsafe-inline' https://unpkg.com; "
        + "img-src 'self' data: https:; "
        + "connect-src 'self'");
    ctx.response().putHeader("content-type", "text/html; charset=utf-8");
    ctx.response().end(html());
  }

  private static String html() {
    return "<!DOCTYPE html>\n"
        + "<html lang=\"en\"><head>\n"
        + "  <meta charset=\"UTF-8\"/>\n"
        + "  <title>OpenIV API — dev docs</title>\n"
        + "  <link rel=\"stylesheet\" href=\"https://unpkg.com/swagger-ui-dist@"
        + SWAGGER_UI_VERSION + "/swagger-ui.css\"/>\n"
        + "</head><body>\n"
        + "  <div id=\"swagger-ui\"></div>\n"
        + "  <script src=\"https://unpkg.com/swagger-ui-dist@"
        + SWAGGER_UI_VERSION + "/swagger-ui-bundle.js\"></script>\n"
        + "  <script>\n"
        + "    window.ui = SwaggerUIBundle({\n"
        + "      url: '/api/openapi.yaml',\n"
        + "      dom_id: '#swagger-ui',\n"
        + "      deepLinking: true,\n"
        + "      persistAuthorization: true\n"
        + "    });\n"
        + "  </script>\n"
        + "</body></html>\n";
  }
}
