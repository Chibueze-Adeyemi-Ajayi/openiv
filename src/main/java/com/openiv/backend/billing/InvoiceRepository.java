package com.openiv.backend.billing;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public final class InvoiceRepository {

  private final Pool db;

  public InvoiceRepository(Pool db) {
    this.db = db;
  }

  public Future<SubscriptionInvoice> createInvoice(
      long institutionId, String planId, String type,
      BigDecimal amount, BigDecimal discountPct, BigDecimal discountedAmount,
      String couponCode, OffsetDateTime couponExpiresAt) {
    return db.preparedQuery("""
        INSERT INTO subscription_invoices
          (institution_id, plan_id, invoice_type, amount_ngn, discount_percent,
           discounted_amount_ngn, coupon_code, coupon_expires_at)
        VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8)
        RETURNING *
        """)
        .execute(Tuple.tuple()
            .addLong(institutionId)
            .addString(planId)
            .addString(type)
            .addBigDecimal(amount)
            .addBigDecimal(discountPct)
            .addBigDecimal(discountedAmount)
            .addValue(couponCode)
            .addValue(couponExpiresAt))
        .map(rs -> mapInvoice(rs.iterator().next()));
  }

  public Future<Optional<SubscriptionInvoice>> findByReference(String reference) {
    return db.preparedQuery("""
        SELECT * FROM subscription_invoices WHERE paystack_reference = $1
        """)
        .execute(Tuple.of(reference))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapInvoice(it.next())) : Optional.empty();
        });
  }

  /** Pending invoice with a valid (non-expired) coupon for this institution. */
  public Future<Optional<SubscriptionInvoice>> findActiveForInstitution(long institutionId) {
    return db.preparedQuery("""
        SELECT * FROM subscription_invoices
        WHERE institution_id = $1
          AND status = 'pending'
          AND (coupon_expires_at IS NULL OR coupon_expires_at > now())
        ORDER BY created_at DESC
        LIMIT 1
        """)
        .execute(Tuple.of(institutionId))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapInvoice(it.next())) : Optional.empty();
        });
  }

  public Future<Void> markPaid(UUID id, String reference) {
    return db.preparedQuery("""
        UPDATE subscription_invoices
        SET status = 'paid', paystack_reference = $2, paid_at = now()
        WHERE id = $1
        """)
        .execute(Tuple.of(id, reference))
        .mapEmpty();
  }

  /** Update paystack reference on an invoice (after initialization). */
  public Future<Void> updateReference(UUID id, String reference) {
    return db.preparedQuery("""
        UPDATE subscription_invoices SET paystack_reference = $2 WHERE id = $1
        """)
        .execute(Tuple.of(id, reference))
        .mapEmpty();
  }

  /** Cancel all pending invoices for this institution. */
  public Future<Void> cancelPendingForInstitution(long institutionId) {
    return db.preparedQuery("""
        UPDATE subscription_invoices
        SET status = 'cancelled'
        WHERE institution_id = $1 AND status = 'pending'
        """)
        .execute(Tuple.of(institutionId))
        .mapEmpty();
  }

  /** Mark pending invoices where coupon_expires_at < now() as 'expired'. */
  public Future<Integer> expireStaleInvoices() {
    return db.preparedQuery("""
        UPDATE subscription_invoices
        SET status = 'expired'
        WHERE status = 'pending'
          AND coupon_expires_at IS NOT NULL
          AND coupon_expires_at < now()
        """)
        .execute()
        .map(rs -> rs.rowCount());
  }

  /** Check if a renewal invoice was paid since a given date. */
  public Future<Boolean> hasPaidRenewalSince(long institutionId, OffsetDateTime since) {
    return db.preparedQuery("""
        SELECT COUNT(*) > 0 AS found
        FROM subscription_invoices
        WHERE institution_id = $1
          AND invoice_type = 'renewal'
          AND status = 'paid'
          AND paid_at >= $2
        """)
        .execute(Tuple.of(institutionId, since))
        .map(rs -> rs.iterator().next().getBoolean("found"));
  }

  public Future<Boolean> hasReminderBeenSent(long institutionId, String type, LocalDate forDate) {
    return db.preparedQuery("""
        SELECT COUNT(*) > 0 AS found
        FROM subscription_reminder_log
        WHERE institution_id = $1 AND reminder_type = $2 AND for_renewal_date = $3
        """)
        .execute(Tuple.of(institutionId, type, forDate))
        .map(rs -> rs.iterator().next().getBoolean("found"));
  }

  public Future<Void> logReminder(long institutionId, String type, LocalDate forDate, UUID invoiceId) {
    return db.preparedQuery("""
        INSERT INTO subscription_reminder_log (institution_id, reminder_type, for_renewal_date, invoice_id)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (institution_id, reminder_type, for_renewal_date) DO NOTHING
        """)
        .execute(Tuple.tuple()
            .addLong(institutionId)
            .addString(type)
            .addValue(forDate)
            .addValue(invoiceId))
        .mapEmpty();
  }

  /**
   * Returns institution IDs where subscription_renews_at is approximately daysAhead days from now
   * (within a ±12h window), status = 'active' or 'trial', not blocked, not enterprise slug.
   */
  public Future<List<Long>> findInstitutionsForReminder(int daysAhead) {
    return db.preparedQuery("""
        SELECT i.id
        FROM institutions i
        JOIN subscription_plans sp ON sp.id = i.plan_id
        WHERE i.subscription_status IN ('active','trial')
          AND (i.subscription_blocked IS NULL OR i.subscription_blocked = FALSE)
          AND sp.slug != 'enterprise'
          AND i.subscription_renews_at BETWEEN
              (now() + ($1 || ' days')::interval - INTERVAL '12 hours')
              AND
              (now() + ($1 || ' days')::interval + INTERVAL '12 hours')
        """)
        .execute(Tuple.of(String.valueOf(daysAhead)))
        .map(rs -> {
          var list = new ArrayList<Long>();
          rs.forEach(row -> list.add(row.getLong("id")));
          return list;
        });
  }

  private static SubscriptionInvoice mapInvoice(Row row) {
    return new SubscriptionInvoice(
        row.getUUID("id"),
        row.getLong("institution_id"),
        row.getUUID("plan_id").toString(),
        row.getString("invoice_type"),
        row.getBigDecimal("amount_ngn"),
        row.getBigDecimal("discount_percent"),
        row.getBigDecimal("discounted_amount_ngn"),
        row.getString("coupon_code"),
        row.getOffsetDateTime("coupon_expires_at"),
        row.getString("paystack_reference"),
        row.getString("status"),
        row.getOffsetDateTime("created_at"),
        row.getOffsetDateTime("paid_at")
    );
  }
}
