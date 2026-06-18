package com.openiv.backend.monitoring;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class MonitoringPipelineRepository {

    private final Pool pool;

    public MonitoringPipelineRepository(Pool pool) { this.pool = pool; }

    private static final String P_COLS =
        "id, institution_id, name, description, logic, status, created_by, created_at, updated_at";
    private static final String R_COLS =
        "id, pipeline_id, institution_id, name, field, op, value, policy, code, enabled, position, created_at, updated_at";

    // ── Pipelines ────────────────────────────────────────────────────────────

    // Single JOIN query — avoids two-step fetch and dynamic IN-clause tuple wrapping
    private static final String LIST_SQL =
        "SELECT " +
        "  p.id AS p_id, p.institution_id AS p_inst, p.name AS p_name, p.description AS p_desc, " +
        "  p.logic, p.status, p.created_by, p.created_at AS p_created, p.updated_at AS p_updated, " +
        "  r.id AS r_id, r.name AS r_name, r.field, r.op, r.value, r.policy, r.code, " +
        "  r.enabled, r.position, r.created_at AS r_created, r.updated_at AS r_updated " +
        "FROM monitoring_pipelines p " +
        "LEFT JOIN monitoring_rules r ON r.pipeline_id = p.id " +
        "WHERE p.institution_id = $1 " +
        "ORDER BY p.created_at DESC, r.position ASC, r.id ASC";

    public Future<List<MonitoringPipeline>> listPipelines(long institutionId) {
        return pool.preparedQuery(LIST_SQL)
            .execute(Tuple.of(institutionId))
            .map(rows -> {
                Map<Long, MonitoringPipeline>   pMap = new LinkedHashMap<>();
                Map<Long, List<MonitoringRule>> rMap = new LinkedHashMap<>();
                rows.forEach(r -> {
                    long pid = r.getLong("p_id");
                    pMap.computeIfAbsent(pid, k -> mapPipelineJoin(r));
                    rMap.computeIfAbsent(pid, k -> new ArrayList<>());
                    if (r.getValue("r_id") != null) {
                        rMap.get(pid).add(mapRuleJoin(r, pid));
                    }
                });
                return pMap.entrySet().stream().map(e -> {
                    MonitoringPipeline p = e.getValue();
                    return new MonitoringPipeline(p.id(), p.institutionId(), p.name(),
                        p.description(), p.logic(), p.status(), p.createdBy(),
                        rMap.getOrDefault(p.id(), List.of()),
                        p.createdAt(), p.updatedAt());
                }).toList();
            });
    }

    public Future<Optional<MonitoringPipeline>> findById(long id, long institutionId) {
        return pool.preparedQuery(
            "SELECT " + P_COLS + " FROM monitoring_pipelines WHERE id = $1 AND institution_id = $2")
            .execute(Tuple.of(id, institutionId))
            .compose(rows -> {
                if (!rows.iterator().hasNext()) return Future.succeededFuture(Optional.empty());
                MonitoringPipeline p = mapPipeline(rows.iterator().next(), new ArrayList<>());
                return pool.preparedQuery(
                    "SELECT " + R_COLS + " FROM monitoring_rules WHERE pipeline_id = $1 ORDER BY position, id")
                    .execute(Tuple.of(id))
                    .map(ruleRows -> {
                        List<MonitoringRule> rules = new ArrayList<>();
                        ruleRows.forEach(r -> rules.add(mapRule(r)));
                        return Optional.of(new MonitoringPipeline(p.id(), p.institutionId(), p.name(),
                            p.description(), p.logic(), p.status(), p.createdBy(),
                            rules, p.createdAt(), p.updatedAt()));
                    });
            });
    }

    public Future<MonitoringPipeline> createPipeline(long institutionId, String name,
                                                      String description, String logic,
                                                      String createdBy) {
        return pool.preparedQuery(
            "INSERT INTO monitoring_pipelines (institution_id, name, description, logic, created_by) " +
            "VALUES ($1, $2, $3, $4, $5) RETURNING " + P_COLS)
            .execute(Tuple.of(institutionId, name, description, logic, createdBy))
            .map(rows -> mapPipeline(rows.iterator().next(), new ArrayList<>()));
    }

    public Future<Optional<MonitoringPipeline>> updatePipeline(long id, long institutionId,
                                                                String name, String description,
                                                                String logic, String status) {
        return pool.preparedQuery(
            "UPDATE monitoring_pipelines SET name = $3, description = $4, logic = $5, " +
            "status = $6, updated_at = NOW() WHERE id = $1 AND institution_id = $2 RETURNING " + P_COLS)
            .execute(Tuple.of(id, institutionId, name, description, logic, status))
            .compose(rows -> {
                if (!rows.iterator().hasNext()) return Future.succeededFuture(Optional.empty());
                MonitoringPipeline p = mapPipeline(rows.iterator().next(), new ArrayList<>());
                return pool.preparedQuery(
                    "SELECT " + R_COLS + " FROM monitoring_rules WHERE pipeline_id = $1 ORDER BY position, id")
                    .execute(Tuple.of(id))
                    .map(ruleRows -> {
                        List<MonitoringRule> rules = new ArrayList<>();
                        ruleRows.forEach(r -> rules.add(mapRule(r)));
                        return Optional.of(new MonitoringPipeline(p.id(), p.institutionId(), p.name(),
                            p.description(), p.logic(), p.status(), p.createdBy(),
                            rules, p.createdAt(), p.updatedAt()));
                    });
            });
    }

    public Future<Void> deletePipeline(long id, long institutionId) {
        return pool.preparedQuery(
            "DELETE FROM monitoring_pipelines WHERE id = $1 AND institution_id = $2")
            .execute(Tuple.of(id, institutionId))
            .mapEmpty();
    }

    // ── Rules ────────────────────────────────────────────────────────────────

    public Future<MonitoringRule> addRule(long pipelineId, long institutionId,
                                          String name, String field, String op,
                                          String value, String policy, String code, int position) {
        return pool.preparedQuery(
            "INSERT INTO monitoring_rules (pipeline_id, institution_id, name, field, op, value, policy, code, position) " +
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING " + R_COLS)
            .execute(Tuple.of(pipelineId, institutionId, name, field, op, value, policy, code, position))
            .map(rows -> mapRule(rows.iterator().next()));
    }

    public Future<Optional<MonitoringRule>> updateRule(long ruleId, long pipelineId,
                                                        long institutionId, String name,
                                                        String field, String op,
                                                        String value, boolean enabled,
                                                        int position) {
        return pool.preparedQuery(
            "UPDATE monitoring_rules SET name = $4, field = $5, op = $6, value = $7, " +
            "enabled = $8, position = $9, updated_at = NOW() " +
            "WHERE id = $1 AND pipeline_id = $2 AND institution_id = $3 RETURNING " + R_COLS)
            .execute(Tuple.of(ruleId, pipelineId, institutionId, name, field, op, value, enabled, position))
            .map(rows -> rows.iterator().hasNext()
                ? Optional.of(mapRule(rows.iterator().next()))
                : Optional.empty());
    }

    public Future<Void> deleteRule(long ruleId, long pipelineId, long institutionId) {
        return pool.preparedQuery(
            "DELETE FROM monitoring_rules WHERE id = $1 AND pipeline_id = $2 AND institution_id = $3")
            .execute(Tuple.of(ruleId, pipelineId, institutionId))
            .mapEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static MonitoringPipeline mapPipelineJoin(Row r) {
        return new MonitoringPipeline(
            r.getLong("p_id"),
            r.getLong("p_inst"),
            r.getString("p_name"),
            r.getString("p_desc"),
            r.getString("logic") != null ? r.getString("logic").trim() : "OR",
            r.getString("status"),
            r.getString("created_by"),
            new ArrayList<>(),
            r.getOffsetDateTime("p_created"),
            r.getOffsetDateTime("p_updated"));
    }

    private static MonitoringRule mapRuleJoin(Row r, long pipelineId) {
        return new MonitoringRule(
            r.getLong("r_id"),
            pipelineId,
            r.getLong("p_inst"),
            r.getString("r_name"),
            r.getString("field"),
            r.getString("op"),
            r.getString("value"),
            r.getString("policy"),
            r.getString("code"),
            r.getBoolean("enabled"),
            r.getInteger("position"),
            r.getOffsetDateTime("r_created"),
            r.getOffsetDateTime("r_updated"));
    }

    private static MonitoringPipeline mapPipeline(Row r, List<MonitoringRule> rules) {
        return new MonitoringPipeline(
            r.getLong("id"),
            r.getLong("institution_id"),
            r.getString("name"),
            r.getString("description"),
            r.getString("logic") != null ? r.getString("logic").trim() : "OR",
            r.getString("status"),
            r.getString("created_by"),
            rules,
            r.getOffsetDateTime("created_at"),
            r.getOffsetDateTime("updated_at"));
    }

    private static MonitoringRule mapRule(Row r) {
        return new MonitoringRule(
            r.getLong("id"),
            r.getLong("pipeline_id"),
            r.getLong("institution_id"),
            r.getString("name"),
            r.getString("field"),
            r.getString("op"),
            r.getString("value"),
            r.getString("policy"),
            r.getString("code"),
            r.getBoolean("enabled"),
            r.getInteger("position"),
            r.getOffsetDateTime("created_at"),
            r.getOffsetDateTime("updated_at"));
    }
}
