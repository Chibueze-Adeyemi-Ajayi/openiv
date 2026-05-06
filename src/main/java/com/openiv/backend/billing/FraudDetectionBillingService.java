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
    long amountUnits = amount.multiply(new BigDecimal("10000")).longValue();
    return pool.preparedQuery("SELECT bw.id, bw.balance_units FROM billing_wallets bw WHERE bw.institution_id = $1")
        .execute(Tuple.of(instId))
        .compose(rs -> {
          if (rs.size() == 0) return Future.failedFuture(
              new IllegalStateException("No balance for institution " + instId));
          var row = rs.iterator().next();
          long walletId = row.getLong("id");
          long beforeUnits = row.getLong("balance_units");
          long afterUnits = beforeUnits - amountUnits;
          if (afterUnits < 0) return Future.failedFuture(
              new IllegalStateException("Insufficient balance"));
          return pool.preparedQuery(
              "UPDATE billing_wallets SET balance_units = $1 WHERE id = $2")
              .execute(Tuple.of(afterUnits, walletId))
              .compose(v -> createLedger(instId, walletId, txnId, type, amountUnits,
                  new BigDecimal(beforeUnits).divide(new BigDecimal("10000")),
                  new BigDecimal(afterUnits).divide(new BigDecimal("10000"))));
        });
  }

  private Future<BillingRecord> createLedger(long instId, long walletId, String txnId, String type,
      long amountUnits, BigDecimal before, BigDecimal after) {
    String ref = "LEDGER-" + YearMonth.now() + "-" + txnId;
    return pool.preparedQuery("INSERT INTO billing_ledger " +
        "(institution_id, wallet_id, type, category, amount_units, balance_units, description, ref) " +
        "VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, created_at")
        .execute(Tuple.of(instId, walletId, "debit", type, amountUnits,
            after.multiply(new BigDecimal("10000")).longValue(), type + " charge for " + txnId, ref))
        .map(rs -> {
          var r = rs.iterator().next();
          return new BillingRecord(r.getLong("id"), instId, txnId, type,
              new BigDecimal(amountUnits).divide(new BigDecimal("10000")), before, after, ref,
              r.getOffsetDateTime("created_at"));
        });
  }

  public Future<BigDecimal> getBalance(long instId) {
    return pool.preparedQuery("SELECT balance_units FROM billing_wallets WHERE institution_id = $1")
        .execute(Tuple.of(instId))
        .map(rs -> {
          if (rs.size() == 0) return BigDecimal.ZERO;
          long units = rs.iterator().next().getLong("balance_units");
          return new BigDecimal(units).divide(new BigDecimal("10000"));
        });
  }

  public void chargeBeamIngestAsync(long institutionId, String recordId) {
    chargeInstitution(institutionId, recordId, "beam_ingest", PRICE_TRANSACTION)
        .onSuccess(r -> log.info("[FraudDetectionBilling] Charged beam ingest: {}", recordId))
        .onFailure(e -> log.warn("[FraudDetectionBilling] Failed to charge beam ingest: {}", e.getMessage()));
  }
}
