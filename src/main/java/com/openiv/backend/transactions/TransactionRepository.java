package com.openiv.backend.transactions;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class TransactionRepository {

  private static final String SELECT_COLS =
      "id, institution_id, customer_id, customer_name, amount, channel, counterparty, "
      + "risk_score, status, flagged_status, location, lat, lng, occurred_at, created_at, updated_at, "
      + "sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, "
      + "currency, narration, device_id, ip_address, flag_reason, category, direction, flag_reasons";

  private final Pool pool;

  public TransactionRepository(Pool pool) {
    this.pool = pool;
  }

  public record TransactionPage(List<Transaction> transactions, long total, int page, int pageSize) {}

  public Future<TransactionPage> list(long institutionId, String status, String flaggedStatus,
      String q, int page, int pageSize, String range, String channel,
      Integer minRisk, Integer maxRisk, String sort, long userId) {

    var where  = new StringBuilder("institution_id = $1");
    var params = new ArrayList<Object>();
    params.add(institutionId);

    if (status != null && !status.isBlank()) {
      where.append(" AND status = $").append(params.size() + 1);
      params.add(status);
    }

    if (flaggedStatus != null && !flaggedStatus.isBlank()) {
      where.append(" AND flagged_status = $").append(params.size() + 1);
      params.add(flaggedStatus);
    }

    if (channel != null && !channel.isBlank()) {
      where.append(" AND channel = $").append(params.size() + 1);
      params.add(channel);
    }

    if (minRisk != null) {
      where.append(" AND risk_score >= $").append(params.size() + 1);
      params.add(minRisk);
    }

    if (maxRisk != null) {
      where.append(" AND risk_score <= $").append(params.size() + 1);
      params.add(maxRisk);
    }

    if (q != null && !q.isBlank()) {
      String like = "%" + q.toLowerCase() + "%";
      int n = params.size() + 1;
      where.append(" AND (LOWER(id) LIKE $").append(n)
           .append(" OR LOWER(customer_name) LIKE $").append(n + 1)
           .append(" OR LOWER(customer_id) LIKE $").append(n + 2).append(")");
      params.add(like);
      params.add(like);
      params.add(like);
    }

    where.append(" AND ").append(rangeClause(range));

    String orderBy = switch (sort != null ? sort : "recent") {
      case "event_desc"  -> "occurred_at DESC";
      case "oldest"      -> "created_at ASC";
      case "risk_desc"   -> "risk_score DESC, created_at DESC";
      case "risk_asc"    -> "risk_score ASC, created_at DESC";
      case "amount_desc" -> "amount DESC, created_at DESC";
      case "amount_asc"  -> "amount ASC, created_at DESC";
      default            -> "created_at DESC";
    };

    // Count query uses the filter params only (no userId, no pagination)
    Tuple baseTuple = buildTuple(params);

    // List query adds userId for the EXISTS subquery, then pageSize/offset
    var listBodyParams = new ArrayList<>(params);
    listBodyParams.add(userId);
    int userIdIdx = listBodyParams.size();

    String countSql = "SELECT COUNT(*) FROM transactions WHERE " + where;
    String listSql  = "SELECT " + SELECT_COLS
        + ", EXISTS(SELECT 1 FROM transaction_views tv WHERE tv.transaction_id = id AND tv.user_id = $" + userIdIdx + ") AS seen"
        + " FROM transactions WHERE " + where
        + " ORDER BY " + orderBy
        + " LIMIT $"  + (listBodyParams.size() + 1)
        + " OFFSET $" + (listBodyParams.size() + 2);

    listBodyParams.add(pageSize);
    listBodyParams.add((long) (page - 1) * pageSize);
    Tuple listTuple = buildTuple(listBodyParams);

    return pool.preparedQuery(countSql).execute(baseTuple)
        .map(rs -> rs.iterator().next().getLong(0))
        .compose(total -> pool.preparedQuery(listSql).execute(listTuple)
            .map(rs -> {
              var list = new ArrayList<Transaction>();
              rs.forEach(row -> list.add(mapList(row)));
              return new TransactionPage(List.copyOf(list), total, page, pageSize);
            }));
  }

  public Future<Integer> importBatch(long institutionId, List<TransactionImport> rows) {
    if (rows.isEmpty()) return Future.succeededFuture(0);

    // created_at is always the server ingestion timestamp — explicitly now(), never from the payload.
    // occurred_at is always from the payload — the time the transaction actually happened.
    // On re-ingestion of the same ID, occurred_at and updated_at refresh; created_at does NOT change
    // (it records when OpenIV first received the transaction).
    String sql =
        "INSERT INTO transactions"
        + " (id, institution_id, customer_id, customer_name, amount,"
        + "  channel, counterparty, risk_score, status, flagged_status, location, lat, lng, occurred_at,"
        + "  sender_account, sender_bank, recipient_name, recipient_account, recipient_bank,"
        + "  currency, narration, device_id, ip_address, category, direction, created_at)"
        + " VALUES ($1,$2,$3,$4,$5,"
        + "  $6,$7,$8,$9,$10::text,$11::text,$12::double precision,$13::double precision,$14,"
        + "  $15::text,$16::text,$17::text,$18::text,$19::text,"
        + "  $20,$21::text,$22::text,$23::text,$24::text,$25::text, now())"
        + " ON CONFLICT (id) DO UPDATE SET"
        + "   customer_name = EXCLUDED.customer_name, amount = EXCLUDED.amount,"
        + "   channel = EXCLUDED.channel, counterparty = EXCLUDED.counterparty,"
        + "   risk_score = EXCLUDED.risk_score, status = EXCLUDED.status,"
        + "   flagged_status = EXCLUDED.flagged_status,"
        + "   location = EXCLUDED.location, lat = EXCLUDED.lat, lng = EXCLUDED.lng,"
        + "   occurred_at = EXCLUDED.occurred_at,"
        + "   created_at = now(),"
        + "   sender_account = EXCLUDED.sender_account, sender_bank = EXCLUDED.sender_bank,"
        + "   recipient_name = EXCLUDED.recipient_name, recipient_account = EXCLUDED.recipient_account,"
        + "   recipient_bank = EXCLUDED.recipient_bank, currency = EXCLUDED.currency,"
        + "   narration = EXCLUDED.narration, device_id = EXCLUDED.device_id,"
        + "   ip_address = EXCLUDED.ip_address,"
        + "   category = EXCLUDED.category, direction = EXCLUDED.direction,"
        + "   updated_at = now()";

    List<Tuple> tuples = rows.stream().map(r -> {
      var p = new ArrayList<>();
      p.add(r.id());              p.add(institutionId);
      p.add(r.customerId());      p.add(r.customerName());
      p.add(r.amount());
      p.add(r.channel());         p.add(r.counterparty());
      p.add(r.riskScore());       p.add(r.status());
      p.add(r.flaggedStatus());   p.add(r.location());
      p.add(r.lat());             p.add(r.lng());
      p.add(r.occurredAt());
      p.add(r.senderAccount());   p.add(r.senderBank());
      p.add(r.recipientName());   p.add(r.recipientAccount());
      p.add(r.recipientBank());   p.add(r.currency() != null ? r.currency() : "NGN");
      p.add(r.narration());       p.add(r.deviceId());
      p.add(r.ipAddress());       p.add(r.category());
      p.add(r.direction() != null ? r.direction() : "outward");
      return buildTuple(p);
    }).toList();

    return pool.preparedQuery(sql).executeBatch(tuples).map(ignored -> rows.size());
  }

  public Future<List<Transaction>> exportAll(long institutionId, String status, String flaggedStatus,
      String q, String range, String channel, Integer minRisk, Integer maxRisk) {

    var where  = new StringBuilder("institution_id = $1");
    var params = new ArrayList<Object>();
    params.add(institutionId);

    if (status != null && !status.isBlank()) {
      where.append(" AND status = $").append(params.size() + 1);
      params.add(status);
    }

    if (flaggedStatus != null && !flaggedStatus.isBlank()) {
      where.append(" AND flagged_status = $").append(params.size() + 1);
      params.add(flaggedStatus);
    }

    if (channel != null && !channel.isBlank()) {
      where.append(" AND channel = $").append(params.size() + 1);
      params.add(channel);
    }

    if (minRisk != null) {
      where.append(" AND risk_score >= $").append(params.size() + 1);
      params.add(minRisk);
    }

    if (maxRisk != null) {
      where.append(" AND risk_score <= $").append(params.size() + 1);
      params.add(maxRisk);
    }

    if (q != null && !q.isBlank()) {
      String like = "%" + q.toLowerCase() + "%";
      int n = params.size() + 1;
      where.append(" AND (LOWER(id) LIKE $").append(n)
           .append(" OR LOWER(customer_name) LIKE $").append(n + 1)
           .append(" OR LOWER(customer_id) LIKE $").append(n + 2).append(")");
      params.add(like);
      params.add(like);
      params.add(like);
    }

    where.append(" AND ").append(rangeClause(range));

    String sql = "SELECT " + SELECT_COLS + " FROM transactions WHERE " + where
        + " ORDER BY occurred_at DESC LIMIT 10000";

    return pool.preparedQuery(sql).execute(buildTuple(params))
        .map(rs -> {
          var list = new ArrayList<Transaction>();
          rs.forEach(row -> list.add(map(row)));
          return List.copyOf(list);
        });
  }

  /**
   * Returns the most recent transaction for {@code customerId} that carries
   * coordinates, excluding the transaction with id {@code excludeId} (the one
   * just ingested), within the last 24 hours.  Used for geo-velocity checking.
   */
  public Future<Optional<Transaction>> findLastWithLocation(
      long institutionId, String customerId, String excludeId) {
    String sql = "SELECT " + SELECT_COLS
        + ", false AS seen"
        + " FROM transactions"
        + " WHERE institution_id = $1"
        + "   AND customer_id   = $2"
        + "   AND id           <> $3"
        + "   AND lat IS NOT NULL AND lng IS NOT NULL"
        + "   AND occurred_at  >  now() - interval '24 hours'"
        + " ORDER BY occurred_at DESC"
        + " LIMIT 1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, excludeId))
        .map(rs -> rs.rowCount() == 0
            ? Optional.<Transaction>empty()
            : Optional.of(mapList(rs.iterator().next())));
  }

  /**
   * Returns the occurred_at of the most recent transaction for {@code customerId},
   * excluding the current transaction {@code excludeId}.  Empty when no prior transaction exists.
   * Used to detect dormant account reactivation (gap > 90 days).
   */
  public Future<Optional<java.time.OffsetDateTime>> findPreviousTransactionDate(
      long institutionId, String customerId, String excludeId) {
    String sql = "SELECT occurred_at FROM transactions "
        + "WHERE institution_id = $1 AND customer_id = $2 AND id <> $3 "
        + "ORDER BY occurred_at DESC LIMIT 1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId, excludeId))
        .map(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Optional.<java.time.OffsetDateTime>empty();
          var odt = it.next().getOffsetDateTime("occurred_at");
          return odt != null ? Optional.of(odt) : Optional.<java.time.OffsetDateTime>empty();
        });
  }

  /** Returns the customer ID already associated with {@code senderAccount} for this institution,
   *  excluding {@code excludeCustomerId} (the customer who just sent the transaction).
   *  A non-empty result means the account number appears under a different customer — suspicious. */
  public Future<Optional<String>> findCustomerBySenderAccount(
      long institutionId, String senderAccount, String excludeCustomerId) {
    if (senderAccount == null || senderAccount.isBlank())
      return Future.succeededFuture(Optional.empty());
    String sql = "SELECT customer_id FROM transactions "
        + "WHERE institution_id = $1 AND sender_account = $2 "
        + "  AND customer_id IS NOT NULL AND customer_id <> '' AND customer_id <> $3 "
        + "ORDER BY created_at DESC LIMIT 1";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, senderAccount, excludeCustomerId))
        .map(rs -> rs.rowCount() == 0
            ? Optional.empty()
            : Optional.of(rs.iterator().next().getString("customer_id")));
  }

  public Future<Optional<Transaction>> findById(String id, long institutionId) {
    String sql = "SELECT " + SELECT_COLS + ", FALSE AS seen FROM transactions WHERE id = $1 AND institution_id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(id, institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapList(it.next())) : Optional.empty();
        });
  }

  public Future<Void> markSeen(String transactionId, long institutionId, long userId) {
    return pool.preparedQuery(
            "INSERT INTO transaction_views (transaction_id, institution_id, user_id)"
            + " VALUES ($1, $2, $3) ON CONFLICT (transaction_id, user_id) DO NOTHING")
        .execute(Tuple.of(transactionId, institutionId, userId))
        .mapEmpty();
  }

  public Future<Long> unseenCount(long institutionId, long userId) {
    return pool.preparedQuery(
            "SELECT COUNT(*) FROM transactions t"
            + " WHERE t.institution_id = $1"
            + "   AND NOT EXISTS ("
            + "     SELECT 1 FROM transaction_views tv"
            + "     WHERE tv.transaction_id = t.id AND tv.user_id = $2"
            + "   )")
        .execute(Tuple.of(institutionId, userId))
        .map(rs -> rs.iterator().next().getLong(0));
  }

  public Future<Void> markFlagged(String transactionId, long institutionId) {
    return pool.preparedQuery(
            "UPDATE transactions SET flagged_status = 'flagged', updated_at = now()"
            + " WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(transactionId, institutionId))
        .mapEmpty();
  }

  public Future<Void> markFlaggedWithRiskScore(String transactionId, long institutionId, int riskScore) {
    return pool.preparedQuery(
            "UPDATE transactions SET flagged_status = 'flagged', risk_score = $3, updated_at = now()"
            + " WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(transactionId, institutionId, riskScore))
        .mapEmpty();
  }

  public Future<Void> markFlaggedWithReason(String transactionId, long institutionId, int riskScore, String reason) {
    return pool.preparedQuery(
            "UPDATE transactions SET flagged_status = 'flagged', risk_score = $3, flag_reason = $4, updated_at = now()"
            + " WHERE id = $1 AND institution_id = $2")
        .execute(Tuple.of(transactionId, institutionId, riskScore, reason))
        .mapEmpty();
  }

  public Future<Void> bulkUpdateFlaggedStatus(List<String> ids, long institutionId,
      String newFlaggedStatus, String reason, long documentId) {
    if (ids.isEmpty()) return Future.succeededFuture();
    String[] arr = ids.toArray(new String[0]);
    return pool.preparedQuery(
            "UPDATE transactions SET flagged_status = $1, status_reason = $2,"
            + " status_document_id = $3, updated_at = now()"
            + " WHERE id = ANY($4::text[]) AND institution_id = $5")
      .execute(Tuple.of(newFlaggedStatus, reason, documentId, arr, institutionId))
      .mapEmpty();
  }

  public Future<Long> countByInstitutionAndDate(long institutionId, java.time.LocalDate date) {
    return pool.preparedQuery(
        "SELECT COUNT(*) FROM transactions WHERE institution_id = $1 AND occurred_at::date = $2")
      .execute(Tuple.of(institutionId, date))
      .map(rs -> rs.iterator().next().getLong(0));
  }

  public Future<Long> countByCustomerLast24h(long institutionId, String customerId) {
    return pool.preparedQuery(
        "SELECT COUNT(*) FROM transactions WHERE institution_id = $1 AND customer_id = $2 AND occurred_at > now() - interval '24 hours'")
      .execute(Tuple.of(institutionId, customerId))
      .map(rs -> rs.iterator().next().getLong(0));
  }

  public Future<double[][]> getHeatmap(long institutionId, String userId, String range) {
    // Date-range filter uses created_at (system ingestion time), not occurred_at.
    String rangeClause = switch (range != null ? range : "90d") {
      case "24h" -> "created_at > now() - interval '24 hours'";
      case "7d"  -> "created_at > now() - interval '7 days'";
      case "30d" -> "created_at > now() - interval '30 days'";
      default    -> "created_at > now() - interval '90 days'";
    };
    String sql =
        "SELECT EXTRACT(DOW FROM occurred_at)::int as dow, EXTRACT(HOUR FROM occurred_at)::int as hour, SUM(amount) as volume"
        + " FROM transactions"
        + " WHERE institution_id = $1 AND customer_id = $2"
        + " AND " + rangeClause
        + " GROUP BY 1, 2";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, userId))
        .map(rs -> {
          double[][] heatmap = new double[7][24];
          double max = 0;
          for (var row : rs) {
            int d = row.getInteger("dow");
            int h = row.getInteger("hour");
            java.math.BigDecimal vol = row.getBigDecimal("volume");
            double v = (vol != null) ? vol.doubleValue() : 0.0;
            heatmap[d][h] = v;
            if (v > max) max = v;
          }
          if (max > 0) {
            for (int d = 0; d < 7; d++) {
              for (int h = 0; h < 24; h++) {
                heatmap[d][h] = heatmap[d][h] / max;
              }
            }
          }
          return heatmap;
        });
  }

  private static String rangeClause(String range) {
    // Date-range filter uses created_at (system ingestion time), not occurred_at.
    return switch (range != null ? range : "30d") {
      case "24h" -> "created_at > now() - interval '24 hours'";
      case "7d"  -> "created_at > now() - interval '7 days'";
      case "90d" -> "created_at > now() - interval '90 days'";
      case "ytd" -> "created_at >= date_trunc('year', now())";
      default    -> "created_at > now() - interval '30 days'";
    };
  }

  private static Tuple buildTuple(List<Object> params) {
    Tuple t = Tuple.tuple();
    params.forEach(t::addValue);
    return t;
  }

  private static Transaction mapList(Row r) {
    Boolean seen = r.getBoolean("seen");
    return buildTransaction(r, seen != null && seen);
  }

  private static Transaction map(Row r) {
    return buildTransaction(r, false);
  }

  private static Transaction buildTransaction(Row r, boolean seen) {
    // Deserialize flag_reasons JSONB array → List<String>
    java.util.List<String> flagReasons = new java.util.ArrayList<>();
    String flagReasonsJson = r.getString("flag_reasons");
    if (flagReasonsJson != null && !flagReasonsJson.isBlank()) {
      try {
        io.vertx.core.json.JsonArray arr = new io.vertx.core.json.JsonArray(flagReasonsJson);
        for (int i = 0; i < arr.size(); i++) flagReasons.add(arr.getString(i));
      } catch (Exception ignored) {}
    }
    String dir = r.getString("direction");
    return new Transaction(
        r.getString("id"),
        r.getLong("institution_id"),
        r.getString("customer_id"),
        r.getString("customer_name"),
        r.getBigDecimal("amount"),
        r.getString("channel"),
        r.getString("counterparty"),
        r.getInteger("risk_score"),
        r.getString("status"),
        r.getString("flagged_status"),
        r.getString("location"),
        r.getDouble("lat"),
        r.getDouble("lng"),
        r.getOffsetDateTime("occurred_at"),
        r.getOffsetDateTime("created_at"),
        r.getOffsetDateTime("updated_at"),
        r.getString("sender_account"),
        r.getString("sender_bank"),
        r.getString("recipient_name"),
        r.getString("recipient_account"),
        r.getString("recipient_bank"),
        r.getString("currency"),
        r.getString("narration"),
        r.getString("device_id"),
        r.getString("ip_address"),
        seen,
        r.getString("flag_reason"),
        r.getString("category"),
        dir != null ? dir : "outward",
        java.util.List.copyOf(flagReasons));
  }
}
