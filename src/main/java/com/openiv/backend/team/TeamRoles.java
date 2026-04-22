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
      "admin", "cco", "analyst", "developer", "viewer", "regulator"
  );

  private TeamRoles() {}

  public static boolean isValid(String role) {
    return role != null && VALID.contains(role);
  }

  /** Returns the canonical role catalog as a JsonArray (shape matches the frontend mock). */
  public static JsonArray catalog() {
    JsonArray arr = new JsonArray();
    arr.add(role("admin", "Administrator",
        "Full access. Manages org, billing, integrations, and team.", "#dc2626"));
    arr.add(role("cco", "Chief Compliance Officer",
        "Files NFIU reports and signs off on STRs.", "#1e40af"));
    arr.add(role("analyst", "Fraud Analyst",
        "Investigates cases, escalates to seniors.", "#10b981"));
    arr.add(role("developer", "Developer",
        "Wires integrations, webhooks, API connections.", "#0891b2"));
    arr.add(role("viewer", "Auditor (Read-only)",
        "View-only access for internal/external auditors.", "#475569"));
    arr.add(role("regulator", "Regulator",
        "External supervisor (CBN, NFIU, NDIC).", "#7c3aed"));
    return arr;
  }

  private static JsonObject role(String id, String name, String description, String color) {
    return new JsonObject()
        .put("id", id)
        .put("name", name)
        .put("description", description)
        .put("color", color);
  }
}
