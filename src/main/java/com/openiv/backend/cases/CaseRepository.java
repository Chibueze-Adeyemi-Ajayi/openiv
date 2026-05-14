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
import java.util.Set;

public final class CaseRepository {

  private final Pool pool;

  public CaseRepository(Pool pool) {
    this.pool = pool;
  }

  public record CasePage(List<CaseRecord> cases, long total, int page, int pageSize) {}

  private static final String CASE_COLS =
      "SELECT c.id, c.institution_id, c.title, c.brief, c.typology, c.status, c.priority, c.risk_score, "
      + "c.assigned_to, COALESCE(u1.full_name, u1.email) AS assignee_name, "
      + "c.notes, c.resolution, c.created_by, COALESCE(u2.full_name, u2.email) AS created_by_name, "
      + "c.sla_deadline, c.closed_at, c.created_at, c.updated_at, c.is_available_for_investigation, "
      + "c.linked_nfiu_report_id, c.customer_id, c.customer_name";

  private static final String CASE_FROM =
      " FROM cases c "
      + "LEFT JOIN users u1 ON c.assigned_to = u1.id "
      + "LEFT JOIN users u2 ON c.created_by = u2.id";

  // Keep CASE_SELECT for callers that don't need the seen column
  private static final String CASE_SELECT = CASE_COLS + CASE_FROM;

  private static final String TXN_COLS =
      "t.id, t.institution_id, t.customer_id, t.customer_name, t.amount, t.channel, "
      + "t.counterparty, t.risk_score, t.status, t.flagged_status, t.location, t.lat, t.lng, "
      + "t.occurred_at, t.created_at, t.updated_at, t.sender_account, t.sender_bank, "
      + "t.recipient_name, t.recipient_account, t.recipient_bank, t.currency, "
      + "t.narration, t.device_id, t.ip_address";

  // ── List ────────────────────────────────────────────────────────────────────

  public Future<CasePage> list(long institutionId, String status, String priority,
      String q, int page, int pageSize, String sort, String range,
      Integer minRisk, Integer maxRisk, long userId, String userRole,
      Boolean assignedToMe, Long assignedToUser) {

    var where  = new StringBuilder("c.institution_id = $1 AND c.is_available_for_investigation = true");
    var params = new ArrayList<Object>();
    params.add(institutionId);

    // Visibility: non-elevated roles only see unassigned cases + cases assigned to them
    if (!isElevatedRole(userRole)) {
      where.append(" AND (c.assigned_to IS NULL OR c.assigned_to = $").append(params.size() + 1).append(")");
      params.add(userId);
    }

    // Assignment filters (stackable on top of visibility)
    if (Boolean.TRUE.equals(assignedToMe)) {
      where.append(" AND c.assigned_to = $").append(params.size() + 1);
      params.add(userId);
    } else if (assignedToUser != null) {
      where.append(" AND c.assigned_to = $").append(params.size() + 1);
      params.add(assignedToUser);
    }

    if (status != null && !status.isBlank()) {
      where.append(" AND c.status = $").append(params.size() + 1);
      params.add(status);
    }
    if (priority != null && !priority.isBlank()) {
      where.append(" AND c.priority = $").append(params.size() + 1);
      params.add(priority);
    }
    if (minRisk != null) {
      where.append(" AND c.risk_score >= $").append(params.size() + 1);
      params.add(minRisk);
    }
    if (maxRisk != null) {
      where.append(" AND c.risk_score <= $").append(params.size() + 1);
      params.add(maxRisk);
    }
    if (q != null && !q.isBlank()) {
      String like = "%" + q.toLowerCase() + "%";
      int n = params.size() + 1;
      where.append(" AND (LOWER(c.id) LIKE $").append(n)
           .append(" OR LOWER(c.title) LIKE $").append(n + 1)
           .append(" OR LOWER(c.typology) LIKE $").append(n + 2).append(")");
      params.add(like); params.add(like); params.add(like);
    }
    String rc = caseRangeClause(range);
    if (rc != null) where.append(" AND ").append(rc);

    String order = caseOrderBy(sort);

    String countSql = "SELECT COUNT(*) FROM cases c WHERE " + where;

    var lp = new ArrayList<>(params);
    lp.add(userId);
    int seenIdx = lp.size();

    String listSql = CASE_COLS
        + ", EXISTS(SELECT 1 FROM case_views cv WHERE cv.case_id = c.id AND cv.user_id = $" + seenIdx + ") AS seen"
        + CASE_FROM
        + " WHERE " + where + order
        + " LIMIT $"  + (lp.size() + 1)
        + " OFFSET $" + (lp.size() + 2);

    lp.add(pageSize);
    lp.add((long) (page - 1) * pageSize);

    Tuple base = buildTuple(params);
    Tuple listTuple = buildTuple(lp);

    return pool.preparedQuery(countSql).execute(base)
        .map(rs -> rs.iterator().next().getLong(0))
        .compose(total -> pool.preparedQuery(listSql).execute(listTuple)
            .map(rs -> {
              var list = new ArrayList<CaseRecord>();
              rs.forEach(r -> list.add(mapCase(r, r.getBoolean("seen"))));
              return new CasePage(List.copyOf(list), total, page, pageSize);
            }));
  }

  // ── Assign case ───────────────────────────────────────────────────────────

  public Future<Void> assignCase(String caseId, long institutionId, long toUserId) {
    return pool.preparedQuery(
            "UPDATE cases SET assigned_to=$1, updated_at=now() WHERE id=$2 AND institution_id=$3")
        .execute(Tuple.of(toUserId, caseId, institutionId))
        .mapEmpty();
  }

  // ── Sequence ─────────────────────────────────────────────────────────────

  public Future<Long> nextSeq() {
    return pool.preparedQuery("SELECT nextval('case_seq')").execute(Tuple.tuple())
        .map(rs -> rs.iterator().next().getLong(0));
  }

  // ── Create ───────────────────────────────────────────────────────────────

  public Future<CaseRecord> create(String id, long institutionId, String title, String brief, String typology,
      String priority, int riskScore, Long assignedTo, String notes,
      OffsetDateTime slaDeadline, Long createdBy, String openReason, Long openDocumentId,
      String customerId, String customerName) {

    String sql = "INSERT INTO cases "
        + "(id, institution_id, title, brief, typology, priority, risk_score, assigned_to, notes,"
        + " created_by, sla_deadline, open_reason, open_document_id, customer_id, customer_name) "
        + "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)";
    var p = new ArrayList<>();
    p.add(id); p.add(institutionId); p.add(title); p.add(brief); p.add(typology);
    p.add(priority); p.add(riskScore); p.add(assignedTo); p.add(notes);
    p.add(createdBy); p.add(slaDeadline); p.add(openReason); p.add(openDocumentId);
    p.add(customerId); p.add(customerName);
    return pool.preparedQuery(sql).execute(buildTuple(p))
        .compose(v -> findById(id, institutionId, createdBy != null ? createdBy : 0L).map(opt -> opt.orElseThrow()));
  }

  // ── Find ─────────────────────────────────────────────────────────────────

  public Future<Optional<CaseRecord>> findById(String id, long institutionId, long userId) {
    String sql = CASE_COLS 
        + ", EXISTS(SELECT 1 FROM case_views cv WHERE cv.case_id = c.id AND cv.user_id = $3) AS seen"
        + CASE_FROM
        + " WHERE c.id = $1 AND c.institution_id = $2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(id, institutionId, userId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Optional.empty();
          Row r = it.next();
          return Optional.of(mapCase(r, r.getBoolean("seen")));
        });
  }

  // ── Unavailable cases ────────────────────────────────────────────────────

  public Future<CasePage> listUnavailable(long institutionId, String status, String priority,
      String q, int page, int pageSize, String sort, String range,
      Integer minRisk, Integer maxRisk, long userId) {

    var where  = new StringBuilder("c.institution_id = $1 AND c.is_available_for_investigation = false");
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
    if (minRisk != null) {
      where.append(" AND c.risk_score >= $").append(params.size() + 1);
      params.add(minRisk);
    }
    if (maxRisk != null) {
      where.append(" AND c.risk_score <= $").append(params.size() + 1);
      params.add(maxRisk);
    }
    if (q != null && !q.isBlank()) {
      String like = "%" + q.toLowerCase() + "%";
      int n = params.size() + 1;
      where.append(" AND (LOWER(c.id) LIKE $").append(n)
           .append(" OR LOWER(c.title) LIKE $").append(n + 1)
           .append(" OR LOWER(c.typology) LIKE $").append(n + 2).append(")");
      params.add(like); params.add(like); params.add(like);
    }
    String rc = caseRangeClause(range);
    if (rc != null) where.append(" AND ").append(rc);

    String order = caseOrderBy(sort);

    String countSql = "SELECT COUNT(*) FROM cases c WHERE " + where;

    var lp = new ArrayList<>(params);
    lp.add(userId);
    int seenIdx = lp.size();

    String listSql = CASE_COLS
        + ", EXISTS(SELECT 1 FROM case_views cv WHERE cv.case_id = c.id AND cv.user_id = $" + seenIdx + ") AS seen"
        + CASE_FROM
        + " WHERE " + where + order
        + " LIMIT $"  + (lp.size() + 1)
        + " OFFSET $" + (lp.size() + 2);

    lp.add(pageSize);
    lp.add((long) (page - 1) * pageSize);

    Tuple base = buildTuple(params);
    Tuple listTuple = buildTuple(lp);

    return pool.preparedQuery(countSql).execute(base)
        .map(rs -> rs.iterator().next().getLong(0))
        .compose(total -> pool.preparedQuery(listSql).execute(listTuple)
            .map(rs -> {
              var list = new ArrayList<CaseRecord>();
              rs.forEach(r -> list.add(mapCase(r, r.getBoolean("seen"))));
              return new CasePage(List.copyOf(list), total, page, pageSize);
            }));
  }

  // ── Detail ───────────────────────────────────────────────────────────────

  public Future<Optional<CaseDetail>> detail(String id, long institutionId, long userId) {
    return findById(id, institutionId, userId).compose(opt -> {
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

  public Future<Optional<CaseRecord>> findCaseByTransaction(long institutionId, String transactionId, long userId) {
    String sql = CASE_COLS
        + ", EXISTS(SELECT 1 FROM case_views cv WHERE cv.case_id = c.id AND cv.user_id = $3) AS seen"
        + CASE_FROM
        + " JOIN case_transactions ct ON ct.case_id = c.id"
        + " WHERE ct.transaction_id = $1 AND c.institution_id = $2"
        + " ORDER BY c.created_at DESC LIMIT 1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(transactionId, institutionId, userId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Optional.empty();
          Row r = it.next();
          return Optional.of(mapCase(r, r.getBoolean("seen")));
        });
  }

  // ── Evidence ─────────────────────────────────────────────────────────────

  public Future<CaseEvidence> addEvidence(String caseId, Long addedBy,
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
        + " COALESCE(u.full_name, u.email, 'System') AS added_by_name,"
        + " e.category, e.title, e.detail, e.ref_id, e.created_at"
        + " FROM case_evidence e LEFT JOIN users u ON u.id = e.added_by"
        + " WHERE e.case_id = $1 ORDER BY e.created_at ASC";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(caseId))
        .map(rs -> {
          var list = new ArrayList<CaseEvidence>();
          rs.forEach(r -> {
            Object addedByVal = r.getValue("added_by");
            list.add(new CaseEvidence(
                r.getLong("id"),
                r.getString("case_id"),
                addedByVal != null ? ((Number) addedByVal).longValue() : null,
                r.getString("added_by_name"),
                r.getString("category"),
                r.getString("title"),
                r.getString("detail"),
                r.getString("ref_id"),
                r.getOffsetDateTime("created_at")));
          });
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

  public Future<Boolean> updatePriority(String caseId, String priority) {
    return pool.preparedQuery(
        "UPDATE cases SET priority=$1, updated_at=now() WHERE id=$2")
        .execute(Tuple.of(priority, caseId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Boolean> markAvailableForInvestigation(String caseId, long institutionId) {
    return pool.preparedQuery(
        "UPDATE cases SET is_available_for_investigation=true, updated_at=now() WHERE id=$1 AND institution_id=$2")
        .execute(Tuple.of(caseId, institutionId))
        .map(rs -> rs.rowCount() > 0);
  }

  public Future<Void> markSeen(String caseId, long institutionId, long userId) {
    return pool.preparedQuery(
            "INSERT INTO case_views (case_id, institution_id, user_id)"
            + " VALUES ($1, $2, $3) ON CONFLICT (case_id, user_id) DO NOTHING")
        .execute(Tuple.of(caseId, institutionId, userId))
        .mapEmpty();
  }

  public Future<Long> unseenCount(long institutionId, long userId) {
    String sql =
        "SELECT COUNT(*) FROM cases c"
        + " WHERE c.institution_id = $1"
        + "   AND c.is_available_for_investigation = true"
        + "   AND c.status != 'closed'"
        + "   AND NOT EXISTS ("
        + "     SELECT 1 FROM case_views cv WHERE cv.case_id = c.id AND cv.user_id = $2"
        + "   )";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, userId))
        .map(rs -> rs.iterator().next().getLong(0));
  }

  // ── Link NFIU report ──────────────────────────────────────────────────────

  public Future<Void> linkNfiuReport(String caseId, long institutionId, long nfiuReportId) {
    return pool.preparedQuery(
            "UPDATE cases SET linked_nfiu_report_id = $1, updated_at = now()"
            + " WHERE id = $2 AND institution_id = $3")
        .execute(Tuple.of(nfiuReportId, caseId, institutionId))
        .mapEmpty();
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

  public Future<Void> addActivity(String caseId, Long actorId, String action, String detail) {
    return pool.preparedQuery(
            "INSERT INTO case_activity(case_id,actor_id,action,detail) VALUES($1,$2,$3,$4)")
        .execute(Tuple.of(caseId, actorId, action, detail))
        .mapEmpty();
  }

  public Future<Void> addActivity(String caseId, Long actorId, String action, String detail, Long documentId) {
    return pool.preparedQuery(
            "INSERT INTO case_activity(case_id,actor_id,action,detail,document_id) VALUES($1,$2,$3,$4,$5)")
        .execute(Tuple.of(caseId, actorId, action, detail, documentId))
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

  private static CaseRecord mapCase(Row r, Boolean seen) {
    Object assignedToVal  = r.getValue("assigned_to");
    Object createdByVal   = r.getValue("created_by");
    Object linkedNfiuVal  = r.getValue("linked_nfiu_report_id");
    return new CaseRecord(
        r.getString("id"),
        r.getLong("institution_id"),
        r.getString("title"),
        r.getString("brief"),
        r.getString("typology"),
        r.getString("status"),
        r.getString("priority"),
        r.getInteger("risk_score"),
        assignedToVal != null ? ((Number) assignedToVal).longValue() : null,
        r.getString("assignee_name"),
        r.getString("notes"),
        r.getString("resolution"),
        createdByVal != null ? ((Number) createdByVal).longValue() : null,
        r.getString("created_by_name"),
        r.getOffsetDateTime("sla_deadline"),
        r.getOffsetDateTime("closed_at"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getBoolean("is_available_for_investigation"),
        seen != null && seen,
        linkedNfiuVal != null ? ((Number) linkedNfiuVal).longValue() : null,
        r.getString("customer_id"),
        r.getString("customer_name"));
  }

  private static CaseActivity mapActivity(Row r) {
    Object actorIdVal = r.getValue("actor_id");
    return new CaseActivity(
        r.getLong("id"),
        r.getString("case_id"),
        actorIdVal != null ? ((Number) actorIdVal).longValue() : null,
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
        r.getString("narration"), r.getString("device_id"), r.getString("ip_address"),
        false);
  }

  private static boolean isElevatedRole(String role) {
    return role != null && Set.of("owner", "admin", "compliance", "cmlco", "mlro").contains(role);
  }

  private static String caseOrderBy(String sort) {
    return switch (sort != null ? sort : "recent") {
      case "oldest"    -> " ORDER BY c.created_at ASC";
      case "priority"  -> " ORDER BY CASE c.status WHEN 'escalated' THEN 0 WHEN 'investigating'"
                          + " THEN 1 WHEN 'open' THEN 2 ELSE 3 END, c.sla_deadline ASC";
      case "risk_desc" -> " ORDER BY c.risk_score DESC, c.created_at DESC";
      case "risk_asc"  -> " ORDER BY c.risk_score ASC, c.created_at DESC";
      default          -> " ORDER BY c.created_at DESC";
    };
  }

  private static String caseRangeClause(String range) {
    if (range == null || range.isBlank() || "all".equals(range)) return null;
    return switch (range) {
      case "24h" -> "c.created_at > now() - interval '24 hours'";
      case "7d"  -> "c.created_at > now() - interval '7 days'";
      case "90d" -> "c.created_at > now() - interval '90 days'";
      case "ytd" -> "c.created_at >= date_trunc('year', now())";
      default    -> "c.created_at > now() - interval '30 days'";
    };
  }

  private static Tuple buildTuple(List<Object> params) {
    Tuple t = Tuple.tuple();
    params.forEach(t::addValue);
    return t;
  }
}
