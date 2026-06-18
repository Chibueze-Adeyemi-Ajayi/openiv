package com.openiv.backend.nomos;

import com.openiv.backend.config.AppConfig;
import io.vertx.core.Vertx;

/**
 * Kept for binary compatibility with existing references.
 * Real implementation is in {@link NomosAiClient} (LangChain4j + Groq).
 */
public final class AnthropicClient extends NomosAiClient {
    public AnthropicClient(Vertx vertx, AppConfig.AiConfig cfg) {
        super(vertx, cfg);
    }
}
