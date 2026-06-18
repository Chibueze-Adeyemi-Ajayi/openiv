package com.openiv.backend.nomos;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class InstitutionRuleRepository {

    private final Pool pool;

    public InstitutionRuleRepository(Pool pool) {
        this.pool = pool;
    }

    private static final String COLS = """
        id, institution_id, name, policy_statement, comprehension,
        function_source, actions, status, created_by, approved_by,
        dev_edited_source, dev_reviewed_by, review_note, it_vetted_by, test_results,
        created_at, updated_at
        """;

    public Future<List<InstitutionRule>> list(long institutionId) {
        return pool.preparedQuery(
            "SELECT " + COLS + " FROM institution_rules WHERE institution_id = $1 ORDER BY created_at DESC")
            .execute(Tuple.of(institutionId))
            .map(rows -> {
                var out = new ArrayList<InstitutionRule>();
                rows.forEach(r -> out.add(map(r)));
                return out;
            });
    }

    public Future<Optional<InstitutionRule>> findById(long id, long institutionId) {
        return pool.preparedQuery(
            "SELECT " + COLS + " FROM institution_rules WHERE id = $1 AND institution_id = $2")
            .execute(Tuple.of(id, institutionId))
            .map(rows -> rows.iterator().hasNext()
                ? Optional.of(map(rows.iterator().next()))
                : Optional.empty());
    }

    public Future<InstitutionRule> create(long institutionId, String name, String policyStatement,
                                          String createdBy, JsonObject comprehension, String functionSource) {
        String compEnc = comprehension != null ? comprehension.encode() : null;
        String status  = functionSource != null && !functionSource.isBlank() ? "draft" : null;
        return pool.preparedQuery(
            "INSERT INTO institution_rules " +
            "(institution_id, name, policy_statement, created_by, comprehension, function_source, status) " +
            "VALUES ($1, $2, $3, $4, $5::jsonb, $6, COALESCE($7, 'draft')) RETURNING " + COLS)
            .execute(Tuple.of(institutionId, name, policyStatement, createdBy, compEnc, functionSource, status))
            .map(rows -> map(rows.iterator().next()));
    }

    public Future<Void> delete(long id, long institutionId) {
        return pool.preparedQuery(
            "DELETE FROM institution_rules WHERE id = $1 AND institution_id = $2 AND status = 'draft'")
            .execute(Tuple.of(id, institutionId))
            .mapEmpty();
    }

    public Future<InstitutionRule> reprocessDraft(long id, long institutionId, String name,
                                                   String policyStatement, JsonObject comprehension,
                                                   String functionSource) {
        String compEnc = comprehension != null ? comprehension.encode() : null;
        return pool.preparedQuery(
            "UPDATE institution_rules " +
            "SET name = $3, policy_statement = $4, comprehension = $5::jsonb, " +
            "function_source = $6, dev_edited_source = NULL, dev_reviewed_by = NULL, " +
            "review_note = NULL, it_vetted_by = NULL, test_results = NULL, " +
            "status = 'draft', updated_at = NOW() " +
            "WHERE id = $1 AND institution_id = $2 AND status = 'draft' " +
            "RETURNING " + COLS)
            .execute(Tuple.of(id, institutionId, name, policyStatement, compEnc, functionSource))
            .map(rows -> {
                if (!rows.iterator().hasNext())
                    throw new RuntimeException("rule not found or not in draft status");
                return map(rows.iterator().next());
            });
    }

    public Future<Void> saveComprehension(long id, long institutionId, JsonObject comprehension) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET comprehension = $3::jsonb, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2""")
            .execute(Tuple.of(id, institutionId, comprehension.encode()))
            .mapEmpty();
    }

    public Future<Void> saveFunction(long id, long institutionId, String source, byte[] wasm) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET function_source = $3, function_wasm = $4,
            status = 'draft', updated_at = NOW()
            WHERE id = $1 AND institution_id = $2""")
            .execute(Tuple.of(id, institutionId, source, wasm))
            .mapEmpty();
    }

    public Future<Void> updateActions(long id, long institutionId, JsonObject actions) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET actions = $3::jsonb, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2""")
            .execute(Tuple.of(id, institutionId, actions.encode()))
            .mapEmpty();
    }

    // ── Workflow transitions ─────────────────────────────────────────────────

    /** CCO submits the drafted rule for developer review. */
    public Future<Void> submitForDevReview(long id, long institutionId) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET status = 'pending_dev_review',
            dev_edited_source = NULL, dev_reviewed_by = NULL, review_note = NULL,
            updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status IN ('draft','pending_approval')""")
            .execute(Tuple.of(id, institutionId))
            .mapEmpty();
    }

    /** Developer accepts the generated code with no edits → goes straight to IT vetting. */
    public Future<Void> devAccept(long id, long institutionId, String reviewer) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET status = 'pending_it_vetting',
            dev_reviewed_by = $3, review_note = NULL, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'pending_dev_review'""")
            .execute(Tuple.of(id, institutionId, reviewer))
            .mapEmpty();
    }

    /** Developer submits edited code → CCO must approve the change. */
    public Future<Void> devSubmitEdits(long id, long institutionId, String reviewer,
                                        String editedSource, String note) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET status = 'pending_cco_approval',
            dev_edited_source = $3, dev_reviewed_by = $4, review_note = $5,
            updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'pending_dev_review'""")
            .execute(Tuple.of(id, institutionId, editedSource, reviewer, note))
            .mapEmpty();
    }

    /** CCO approves developer edits: copy devEditedSource → functionSource, advance to IT vetting. */
    public Future<Void> ccoApproveEdits(long id, long institutionId, String approver) {
        return pool.preparedQuery("""
            UPDATE institution_rules
            SET status = 'pending_it_vetting',
                function_source = dev_edited_source,
                approved_by = $3,
                review_note = NULL,
                updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'pending_cco_approval'""")
            .execute(Tuple.of(id, institutionId, approver))
            .mapEmpty();
    }

    /** CCO rejects developer edits: send back to developer with a note. */
    public Future<Void> ccoRejectEdits(long id, long institutionId, String note) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET status = 'pending_dev_review',
            dev_edited_source = NULL, review_note = $3, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'pending_cco_approval'""")
            .execute(Tuple.of(id, institutionId, note))
            .mapEmpty();
    }

    /** IT saves test results (may be called multiple times). */
    public Future<Void> saveTestResults(long id, long institutionId, JsonArray results, String itActor) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET test_results = $3::jsonb,
            it_vetted_by = $4, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2""")
            .execute(Tuple.of(id, institutionId, results.encode(), itActor))
            .mapEmpty();
    }

    /** IT deploys: pending_it_vetting → active. */
    public Future<Void> deploy(long id, long institutionId, String itActor) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET status = 'active',
            it_vetted_by = $3, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'pending_it_vetting'""")
            .execute(Tuple.of(id, institutionId, itActor))
            .mapEmpty();
    }

    public Future<Void> updateStatus(long id, long institutionId, String status, String actor) {
        return pool.preparedQuery("""
            UPDATE institution_rules
            SET status = $3, approved_by = CASE WHEN $3 = 'active' THEN $4 ELSE approved_by END,
            updated_at = NOW()
            WHERE id = $1 AND institution_id = $2""")
            .execute(Tuple.of(id, institutionId, status, actor))
            .mapEmpty();
    }

    public Future<Void> updateName(long id, long institutionId, String name) {
        return pool.preparedQuery("""
            UPDATE institution_rules SET name = $3, updated_at = NOW()
            WHERE id = $1 AND institution_id = $2 AND status = 'draft'""")
            .execute(Tuple.of(id, institutionId, name))
            .mapEmpty();
    }

    private static JsonObject jsonCol(io.vertx.sqlclient.Row r, String col) {
        Object val = r.getValue(col);
        if (val == null)             return null;
        if (val instanceof JsonObject j) return j;
        if (val instanceof String s)     return new JsonObject(s);
        return (JsonObject) val;
    }

    private static InstitutionRule map(io.vertx.sqlclient.Row r) {
        JsonObject comp    = jsonCol(r, "comprehension");
        JsonObject actions = jsonCol(r, "actions");
        JsonObject tests   = jsonCol(r, "test_results");
        return new InstitutionRule(
            r.getLong("id"),
            r.getLong("institution_id"),
            r.getString("name"),
            r.getString("policy_statement"),
            comp,
            r.getString("function_source"),
            null, // function_wasm not selected for performance
            actions != null ? actions : RuleActions.defaults().toJson(),
            r.getString("status"),
            r.getString("created_by"),
            r.getString("approved_by"),
            r.getString("dev_edited_source"),
            r.getString("dev_reviewed_by"),
            r.getString("review_note"),
            r.getString("it_vetted_by"),
            tests,
            r.getOffsetDateTime("created_at"),
            r.getOffsetDateTime("updated_at")
        );
    }
}
