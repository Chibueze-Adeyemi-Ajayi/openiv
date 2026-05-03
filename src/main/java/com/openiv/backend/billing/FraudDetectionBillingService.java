package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Tuple;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.YearMonth;

/**
 * Manages institution billing for fraud detection transaction analysis.
 * Separate from wallet-based billing system.
 */
public class FraudDetectionBillingService {
  private static final Logger log = LoggerFactory.getLogger(FraudDetectionBillingService.class);
  private final Pool pool;

  private static final BigDecimal PRICE_TRANSACTION = new BigDecimal("10.00");
  private static final BigDecimal PRICE_CASE = new BigDecimal("50.00");
  private static final BigDecimal PRICE_AI = new BigDecimal("100.00");

  public record BillingRecord(long id, long institutionId, String transactionId, String type,
      BigDecimal amount, BigDecimal balanceBefore, BigDecimal balanceAfter,
      String reference, OffsetDateTime createdAt) {}

  public FraudDetectionBillingService(Pool pool) {
    this.pool = pool;
  }

  public Future<BillingRecord> chargeForTransaction(long institutionId, String txnId,
      boolean caseCreated, boolean aiAnalyzed) {
    BigDecimal charge = PRICE_TRANSACTION;
    var type = new StringBuilder("transaction");
    if (caseCreated) { charge = charge.add(PRICE_CASE); type.append("+case"); }
    if (aiAnalyzed) { charge = charge.add(PRICE_AI); type.append("+ai"); }
    return chargeInstitution(institutionId, txnId, type.toString(), charge);
  }

  private Future<BillingRecord> chargeInstitution(long instId, String txnId,
      String type, BigDecimal amount) {
    return pool.preparedQuery("SELECT balance FROM institution_balances WHERE institution_id = $1")
        .execute(Tuple.of(instId))
        .compose(rs -> {
          if (rs.size() == 0) return Future.failedFuture(
              new IllegalStateException("No balance for institution " + instId));
          BigDecimal before = rs.iterator().next().getBigDecimal(0);
          BigDecimal after = before.subtract(amount);
          if (after.compareTo(BigDecimal.ZERO) < 0) return Future.failedFuture(
              new IllegalStateException("Insufficient balance"));
          return pool.preparedQuery(
              "UPDATE institution_balances SET balance = $1 WHERE institution_id = $2")
              .execute(Tuple.of(after, instId))
              .compose(v -> createLedger(instId, txnId, type, amount, before, after));
        });
  }

  private Future<BillingRecord> createLedger(long instId, String txnId, String type,
      BigDecimal amt, BigDecimal before, BigDecimal after) {
    String ref = "LEDGER-" + YearMonth.now() + "-" + txnId;
    return pool.preparedQuery("INSERT INTO institution_ledger " +
        "(institution_id, transaction_id, type, amount, balance_before, balance_after, reference) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *")
        .execute(Tuple.of(instId, txnId, type, amt, before, after, ref))
        .map(rs -> {
          var r = rs.iterator().next();
          return new BillingRecord(r.getLong("id"), r.getLong("institution_id"),
              r.getString("transaction_id"), r.getString("type"), r.getBigDecimal("amount"),
              r.getBigDecimal("balance_before"), r.getBigDecimal("balance_after"),
              r.getString("reference"), r.getOffsetDateTime("created_at"));
        });
  }

  public Future<BigDecimal> getBalance(long instId) {
    return pool.preparedQuery("SELECT balance FROM institution_balances WHERE institution_id = $1")
        .execute(Tuple.of(instId))
        .map(rs -> rs.size() > 0 ? rs.iterator().next().getBigDecimal(0) : BigDecimal.ZERO);
  }

  public void chargeBeamIngestAsync(long institutionId, String recordId) {
    chargeInstitution(institutionId, recordId, "beam_ingest", PRICE_TRANSACTION)
        .onSuccess(r -> log.info("[FraudDetectionBilling] Charged beam ingest: {}", recordId))
        .onFailure(e -> log.warn("[FraudDetectionBilling] Failed to charge beam ingest: {}", e.getMessage()));
  }
}
