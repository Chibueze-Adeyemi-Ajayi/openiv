package com.openiv.backend.team;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;

import java.util.Set;

/**
 * The six canonical roles shown in the team UI. Kept here (not in the DB) because the frontend
 * has hardcoded names, descriptions, and colors; making them config-driven without shipping an
 * admin UI to edit them adds churn without value. Bring roles into the DB when we ship
 * "Create Custom Role" on the backend.
 */
public final class TeamRoles {

  public static final Set<String> VALID = Set.of(
      "admin", "cco", "analyst", "developer", "auditor"
  );

  private TeamRoles() {}

  public static boolean isValid(String role) {
    return role != null && (VALID.contains(role) || role.startsWith("custom-"));
  }

  /** Returns the canonical role catalog as a JsonArray (shape matches the frontend mock). */
  public static JsonArray catalog() {
    JsonArray arr = new JsonArray();
    
    arr.add(role("admin", "Administrator",
        "Full access. Manages org, billing, integrations, and team.", "#dc2626",
        new JsonObject()
            .put("monitor", new JsonObject().put("view", true).put("act", true))
            .put("cases", new JsonObject().put("view", true).put("assign", true).put("close", true))
            .put("rules", new JsonObject().put("view", true).put("modify", true))
            .put("reports", new JsonObject().put("view", true).put("file", true))
            .put("team", new JsonObject().put("view", true).put("manage", true))
            .put("integrations", new JsonObject().put("view", true).put("modify", true))
            .put("cdd", new JsonObject().put("view", true).put("manage", true).put("evaluate", true))
            .put("pipeline", new JsonObject().put("view", true).put("modify", true))));

    arr.add(role("cco", "Chief Compliance Officer",
        "Files NFIU reports and signs off on STRs.", "#1e40af",
        new JsonObject()
            .put("monitor", new JsonObject().put("view", true).put("act", true))
            .put("cases", new JsonObject().put("view", true).put("assign", true).put("close", true))
            .put("rules", new JsonObject().put("view", true).put("modify", true))
            .put("reports", new JsonObject().put("view", true).put("file", true))
            .put("team", new JsonObject().put("view", true).put("manage", false))
            .put("integrations", new JsonObject().put("view", true).put("modify", false))
            .put("cdd", new JsonObject().put("view", true).put("manage", true).put("evaluate", true))
            .put("pipeline", new JsonObject().put("view", true).put("modify", true))));

    arr.add(role("analyst", "Fraud Analyst",
        "Investigates cases, escalates to seniors.", "#10b981",
        new JsonObject()
            .put("monitor", new JsonObject().put("view", true).put("act", true))
            .put("cases", new JsonObject().put("view", true).put("assign", false).put("close", false))
            .put("rules", new JsonObject().put("view", true).put("modify", false))
            .put("reports", new JsonObject().put("view", true).put("file", false))
            .put("team", new JsonObject().put("view", false).put("manage", false))
            .put("integrations", new JsonObject().put("view", false).put("modify", false))
            .put("cdd", new JsonObject().put("view", true).put("manage", false).put("evaluate", true))
            .put("pipeline", new JsonObject().put("view", true).put("modify", false))));

    arr.add(role("developer", "Developer",
        "Wires integrations, webhooks, API connections.", "#0891b2",
        new JsonObject()
            .put("monitor", new JsonObject().put("view", true).put("act", false))
            .put("cases", new JsonObject().put("view", false).put("assign", false).put("close", false))
            .put("rules", new JsonObject().put("view", true).put("modify", false))
            .put("reports", new JsonObject().put("view", false).put("file", false))
            .put("team", new JsonObject().put("view", false).put("manage", false))
            .put("integrations", new JsonObject().put("view", true).put("modify", true))
            .put("cdd", new JsonObject().put("view", true).put("manage", false).put("evaluate", false))
            .put("pipeline", new JsonObject().put("view", true).put("modify", true))));

    arr.add(role("auditor", "Auditor",
        "View-only access for internal/external examinations and audits.", "#475569",
        new JsonObject()
            .put("monitor", new JsonObject().put("view", true).put("act", false))
            .put("cases", new JsonObject().put("view", true).put("assign", false).put("close", false))
            .put("rules", new JsonObject().put("view", true).put("modify", false))
            .put("reports", new JsonObject().put("view", true).put("file", false))
            .put("team", new JsonObject().put("view", true).put("manage", false))
            .put("integrations", new JsonObject().put("view", true).put("modify", false))
            .put("cdd", new JsonObject().put("view", true).put("manage", false).put("evaluate", false))
            .put("pipeline", new JsonObject().put("view", true).put("modify", false))));

    return arr;
  }

  private static JsonObject role(String id, String name, String description, String color, JsonObject permissions) {
    return new JsonObject()
        .put("id", id)
        .put("name", name)
        .put("description", description)
        .put("color", color)
        .put("permissions", permissions);
  }
}
