package com.openiv.backend.nomos;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.List;

public record RuleActions(
    boolean         holdTransaction,
    boolean         openCase,
    String          caseSeverity,
    boolean         fileReport,
    String          reportType,
    List<String>    notifyRoles
) {
    public static RuleActions defaults() {
        return new RuleActions(true, false, "medium", false, "STR", List.of());
    }

    public static RuleActions fromJson(JsonObject j) {
        if (j == null) return defaults();
        JsonObject caseObj   = j.getJsonObject("openCase",   new JsonObject());
        JsonObject reportObj = j.getJsonObject("fileReport", new JsonObject());
        JsonArray  roles     = j.getJsonArray("notifyRoles", new JsonArray());
        return new RuleActions(
            j.getBoolean("holdTransaction", true),
            caseObj.getBoolean("enabled",    false),
            caseObj.getString("severity",    "medium"),
            reportObj.getBoolean("enabled",  false),
            reportObj.getString("reportType","STR"),
            roles.stream().map(Object::toString).toList()
        );
    }

    public JsonObject toJson() {
        return new JsonObject()
            .put("holdTransaction", holdTransaction)
            .put("openCase",  new JsonObject().put("enabled", openCase).put("severity", caseSeverity))
            .put("fileReport",new JsonObject().put("enabled", fileReport).put("reportType", reportType))
            .put("notifyRoles", new JsonArray(notifyRoles));
    }
}
