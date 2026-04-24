package com.openiv.backend.cases;

import com.openiv.backend.transactions.Transaction;
import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class CaseRepository {

  private final Pool pool;

  public CaseRepository(Pool pool) {
    this.pool = pool;
  }

  public record CasePage(List<CaseRecord> cases, long total, int page, int pageSize) {}

  private static final String CASE_SELECT =
      "SELECT c.id, c.institution_id, c.title, c.typology, c.status, c.priority, c.risk_score, "
      + "c.assigned_to, COALESCE(u1.full_name, u1.email) AS assignee_name, "
      + "c.notes, c.resolution, c.created_by, COALESCE(u2.full_name, u2.email) AS created_by_name, "
      + "c.sla_deadline, c.closed_at, c.created_at, c.updated_at "
      + "FROM cases c "
      + "LEFT JOIN users u1 ON c.assigned_to = u1.id "
      + "LEFT JOIN users u2 ON c.created_by = u2.id";

  private static final String TXN_COLS =
      "t.id, t.institution_id, t.customer_id, t.customer_name, t.amount, t.channel, "
      + "t.counterparty, t.risk_score, t.status, t.flagged_status, t.location, t.lat, t.lng, "
      + "t.occurred_at, t.created_at, t.updated_at, t.sender_account, t.sender_bank, "
      + "t.recipient_name, t.recipient_account, t.recipient_bank, t.currency, "
      + "t.narration, t.device_id, t.ip_address";

  // ── List ────────────────────────────────────────────────────────────────────

  public Future<CasePage> list(long institutionId, String status, String priority,
      String q, int page, int pageSize) {

    var where  = new StringBuilder("c.institution_id = $1");
    var params = new ArrayList<Object>();
    params.add(institutionId);

    if (status != null && !status.isBlank()) {
      where.append(" AND c.status = $").append(params.size() + 1);
      params.add(status);
    }
    if (priority != null && !priority.isBlank()) {
      where.append(" AND c.priority = $").append(params.size() + 1);
      params.add(priority);
    }
    if (q != null && !q.isBlank()) {
      String like = "%" + q.toLowerCase() + "%";
      int n = params.size() + 1;
      where.append(" AND (LOWER(c.id) LIKE $").append(n)
           .append(" OR LOWER(c.title) LIKE $").append(n + 1)
           .append(" OR LOWER(c.typology) LIKE $").append(n + 2).append(")");
      params.add(like); params.add(like); params.add(like);
    }

    String order =
        " ORDER BY CASE c.status WHEN 'escalated' THEN 0 WHEN 'investigating' THEN 1"
        + " WHEN 'open' THEN 2 ELSE 3 END, c.sla_deadline ASC";

    String countSql = "SELECT COUNT(*) FROM cases c WHERE " + where;
    String listSql  = CASE_SELECT + " WHERE " + where + order
        + " LIMIT $"  + (params.size() + 1)
        + " OFFSET $" + (params.size() + 2);

    Tuple base = buildTuple(params);
    var lp = new ArrayList<>(params);
    lp.add(pageSize);
    lp.add((long) (page - 1) * pageSize);
    Tuple listTuple = buildTuple(lp);

    return pool.preparedQuery(countSql).execute(base)
        .map(rs -> rs.iterator().next().getLong(0))
        .compose(total -> pool.preparedQuery(listSql).execute(listTuple)
            .map(rs -> {
              var list = new ArrayList<CaseRecord>();
              rs.forEach(r -> list.add(mapCase(r)));
              return new CasePage(List.copyOf(list), total, page, pageSize);
            }));
  }

  // ── Sequence ─────────────────────────────────────────────────────────────

  public Future<Long> nextSeq() {
    return pool.preparedQuery("SELECT nextval('case_seq')").execute(Tuple.tuple())
        .map(rs -> rs.iterator().next().getLong(0));
  }

  // ── Create ───────────────────────────────────────────────────────────────

  public Future<CaseRecord> create(String id, long institutionId, String title, String typology,
      String priority, int riskScore, Long assignedTo, String notes,
      OffsetDateTime slaDeadline, long createdBy) {

    String sql = "INSERT INTO cases "
        + "(id, institution_id, title, typology, priority, risk_score, assigned_to, notes, created_by, sla_deadline) "
        + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
    var p = new ArrayList<>();
    p.add(id); p.add(institutionId); p.add(title); p.add(typology);
    p.add(priority); p.add(riskScore); p.add(assignedTo); p.add(notes);
    p.add(createdBy); p.add(slaDeadline);
    return pool.preparedQuery(sql).execute(buildTuple(p))
        .compose(v -> findById(id, institutionId).map(opt -> opt.orElseThrow()));
  }

  // ── Find ─────────────────────────────────────────────────────────────────

  public Future<Optional<CaseRecord>> findById(String id, long institutionId) {
    return pool.preparedQuery(CASE_SELECT + " WHERE c.id = $1 AND c.institution_id = $2")
        .execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapCase(it.next())) : Optional.empty();
        });
  }

  // ── Detail ───────────────────────────────────────────────────────────────

  public Future<Optional<CaseDetail>> detail(String id, long institutionId) {
    return findById(id, institutionId).compose(opt -> {
      if (opt.isEmpty()) return Future.succeededFuture(Optional.empty());
      CaseRecord cas = opt.get();

      String txnSql = "SELECT " + TXN_COLS
          + " FROM transactions t JOIN case_transactions ct ON ct.transaction_id = t.id"
          + " WHERE ct.case_id = $1 ORDER BY ct.linked_at DESC";

      String actSql =
          "SELECT ca.id, ca.case_id, ca.actor_id,"
          + " COALESCE(u.full_name, u.email) AS actor_name,"
          + " COALESCE(u.role, 'unknown') AS actor_role,"
          + " ca.action, ca.detail, ca.created_at"
          + " FROM case_activity ca LEFT JOIN users u ON ca.actor_id = u.id"
          + " WHERE ca.case_id = $1 ORDER BY ca.created_at DESC LIMIT 200";

      return pool.preparedQuery(txnSql).execute(Tuple.of(id))
          .compose(txnRs -> {
            var txns = new ArrayList<Transaction>();
            txnRs.forEach(r -> txns.add(mapTxn(r)));
            return pool.preparedQuery(actSql).execute(Tuple.of(id))
                .compose(actRs -> {
                  var acts = new ArrayList<CaseActivity>();
                  actRs.forEach(r -> acts.add(mapActivity(r)));
                  return findEvidence(id)
                      .map(ev -> Optional.of(new CaseDetail(cas, List.copyOf(txns), List.copyOf(acts), ev)));
                });
          });
    });
  }

  // ── Find case linked to a transaction ────────────────────────────────────

  public Future<Optional<CaseRecord>> findCaseByTransaction(long institutionId, String transactionId) {
    String sql = CASE_SELECT
        + " JOIN case_transactions ct ON ct.case_id = c.id"
        + " WHERE ct.transaction_id = $1 AND c.institution_id = $2"
        + " ORDER BY c.created_at DESC LIMIT 1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(transactionId, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapCase(it.next())) : Optional.empty();
        });
  }

  // ── Evidence ─────────────────────────────────────────────────────────────

  public Future<CaseEvidence> addEvidence(String caseId, long addedBy,
      String category, String title, String detail, String refId) {
    String sql =
        "INSERT INTO case_evidence (case_id, added_by, category, title, detail, ref_id)"
        + " VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, created_at";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(caseId, addedBy, category, title, detail, refId))
        .map(rs -> {
          Row r = rs.iterator().next();
          return new CaseEvidence(
              r.getLong("id"), caseId, addedBy, null,
              category, title, detail, refId, r.getOffsetDateTime("created_at"));
        });
  }

  public Future<List<CaseEvidence>> findEvidence(String caseId) {
    String sql =
        "SELECT e.id, e.case_id, e.added_by,"
        + " COALESCE(u.full_name, u.email) AS added_by_name,"
        + " e.category, e.title, e.detail, e.ref_id, e.created_at"
        + " FROM case_evidence e JOIN users u ON u.id = e.added_by"
        + " WHERE e.case_id = $1 ORDER BY e.created_at ASC";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(caseId))
        .map(rs -> {
          var list = new ArrayList<CaseEvidence>();
          rs.forEach(r -> list.add(new CaseEvidence(
              r.getLong("id"),
              r.getString("case_id"),
              r.getLong("added_by"),
              r.getString("added_by_name"),
              r.getString("category"),
              r.getString("title"),
              r.getString("detail"),
              r.getString("ref_id"),
              r.getOffsetDateTime("created_at"))));
          return List.copyOf(list);
        });
  }

  // ── Update status ─────────────────────────────────────────────────────────

  public Future<Boolean> updateStatus(String id, long institutionId,
      String newStatus, String resolution) {
    String sql;
    Tuple params;
    if ("closed".equals(newStatus)) {
      sql = "UPDATE cases SET status=$1, resolution=$2, closed_at=now(), updated_at=now()"
          + " WHERE id=$3 AND institution_id=$4 AND status!='closed'";
      params = Tuple.of(newStatus, resolution, id, institutionId);
    } else {
      sql = "UPDATE cases SET status=$1, updated_at=now()"
          + " WHERE id=$2 AND institution_id=$3 AND status!='closed'";
      params = Tuple.of(newStatus, id, institutionId);
    }
    return pool.preparedQuery(sql).execute(params).map(rs -> rs.rowCount() > 0);
  }

  // ── Link transaction ─────────────────────────────────────────────────────

  public Future<Boolean> linkTransaction(String caseId, String txnId, long institutionId) {
    String check = "SELECT 1 FROM cases WHERE id=$1 AND institution_id=$2";
    return pool.preparedQuery(check).execute(Tuple.of(caseId, institutionId))
        .compose(rs -> {
          if (!rs.iterator().hasNext()) return Future.succeededFuture(false);
          return pool.preparedQuery(
                  "INSERT INTO case_transactions(case_id,transaction_id) VALUES($1,$2) ON CONFLICT DO NOTHING")
              .execute(Tuple.of(caseId, txnId))
              .map(r -> true);
        });
  }

  // ── Activity ─────────────────────────────────────────────────────────────

  public Future<Void> addActivity(String caseId, long actorId, String action, String detail) {
    return pool.preparedQuery(
            "INSERT INTO case_activity(case_id,actor_id,action,detail) VALUES($1,$2,$3,$4)")
        .execute(Tuple.of(caseId, actorId, action, detail))
        .mapEmpty();
  }

  // ── Metrics ──────────────────────────────────────────────────────────────

  public Future<CaseMetrics> metrics(long institutionId) {
    String sql =
        "SELECT "
        + "COUNT(*) FILTER (WHERE status != 'closed') AS open_count, "
        + "COUNT(*) FILTER (WHERE status = 'escalated') AS escalated_count, "
        + "COUNT(*) FILTER (WHERE status = 'closed' AND closed_at >= CURRENT_DATE) AS closed_today, "
        + "COALESCE(AVG(CASE WHEN status='closed' "
        + "  THEN EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600.0 END), 0) AS avg_close_hours "
        + "FROM cases WHERE institution_id=$1";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId)).map(rs -> {
      Row row = rs.iterator().next();
      Double avg = row.getDouble("avg_close_hours");
      return new CaseMetrics(
          row.getLong("open_count"),
          row.getLong("escalated_count"),
          row.getLong("closed_today"),
          avg != null ? Math.round(avg * 10.0) / 10.0 : 0.0);
    });
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private static CaseRecord mapCase(Row r) {
    Object assignedToVal = r.getValue("assigned_to");
    return new CaseRecord(
        r.getString("id"),
        r.getLong("institution_id"),
        r.getString("title"),
        r.getString("typology"),
        r.getString("status"),
        r.getString("priority"),
        r.getInteger("risk_score"),
        assignedToVal != null ? ((Number) assignedToVal).longValue() : null,
        r.getString("assignee_name"),
        r.getString("notes"),
        r.getString("resolution"),
        r.getLong("created_by"),
        r.getString("created_by_name"),
        r.getOffsetDateTime("sla_deadline"),
        r.getOffsetDateTime("closed_at"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"));
  }

  private static CaseActivity mapActivity(Row r) {
    return new CaseActivity(
        r.getLong("id"),
        r.getString("case_id"),
        r.getLong("actor_id"),
        r.getString("actor_name"),
        r.getString("actor_role"),
        r.getString("action"),
        r.getString("detail"),
        r.getOffsetDateTime("created_at"));
  }

  private static Transaction mapTxn(Row r) {
    return new Transaction(
        r.getString("id"), r.getLong("institution_id"),
        r.getString("customer_id"), r.getString("customer_name"),
        r.getBigDecimal("amount"), r.getString("channel"),
        r.getString("counterparty"), r.getInteger("risk_score"),
        r.getString("status"), r.getString("flagged_status"),
        r.getString("location"), r.getDouble("lat"), r.getDouble("lng"),
        r.getOffsetDateTime("occurred_at"), r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getString("sender_account"), r.getString("sender_bank"),
        r.getString("recipient_name"), r.getString("recipient_account"),
        r.getString("recipient_bank"), r.getString("currency"),
        r.getString("narration"), r.getString("device_id"), r.getString("ip_address"));
  }

  private static Tuple buildTuple(List<Object> params) {
    Tuple t = Tuple.tuple();
    params.forEach(t::addValue);
    return t;
  }
}
