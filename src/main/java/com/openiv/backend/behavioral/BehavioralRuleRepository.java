package com.openiv.backend.behavioral;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class BehavioralRuleRepository {

  private final Pool pool;

  public BehavioralRuleRepository(Pool pool) {
    this.pool = pool;
  }

  private record DefaultRule(String ruleId, String name, String category, String severity,
      String description, String example, String matchedTypology, boolean isActive,
      JsonObject params, JsonArray recommendedActions) {}

  private static final List<DefaultRule> DEFAULTS = List.of(
      new DefaultRule("pat-1", "Same-IP cluster across unrelated accounts", "Network", "critical",
          "Four customer accounts — none with prior relationship — all initiated wire transfers from the same IP block within minutes.",
          "Adamu I., Folake A., Bashir M., Tunde B. — all moved funds.",
          "Mule herding · NFIU Typology #SST-12", true,
          new JsonObject().put("ip_count", 4).put("timeframe_minutes", 18),
          new JsonArray().add(new JsonObject().put("label", "Freeze all 4 accounts").put("primary", true))
                         .add(new JsonObject().put("label", "Open joint case"))
                         .add(new JsonObject().put("label", "File NFIU STR"))),
      new DefaultRule("pat-2", "Geographically impossible login", "Geo", "high",
          "Customer logged in from distant locations physically impossible without supersonic travel. One session is using stolen credentials.",
          "Folake Adesanya · ACC-2840",
          "Account takeover · CBN Risk Code R-09", true,
          new JsonObject().put("distance_km", 500).put("timeframe_hours", 2),
          new JsonArray().add(new JsonObject().put("label", "Force re-authentication").put("primary", true))
                         .add(new JsonObject().put("label", "Lock newer session"))
                         .add(new JsonObject().put("label", "Notify customer via SMS"))),
      new DefaultRule("pat-3", "Device shared across customers", "Device", "high",
          "Single device fingerprint authenticated as multiple different customers in the past 24 hours — pattern matches credential-stuffing operation.",
          "iPhone 14 Pro · IP rotated through 3 Lagos data centers",
          "Credential stuffing · NFIU Typology #SST-04", true,
          new JsonObject().put("user_count", 7).put("timeframe_hours", 24),
          new JsonArray().add(new JsonObject().put("label", "Block device fingerprint").put("primary", true))
                         .add(new JsonObject().put("label", "Force MFA on affected accounts"))
                         .add(new JsonObject().put("label", "Alert affected customers"))),
      new DefaultRule("pat-4", "Off-pattern activity bursts", "Temporal", "medium",
          "Customers transacting outside their personal baseline of activity. Pattern often precedes coordinated cash-out.",
          "Avg ticket: ₦1.8M · to first-time beneficiaries",
          "Coordinated cash-out · CBN Watch List W-22", true,
          new JsonObject().put("time_start", "02:00").put("time_end", "04:00").put("min_customers", 20),
          new JsonArray().add(new JsonObject().put("label", "Tighten night-window threshold").put("primary", true))
                         .add(new JsonObject().put("label", "Add to enhanced monitoring"))),
      new DefaultRule("pat-5", "Velocity ring — same beneficiary", "Velocity", "high",
          "Multiple customers sent funds to the same wallet within hours. Sub-threshold structuring — each transaction to avoid manual review.",
          "Total flow: ₦9.4M · all marked as 'personal gift' in narration",
          "Smurfing · NFIU Typology #SST-07", true,
          new JsonObject().put("customer_count", 14).put("timeframe_hours", 4),
          new JsonArray().add(new JsonObject().put("label", "Freeze beneficiary wallet").put("primary", true))
                         .add(new JsonObject().put("label", "Investigate source customers"))
                         .add(new JsonObject().put("label", "File aggregated SAR")))
  );

  private static final String SELECT_COLS =
      "id, institution_id, rule_id, name, category, severity, description, example, matched_typology, "
      + "is_active, affected, emergence, params, recommended_actions, created_at, updated_at";

  public Future<List<BehavioralRuleRecord>> list(long institutionId) {
    String sql = "SELECT " + SELECT_COLS + " FROM behavioral_rules WHERE institution_id = $1 ORDER BY id ASC";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          var list = new ArrayList<BehavioralRuleRecord>();
          rs.forEach(r -> list.add(mapRow(r)));
          return List.copyOf(list);
        });
  }

  public Future<Optional<BehavioralRuleRecord>> findById(long id, long institutionId) {
    String sql = "SELECT " + SELECT_COLS + " FROM behavioral_rules WHERE id = $1 AND institution_id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapRow(it.next())) : Optional.empty();
        });
  }

  public Future<Void> seedIfEmpty(long institutionId) {
    String countSql = "SELECT COUNT(*) FROM behavioral_rules WHERE institution_id = $1";
    return pool.preparedQuery(countSql).execute(Tuple.of(institutionId))
        .compose(rs -> {
          if (rs.iterator().next().getLong(0) > 0) return Future.succeededFuture();

          String insertSql =
              "INSERT INTO behavioral_rules "
              + "(institution_id, rule_id, name, category, severity, description, example, matched_typology, "
              + " is_active, affected, emergence, params, recommended_actions) "
              + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT DO NOTHING";

          Future<Void> chain = Future.succeededFuture();
          for (DefaultRule dr : DEFAULTS) {
            chain = chain.compose(v ->
                pool.preparedQuery(insertSql).execute(Tuple.of(
                    institutionId, dr.ruleId(), dr.name(), dr.category(), dr.severity(),
                    dr.description(), dr.example(), dr.matchedTypology(), dr.isActive(),
                    0, "Just now", dr.params(), dr.recommendedActions()
                )).mapEmpty()
            );
          }
          return chain;
        });
  }

  public Future<Boolean> updateParams(long id, long institutionId, JsonObject params) {
    String sql = "UPDATE behavioral_rules SET params = $1, updated_at = now() WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(params, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Boolean> updateActive(long id, long institutionId, boolean isActive) {
    String sql = "UPDATE behavioral_rules SET is_active = $1, updated_at = now() WHERE id = $2 AND institution_id = $3";
    return pool.preparedQuery(sql).execute(Tuple.of(isActive, id, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  private static BehavioralRuleRecord mapRow(Row r) {
    return new BehavioralRuleRecord(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getString("rule_id"),
        r.getString("name"),
        r.getString("category"),
        r.getString("severity"),
        r.getString("description"),
        r.getString("example"),
        r.getString("matched_typology"),
        r.getBoolean("is_active"),
        r.getInteger("affected"),
        r.getString("emergence"),
        r.getJsonObject("params"),
        r.getJsonArray("recommended_actions"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at")
    );
  }
}
