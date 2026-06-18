package com.openiv.backend.nomos;

import com.openiv.backend.config.AppConfig;
import dev.langchain4j.agent.tool.ToolExecutionRequest;
import dev.langchain4j.agent.tool.ToolSpecification;
import dev.langchain4j.data.message.AiMessage;
import dev.langchain4j.data.message.ChatMessage;
import dev.langchain4j.data.message.SystemMessage;
import dev.langchain4j.data.message.ToolExecutionResultMessage;
import dev.langchain4j.data.message.UserMessage;
import dev.langchain4j.model.StreamingResponseHandler;
import dev.langchain4j.model.chat.request.json.JsonObjectSchema;
import dev.langchain4j.model.openai.OpenAiChatModel;
import dev.langchain4j.model.openai.OpenAiStreamingChatModel;
import dev.langchain4j.model.output.Response;
import io.vertx.core.Future;
import io.vertx.core.Promise;
import io.vertx.core.Vertx;
import io.vertx.core.json.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public class NomosAiClient {

    private static final String BLUE  = "\033[34m";
    private static final String RESET = "\033[0m";

    // ── Tool specifications (new JsonObjectSchema API) ─────────────────────────

    private static final ToolSpecification GEOCODE_TOOL = ToolSpecification.builder()
        .name("geocode_location")
        .description("Resolve a city, state, or place name to GPS coordinates (lat/lng) and ISO-2 " +
                     "country code. Call whenever a rule description mentions a geographic location.")
        .parameters(JsonObjectSchema.builder()
            .addStringProperty("location",
                "City, region, or place name — e.g. 'Lagos', 'Abuja FCT', 'Port Harcourt'")
            .required("location")
            .build())
        .build();

    private static final ToolSpecification CONVERT_TOOL = ToolSpecification.builder()
        .name("convert_to_ngn")
        .description("Convert a monetary amount from a foreign currency to Nigerian Naira (NGN). " +
                     "Call whenever the rule specifies amounts in USD, EUR, GBP, or any non-NGN currency.")
        .parameters(JsonObjectSchema.builder()
            .addNumberProperty("amount",   "The monetary amount to convert")
            .addStringProperty("currency", "ISO 4217 code — e.g. USD, EUR, GBP, GHS")
            .required("amount", "currency")
            .build())
        .build();

    private static final ToolSpecification SEARCH_TOOL = ToolSpecification.builder()
        .name("web_search")
        .description("Search the internet for Nigerian financial regulations, CBN circulars, NFIU " +
                     "guidance, or FATF risk classifications. Call when a regulation code is mentioned.")
        .parameters(JsonObjectSchema.builder()
            .addStringProperty("query",
                "Search query — e.g. 'CBN AML CFT threshold 2024 STR Nigeria'")
            .required("query")
            .build())
        .build();

    private static final List<ToolSpecification> ALL_TOOLS =
        List.of(GEOCODE_TOOL, CONVERT_TOOL, SEARCH_TOOL);

    // ── Fields ────────────────────────────────────────────────────────────────

    private final Vertx                    vertx;
    private final OpenAiChatModel          chatModel;
    private final OpenAiStreamingChatModel streamingModel;
    private final String                   modelName;
    private final String                   provider;
    private final NomosTools               tools;

    public NomosAiClient(Vertx vertx, AppConfig.AiConfig cfg) {
        this.vertx     = vertx;
        this.modelName = cfg.model();
        this.provider  = cfg.hasFreeModel() ? "FreeModel.dev" : "Groq";
        this.tools     = new NomosTools(cfg.serpApiKey());

        String baseUrl = cfg.activeBaseUrl();
        String apiKey  = cfg.activeKey();

        String keyPreview = apiKey != null && apiKey.length() > 8
            ? apiKey.substring(0, 8) + "..." + "(len=" + apiKey.length() + ")"
            : "(empty or short)";
        System.out.println(BLUE + "[Nomos] provider=" + provider
            + "  baseUrl=" + baseUrl + "  model=" + modelName
            + "  key=" + keyPreview + RESET);

        this.chatModel = OpenAiChatModel.builder()
            .baseUrl(baseUrl)
            .apiKey(apiKey)
            .modelName(modelName)
            .temperature(0.1)
            .maxTokens(4096)
            .build();

        this.streamingModel = OpenAiStreamingChatModel.builder()
            .baseUrl(baseUrl)
            .apiKey(apiKey)
            .modelName(modelName)
            .temperature(0.1)
            .maxTokens(4096)
            .build();
    }

    /**
     * Non-streaming completion — no tool calls.
     * Used for streaming rule-code generation and simple prompts.
     */
    public Future<String> complete(String systemPrompt, String userMessage) {
        return vertx.executeBlocking(() -> {
            System.out.println(BLUE + "[Nomos] complete  model=" + modelName + RESET);
            Response<AiMessage> response = chatModel.generate(
                List.of(SystemMessage.from(systemPrompt), UserMessage.from(userMessage))
            );
            return response.content().text();
        });
    }

    /**
     * Tool-enabled completion — the model may call geocode_location, convert_to_ngn,
     * and web_search during reasoning before returning the final JSON.
     * Runs the tool-call loop (up to 6 rounds) on a worker thread.
     */
    public Future<String> completeWithTools(String systemPrompt, String userMessage) {
        return vertx.executeBlocking(() -> {
            System.out.println(BLUE + "[Nomos] completeWithTools  model=" + modelName + RESET);

            List<ChatMessage> messages = new ArrayList<>();
            messages.add(SystemMessage.from(systemPrompt));
            messages.add(UserMessage.from(userMessage));

            for (int i = 0; i < 6; i++) {
                Response<AiMessage> response = chatModel.generate(messages, ALL_TOOLS);
                AiMessage aiMsg = response.content();
                messages.add(aiMsg);

                if (!aiMsg.hasToolExecutionRequests()) {
                    System.out.println(BLUE + "[Nomos] ✓ done  rounds=" + (i + 1) + RESET);
                    return aiMsg.text();
                }

                for (ToolExecutionRequest req : aiMsg.toolExecutionRequests()) {
                    String result = executeTool(req);
                    System.out.println(BLUE + "[Nomos] tool=" + req.name()
                        + "  args=" + req.arguments() + "  result=" + result + RESET);
                    messages.add(ToolExecutionResultMessage.from(req, result));
                }
            }

            // Exhausted rounds — force a final answer without tool loop
            Response<AiMessage> final_ = chatModel.generate(messages);
            return final_.content().text();
        });
    }

    private String executeTool(ToolExecutionRequest req) {
        try {
            JsonObject args = new JsonObject(req.arguments() == null ? "{}" : req.arguments());
            return switch (req.name()) {
                case "geocode_location" -> tools.geocodeLocation(args.getString("location", ""));
                case "convert_to_ngn"  -> tools.convertToNgn(
                                              args.getDouble("amount", 0.0),
                                              args.getString("currency", "USD"));
                case "web_search"      -> tools.webSearch(args.getString("query", ""));
                default                -> "{\"error\":\"unknown tool: " + req.name() + "\"}";
            };
        } catch (Exception e) {
            return "{\"error\":\"tool execution failed: " + e.getMessage() + "\"}";
        }
    }

    /**
     * Streaming completion — no tools.
     * Used for the rule-code generation animation in the UI.
     */
    public Future<String> stream(String systemPrompt, String userMessage,
                                  Consumer<String> onToken, Runnable onDone) {
        Promise<String> promise = Promise.promise();
        StringBuilder   full    = new StringBuilder();

        System.out.println(BLUE + "[Nomos] → stream  model=" + modelName + RESET);

        streamingModel.generate(
            List.of(SystemMessage.from(systemPrompt), UserMessage.from(userMessage)),
            new StreamingResponseHandler<>() {

                @Override public void onNext(String token) {
                    vertx.runOnContext(v -> { full.append(token); onToken.accept(token); });
                }

                @Override public void onComplete(Response<AiMessage> response) {
                    vertx.runOnContext(v -> {
                        System.out.println(BLUE + "[Nomos] ✓ stream done  chars=" + full.length() + RESET);
                        onDone.run();
                        promise.complete(full.toString());
                    });
                }

                @Override public void onError(Throwable error) {
                    vertx.runOnContext(v -> {
                        System.err.println(BLUE + "[Nomos] ✗ stream error: " + error.getMessage() + RESET);
                        promise.fail(error);
                    });
                }
            }
        );

        return promise.future();
    }
}
