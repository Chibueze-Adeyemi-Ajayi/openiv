package com.openiv.backend.nomos;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * HTTP-backed tools executed during the AI tool-call loop.
 * Web search and exchange rates both use SerpAPI (serpapi.com).
 * Geocoding uses OpenStreetMap Nominatim (free, no key).
 * All methods are synchronous — callers run them on a worker thread.
 */
public final class NomosTools {

    private static final String SERP_BASE = "https://serpapi.com/search.json";

    // Fallback NGN rates (per 1 unit) when no SerpAPI key is configured
    private static final Map<String, Double> FALLBACK_RATES = Map.of(
        "USD", 1650.0,
        "EUR", 1790.0,
        "GBP", 2080.0,
        "GHS", 108.0,
        "ZAR",  88.0,
        "CNY",  228.0,
        "CAD", 1210.0,
        "AUD", 1060.0
    );

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .followRedirects(HttpClient.Redirect.NORMAL)
        .build();

    private final String serpApiKey;

    public NomosTools(String serpApiKey) {
        this.serpApiKey = serpApiKey;
    }

    /**
     * Geocode a place name → {lat, lng, countryCode, displayName}.
     * Uses OpenStreetMap Nominatim — no API key required.
     */
    public String geocodeLocation(String location) {
        if (location == null || location.isBlank())
            return "{\"error\":\"location is required\"}";
        try {
            String encoded = URLEncoder.encode(location, StandardCharsets.UTF_8);
            String url = "https://nominatim.openstreetmap.org/search?q=" + encoded
                + "&format=json&limit=1&addressdetails=1";
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("User-Agent", "OpenIV-Compliance/1.0 contact@openiv.ng")
                .GET().build();
            String body = HTTP.send(req, HttpResponse.BodyHandlers.ofString()).body();
            JsonArray arr = new JsonArray(body);
            if (arr.isEmpty())
                return "{\"error\":\"Location not found: " + location + "\"}";
            JsonObject top     = arr.getJsonObject(0);
            JsonObject address = top.getJsonObject("address", new JsonObject());
            return new JsonObject()
                .put("lat",         Double.parseDouble(top.getString("lat")))
                .put("lng",         Double.parseDouble(top.getString("lon")))
                .put("countryCode", address.getString("country_code", "").toUpperCase())
                .put("displayName", top.getString("display_name"))
                .encode();
        } catch (Exception e) {
            return "{\"error\":\"geocode failed: " + e.getMessage() + "\"}";
        }
    }

    /**
     * Convert an amount in a foreign currency to NGN via SerpAPI Google Finance.
     * Falls back to an approximate rate table when no key is configured.
     * Returns: {"amountNgn":8250000,"rate":1650.0,"note":"live rate via SerpAPI"}
     */
    public String convertToNgn(double amount, String fromCurrency) {
        if (fromCurrency == null) fromCurrency = "USD";
        fromCurrency = fromCurrency.toUpperCase().trim();
        if ("NGN".equals(fromCurrency))
            return new JsonObject().put("amountNgn", (long) amount)
                .put("rate", 1.0).put("note", "already NGN").encode();

        if (serpApiKey != null && !serpApiKey.isBlank()) {
            try {
                // Google Finance currency pair via SerpAPI
                String pair = URLEncoder.encode(fromCurrency + "/NGN", StandardCharsets.UTF_8);
                String url = SERP_BASE + "?engine=google_finance&q=" + pair + "&api_key=" + serpApiKey;
                HttpRequest req = HttpRequest.newBuilder().uri(URI.create(url)).GET().build();
                String raw = HTTP.send(req, HttpResponse.BodyHandlers.ofString()).body();
                JsonObject resp = new JsonObject(raw);

                // SerpAPI Google Finance returns the price at the top level
                Double rate = null;
                if (resp.containsKey("summary")) {
                    rate = resp.getJsonObject("summary").getDouble("price", 0.0);
                } else if (resp.containsKey("price")) {
                    rate = resp.getDouble("price", 0.0);
                }
                if (rate != null && rate > 0) {
                    return new JsonObject()
                        .put("amountNgn", Math.round(amount * rate))
                        .put("rate",      rate)
                        .put("note",      "live rate via SerpAPI Google Finance").encode();
                }
            } catch (Exception ignored) {}
        }

        // Fallback table
        Double rate = FALLBACK_RATES.get(fromCurrency);
        if (rate == null)
            return "{\"error\":\"Unknown currency: " + fromCurrency + " — configure SERP_API_KEY for live rates\"}";
        return new JsonObject()
            .put("amountNgn", Math.round(amount * rate))
            .put("rate",      rate)
            .put("note",      "approximate — set SERP_API_KEY in ai config for live rates")
            .encode();
    }

    /**
     * Search the web for CBN circulars, NFIU guidance, FATF classifications.
     * Uses SerpAPI Google Search — requires serpApiKey.
     * Returns: [{"title":"...","url":"...","snippet":"..."}]
     */
    public String webSearch(String query) {
        if (serpApiKey == null || serpApiKey.isBlank())
            return "{\"error\":\"Web search not configured — set SERP_API_KEY in ai config\"}";
        if (query == null || query.isBlank())
            return "{\"error\":\"query is required\"}";
        try {
            String encoded = URLEncoder.encode(query, StandardCharsets.UTF_8);
            String url = SERP_BASE + "?engine=google&q=" + encoded + "&num=3&api_key=" + serpApiKey;
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .header("Accept", "application/json")
                .GET().build();
            String raw = HTTP.send(req, HttpResponse.BodyHandlers.ofString()).body();
            JsonObject body    = new JsonObject(raw);
            JsonArray  results = body.getJsonArray("organic_results", new JsonArray());
            JsonArray  out     = new JsonArray();
            for (int i = 0; i < Math.min(3, results.size()); i++) {
                JsonObject r = results.getJsonObject(i);
                out.add(new JsonObject()
                    .put("title",   r.getString("title",   ""))
                    .put("url",     r.getString("link",    ""))
                    .put("snippet", r.getString("snippet", "")));
            }
            return out.encode();
        } catch (Exception e) {
            return "{\"error\":\"search failed: " + e.getMessage() + "\"}";
        }
    }
}
