package com.openiv.backend.customers;

import io.vertx.core.Future;
import io.vertx.core.json.JsonArray;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class CustomerBehavioralProfileRepository {
  private static final Logger log = LoggerFactory.getLogger(CustomerBehavioralProfileRepository.class);
  private final Pool pool;

  public CustomerBehavioralProfileRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<CustomerBehavioralProfile>> getProfile(long institutionId, String customerId) {
    return pool.preparedQuery(
        "SELECT * FROM customer_behavioral_profiles WHERE institution_id = $1 AND customer_id = $2"
    ).execute(Tuple.of(institutionId, customerId))
    .<Optional<CustomerBehavioralProfile>>map(rows -> {
      var it = rows.iterator();
      return it.hasNext() ? Optional.of(fromRow(it.next())) : Optional.empty();
    })
    .onFailure(e -> log.error("[BehavioralProfileRepo] getProfile failed for {}: {}", customerId, e.getMessage()));
  }

  /**
   * Recomputes the behavioral profile for a customer from their transaction history and upserts it.
   * Runs entirely in the DB — no large result sets returned to the application.
   */
  public Future<Void> upsertProfile(long institutionId, String customerId) {
    String sql =
        "INSERT INTO customer_behavioral_profiles "
        + " (institution_id, customer_id, avg_amount, stddev_amount, typical_channels, "
        + "  typical_hour_min, typical_hour_max, typical_days, typical_banks, typical_categories, "
        + "  transaction_count, updated_at) "
        + "SELECT "
        + "  $1, $2, "
        + "  COALESCE(AVG(amount), 0), "
        + "  COALESCE(STDDEV(amount), 0), "
        + "  COALESCE(("
        + "    SELECT jsonb_agg(DISTINCT channel) FROM transactions t2"
        + "    WHERE t2.institution_id = $1 AND t2.customer_id = $2"
        + "  ), '[]'::jsonb), "
        + "  COALESCE(MIN(EXTRACT(HOUR FROM occurred_at)::INT), 8), "
        + "  COALESCE(MAX(EXTRACT(HOUR FROM occurred_at)::INT), 20), "
        + "  COALESCE(("
        + "    SELECT jsonb_agg(DISTINCT EXTRACT(DOW FROM occurred_at)::INT) FROM transactions t3"
        + "    WHERE t3.institution_id = $1 AND t3.customer_id = $2"
        + "  ), '[0,1,2,3,4,5,6]'::jsonb), "
        + "  COALESCE(("
        + "    SELECT jsonb_agg(DISTINCT recipient_bank) FROM transactions t4"
        + "    WHERE t4.institution_id = $1 AND t4.customer_id = $2 AND recipient_bank IS NOT NULL"
        + "  ), '[]'::jsonb), "
        + "  COALESCE(("
        + "    SELECT jsonb_agg(DISTINCT category) FROM transactions t5"
        + "    WHERE t5.institution_id = $1 AND t5.customer_id = $2 AND category IS NOT NULL"
        + "  ), '[]'::jsonb), "
        + "  COUNT(*), NOW() "
        + "FROM transactions WHERE institution_id = $1 AND customer_id = $2 "
        + "ON CONFLICT (institution_id, customer_id) DO UPDATE SET "
        + "  avg_amount         = EXCLUDED.avg_amount, "
        + "  stddev_amount      = EXCLUDED.stddev_amount, "
        + "  typical_channels   = EXCLUDED.typical_channels, "
        + "  typical_hour_min   = EXCLUDED.typical_hour_min, "
        + "  typical_hour_max   = EXCLUDED.typical_hour_max, "
        + "  typical_days       = EXCLUDED.typical_days, "
        + "  typical_banks      = EXCLUDED.typical_banks, "
        + "  typical_categories = EXCLUDED.typical_categories, "
        + "  transaction_count  = EXCLUDED.transaction_count, "
        + "  updated_at         = NOW()";

    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, customerId))
        .<Void>mapEmpty()
        .onFailure(e -> log.error("[BehavioralProfileRepo] upsertProfile failed for {}: {}", customerId, e.getMessage()));
  }

  private CustomerBehavioralProfile fromRow(Row r) {
    // JSONB columns come back as JsonArray/JsonObject, not String — use getValue() then toString().
    Object cv = r.getValue("typical_channels"),  dv = r.getValue("typical_days"),
           bv = r.getValue("typical_banks"),      catv = r.getValue("typical_categories");
    String channelsJson   = cv   != null ? cv.toString()   : null;
    String daysJson       = dv   != null ? dv.toString()   : null;
    String banksJson      = bv   != null ? bv.toString()   : null;
    String categoriesJson = catv != null ? catv.toString() : null;

    List<String> channels   = jsonArrayToStrings(channelsJson);
    List<Integer> days      = jsonArrayToInts(daysJson);
    List<String> banks      = jsonArrayToStrings(banksJson);
    List<String> categories = jsonArrayToStrings(categoriesJson);

    var avg    = r.getNumeric("avg_amount");
    var stddev = r.getNumeric("stddev_amount");

    return new CustomerBehavioralProfile(
        r.getLong("institution_id"),
        r.getString("customer_id"),
        avg    != null ? avg.bigDecimalValue()    : BigDecimal.ZERO,
        stddev != null ? stddev.bigDecimalValue() : BigDecimal.ZERO,
        channels,
        r.getInteger("typical_hour_min"),
        r.getInteger("typical_hour_max"),
        days,
        banks,
        categories,
        r.getInteger("transaction_count")
    );
  }

  private static List<String> jsonArrayToStrings(String json) {
    List<String> result = new ArrayList<>();
    if (json == null || json.isBlank()) return result;
    try {
      JsonArray arr = new JsonArray(json);
      for (int i = 0; i < arr.size(); i++) {
        Object v = arr.getValue(i);
        if (v != null) result.add(v.toString());
      }
    } catch (Exception ignored) {}
    return result;
  }

  private static List<Integer> jsonArrayToInts(String json) {
    List<Integer> result = new ArrayList<>();
    if (json == null || json.isBlank()) return result;
    try {
      JsonArray arr = new JsonArray(json);
      for (int i = 0; i < arr.size(); i++) {
        Object v = arr.getValue(i);
        if (v instanceof Number n) result.add(n.intValue());
      }
    } catch (Exception ignored) {}
    return result;
  }
}
