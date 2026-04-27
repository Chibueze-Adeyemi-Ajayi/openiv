package com.openiv.backend.transactions;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;

public final class TransactionRepository {

  private static final String SELECT_COLS =
      "id, institution_id, customer_id, customer_name, amount, channel, counterparty, "
      + "risk_score, status, flagged_status, location, lat, lng, occurred_at, created_at, updated_at, "
      + "sender_account, sender_bank, recipient_name, recipient_account, recipient_bank, "
      + "currency, narration, device_id, ip_address";

  private final Pool pool;

  public TransactionRepository(Pool pool) {
    this.pool = pool;
  }

  public record TransactionPage(List<Transaction> transactions, long total, int page, int pageSize) {}

  public Future<TransactionPage> list(long institutionId, String status, String flaggedStatus,
      String q, int page, int pageSize, String range, String channel,
      Integer minRisk, Integer maxRisk) {

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

    String countSql = "SELECT COUNT(*) FROM transactions WHERE " + where;
    String listSql  = "SELECT " + SELECT_COLS + " FROM transactions WHERE " + where
        + " ORDER BY occurred_at DESC"
        + " LIMIT $"  + (params.size() + 1)
        + " OFFSET $" + (params.size() + 2);

    Tuple baseTuple = buildTuple(params);

    var listParams = new ArrayList<>(params);
    listParams.add(pageSize);
    listParams.add((long) (page - 1) * pageSize);
    Tuple listTuple = buildTuple(listParams);

    return pool.preparedQuery(countSql).execute(baseTuple)
        .map(rs -> rs.iterator().next().getLong(0))
        .compose(total -> pool.preparedQuery(listSql).execute(listTuple)
            .map(rs -> {
              var list = new ArrayList<Transaction>();
              rs.forEach(row -> list.add(map(row)));
              return new TransactionPage(List.copyOf(list), total, page, pageSize);
            }));
  }

  public Future<Integer> importBatch(long institutionId, List<TransactionImport> rows) {
    if (rows.isEmpty()) return Future.succeededFuture(0);

    String sql =
        "INSERT INTO transactions"
        + " (id, institution_id, customer_id, customer_name, amount,"
        + "  channel, counterparty, risk_score, status, flagged_status, location, lat, lng, occurred_at,"
        + "  sender_account, sender_bank, recipient_name, recipient_account, recipient_bank,"
        + "  currency, narration, device_id, ip_address)"
        + " VALUES ($1,$2,$3,$4,$5,"
        + "  $6,$7,$8,$9,$10::text,$11::text,$12::double precision,$13::double precision,$14,"
        + "  $15::text,$16::text,$17::text,$18::text,$19::text,"
        + "  $20,$21::text,$22::text,$23::text)"
        + " ON CONFLICT (id) DO UPDATE SET"
        + "   customer_name = EXCLUDED.customer_name, amount = EXCLUDED.amount,"
        + "   channel = EXCLUDED.channel, counterparty = EXCLUDED.counterparty,"
        + "   risk_score = EXCLUDED.risk_score, status = EXCLUDED.status,"
        + "   flagged_status = EXCLUDED.flagged_status,"
        + "   location = EXCLUDED.location, lat = EXCLUDED.lat, lng = EXCLUDED.lng,"
        + "   occurred_at = EXCLUDED.occurred_at,"
        + "   sender_account = EXCLUDED.sender_account, sender_bank = EXCLUDED.sender_bank,"
        + "   recipient_name = EXCLUDED.recipient_name, recipient_account = EXCLUDED.recipient_account,"
        + "   recipient_bank = EXCLUDED.recipient_bank, currency = EXCLUDED.currency,"
        + "   narration = EXCLUDED.narration, device_id = EXCLUDED.device_id,"
        + "   ip_address = EXCLUDED.ip_address, updated_at = now()";

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
      p.add(r.ipAddress());
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

  private static String rangeClause(String range) {
    return switch (range != null ? range : "30d") {
      case "24h" -> "occurred_at > now() - interval '24 hours'";
      case "7d"  -> "occurred_at > now() - interval '7 days'";
      case "90d" -> "occurred_at > now() - interval '90 days'";
      case "ytd" -> "occurred_at >= date_trunc('year', now())";
      default    -> "occurred_at > now() - interval '30 days'";
    };
  }

  private static Tuple buildTuple(List<Object> params) {
    Tuple t = Tuple.tuple();
    params.forEach(t::addValue);
    return t;
  }

  private static Transaction map(Row r) {
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
        r.getString("ip_address"));
  }
}
