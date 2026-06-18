package com.openiv.backend.eureka;

import com.openiv.backend.auth.handler.SessionAuthHandler;
import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.model.User;
import com.openiv.backend.auth.repository.InstitutionRepository;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Handler;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.ext.web.RoutingContext;

import java.util.ArrayList;
import java.util.List;

public final class EurekaHandler {

    private final EurekaService         service;
    private final UserRepository        users;
    private final InstitutionRepository institutions;

    public EurekaHandler(EurekaService service,
                         UserRepository users,
                         InstitutionRepository institutions) {
        this.service      = service;
        this.users        = users;
        this.institutions = institutions;
    }

    /** POST /api/v1/chat/eureka */
    public Handler<RoutingContext> chat() {
        return ctx -> {
            Session session = SessionAuthHandler.require(ctx);

            JsonObject body;
            try {
                body = ctx.body().asJsonObject();
                if (body == null) throw new IllegalArgumentException("missing body");
            } catch (Exception e) {
                badRequest(ctx, "Invalid JSON body");
                return;
            }

            // Extract and validate user message
            String userMessage = body.getString("userMessage", "").trim();
            String rejection   = EurekaService.validateInput(userMessage);
            if (rejection != null) {
                // If it's an injection attempt, still respond (politely) rather than 400
                boolean isInjection = rejection.contains("cannot be overridden");
                if (isInjection) {
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "application/json")
                        .end(new JsonObject().put("reply", rejection).encode());
                    return;
                }
                badRequest(ctx, rejection);
                return;
            }

            // Conversation history
            List<JsonObject> history = new ArrayList<>();
            JsonArray historyArr = body.getJsonArray("history", new JsonArray());
            for (int i = 0; i < Math.min(historyArr.size(), 20); i++) {
                JsonObject msg = historyArr.getJsonObject(i);
                if (msg != null) {
                    String role    = msg.getString("role", "");
                    String content = msg.getString("content", "");
                    if (("user".equals(role) || "assistant".equals(role)) && !content.isBlank()) {
                        // Sanitize history content
                        history.add(new JsonObject()
                            .put("role",    role)
                            .put("content", content.substring(0, Math.min(content.length(), 2000))));
                    }
                }
            }

            // Page context
            String pageContext = body.getString("pageContext", "/dashboard");
            if (pageContext.length() > 200) pageContext = pageContext.substring(0, 200);

            // Document content (optional)
            String documentContent = body.getString("documentContent", null);
            if (documentContent != null) {
                String docRejection = EurekaService.validateDocument(documentContent);
                if (docRejection != null) {
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "application/json")
                        .end(new JsonObject().put("reply", docRejection).encode());
                    return;
                }
                if (documentContent.length() > 16000) {
                    documentContent = documentContent.substring(0, 16000);
                }
            }

            final String finalPageContext    = pageContext;
            final String finalDocContent     = documentContent;
            final List<JsonObject> finalHist = history;

            users.findById(session.userId())
                .compose(uOpt -> {
                    User u = uOpt.orElseThrow(() -> new RuntimeException("session invalid"));
                    return institutions.findById(u.institutionId())
                        .compose(instOpt -> {
                            String name = instOpt.map(inst -> inst.name()).orElse("Unknown Institution");
                            return service.chat(
                                u.institutionId(), name,
                                finalHist, userMessage,
                                finalPageContext, finalDocContent
                            );
                        });
                })
                .onSuccess(result -> {
                    JsonObject resp = new JsonObject().put("reply", result.reply());
                    if (result.navigate() != null) resp.put("navigate", result.navigate());
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "application/json")
                        .end(resp.encode());
                })
                .onFailure(e -> {
                    System.err.println("[Eureka] chat error: " + e.getMessage());
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "application/json")
                        .end(new JsonObject()
                            .put("reply", "I encountered an error while processing your request. Please try again in a moment.")
                            .encode());
                });
        };
    }

    /** POST /api/v1/chat/eureka/stream — SSE stream of tool events + final reply */
    public Handler<RoutingContext> streamChat() {
        return ctx -> {
            Session session = SessionAuthHandler.require(ctx);

            JsonObject body;
            try {
                body = ctx.body().asJsonObject();
                if (body == null) throw new IllegalArgumentException("missing body");
            } catch (Exception e) {
                ctx.response().setStatusCode(400)
                    .putHeader("Content-Type", "application/json")
                    .end(new JsonObject().put("error", "Invalid JSON body").encode());
                return;
            }

            String userMessage = body.getString("userMessage", "").trim();
            String rejection   = EurekaService.validateInput(userMessage);
            if (rejection != null) {
                boolean isInjection = rejection.contains("cannot be overridden");
                if (isInjection) {
                    // Still respond with SSE format so frontend can handle it
                    String doneJson = new JsonObject()
                        .put("type", "done").put("reply", rejection).encode();
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "text/event-stream; charset=utf-8")
                        .putHeader("Cache-Control", "no-cache")
                        .putHeader("X-Accel-Buffering", "no")
                        .setChunked(true)
                        .write("data: " + doneJson + "\n\n")
                        .onComplete(v -> ctx.response().end());
                    return;
                }
                ctx.response().setStatusCode(400)
                    .putHeader("Content-Type", "application/json")
                    .end(new JsonObject().put("error", rejection).encode());
                return;
            }

            List<JsonObject> history = new ArrayList<>();
            JsonArray historyArr = body.getJsonArray("history", new JsonArray());
            for (int i = 0; i < Math.min(historyArr.size(), 20); i++) {
                JsonObject msg = historyArr.getJsonObject(i);
                if (msg != null) {
                    String role    = msg.getString("role", "");
                    String content = msg.getString("content", "");
                    if (("user".equals(role) || "assistant".equals(role)) && !content.isBlank()) {
                        history.add(new JsonObject()
                            .put("role", role)
                            .put("content", content.substring(0, Math.min(content.length(), 2000))));
                    }
                }
            }

            String pageContext = body.getString("pageContext", "/dashboard");
            if (pageContext.length() > 200) pageContext = pageContext.substring(0, 200);

            String documentContent = body.getString("documentContent", null);
            if (documentContent != null) {
                String docRejection = EurekaService.validateDocument(documentContent);
                if (docRejection != null) {
                    String doneJson = new JsonObject()
                        .put("type", "done").put("reply", docRejection).encode();
                    ctx.response().setStatusCode(200)
                        .putHeader("Content-Type", "text/event-stream; charset=utf-8")
                        .putHeader("Cache-Control", "no-cache")
                        .putHeader("X-Accel-Buffering", "no")
                        .setChunked(true)
                        .write("data: " + doneJson + "\n\n")
                        .onComplete(v -> ctx.response().end());
                    return;
                }
                if (documentContent.length() > 16000) documentContent = documentContent.substring(0, 16000);
            }

            final String finalPageContext    = pageContext;
            final String finalDocContent     = documentContent;
            final List<JsonObject> finalHist = history;
            final String finalUserMsg        = userMessage;

            // Open SSE stream
            io.vertx.core.http.HttpServerResponse resp = ctx.response();
            resp.setStatusCode(200)
                .putHeader("Content-Type", "text/event-stream; charset=utf-8")
                .putHeader("Cache-Control", "no-cache")
                .putHeader("X-Accel-Buffering", "no")
                .setChunked(true);

            users.findById(session.userId())
                .compose(uOpt -> {
                    User u = uOpt.orElseThrow(() -> new RuntimeException("session invalid"));
                    return institutions.findById(u.institutionId())
                        .map(instOpt -> {
                            String instName = instOpt.map(i -> i.name()).orElse("Unknown Institution");
                            return new Object[]{ u, instName };
                        });
                })
                .onSuccess(pair -> {
                    User u = (User) pair[0];
                    String instName = (String) pair[1];
                    service.streamChat(
                        u.institutionId(), instName,
                        finalHist, finalUserMsg, finalPageContext, finalDocContent,
                        data -> ctx.vertx().runOnContext(v -> safeWrite(resp, "data: " + data + "\n\n")),
                        () -> safeEnd(resp)
                    );
                })
                .onFailure(e -> {
                    String err = new JsonObject().put("type", "error").put("message", "Auth error").encode();
                    ctx.vertx().runOnContext(v -> {
                        safeWrite(resp, "data: " + err + "\n\n");
                        safeEnd(resp);
                    });
                });
        };
    }

    private static void safeWrite(io.vertx.core.http.HttpServerResponse resp, String data) {
        try { if (!resp.ended() && !resp.closed()) resp.write(data); } catch (Exception ignored) {}
    }

    private static void safeEnd(io.vertx.core.http.HttpServerResponse resp) {
        try { if (!resp.ended() && !resp.closed()) resp.end(); } catch (Exception ignored) {}
    }

    private static void badRequest(RoutingContext ctx, String msg) {
        ctx.response().setStatusCode(400)
            .putHeader("Content-Type", "application/json")
            .end(new JsonObject().put("error", msg).encode());
    }
}
