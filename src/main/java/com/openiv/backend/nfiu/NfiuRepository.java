package com.openiv.backend.nfiu;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.RowSet;
import io.vertx.sqlclient.Tuple;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class NfiuRepository {

  private final Pool pool;

  public NfiuRepository(Pool pool) {
    this.pool = pool;
  }

  // ── Metrics ───────────────────────────────────────────────────────────────

  public Future<NfiuMetrics> getMetrics(long institutionId) {
    String statsSql = """
        SELECT
          COUNT(*) FILTER (WHERE status IN ('filed','acknowledged'))                             AS total_filed,
          COUNT(*) FILTER (WHERE status = 'draft')                                               AS total_draft,
          COUNT(*) FILTER (WHERE status = 'acknowledged')                                        AS total_acknowledged,
          COUNT(*) FILTER (WHERE status = 'rejected')                                            AS total_rejected,
          COUNT(*) FILTER (WHERE status IN ('filed','acknowledged')
            AND filing_date >= DATE_TRUNC('month', now()))                                       AS filed_this_month
        FROM nfiu_reports WHERE institution_id = $1
        """;
    String dueSql = """
        SELECT COUNT(*) AS due_count
        FROM nfiu_schedules
        WHERE institution_id = $1 AND is_active = true
          AND next_due <= CURRENT_DATE + INTERVAL '7 days'
        """;

    return Future.all(
        pool.preparedQuery(statsSql).execute(Tuple.of(institutionId)),
        pool.preparedQuery(dueSql).execute(Tuple.of(institutionId))
    ).map(cf -> {
      Row stats = cf.<RowSet<Row>>resultAt(0).iterator().next();
      Row sched = cf.<RowSet<Row>>resultAt(1).iterator().next();
      return new NfiuMetrics(
          stats.getInteger("total_filed"),
          stats.getInteger("total_draft"),
          stats.getInteger("total_acknowledged"),
          stats.getInteger("total_rejected"),
          sched.getInteger("due_count"),
          stats.getInteger("filed_this_month")
      );
    });
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  public Future<List<NfiuReport>> listReports(long institutionId, String type, String status) {
    String sql = """
        SELECT * FROM nfiu_reports
        WHERE institution_id = $1
          AND ($2::text IS NULL OR report_type = $2)
          AND ($3::text IS NULL OR status = $3)
        ORDER BY created_at DESC
        LIMIT 200
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, type, status))
        .map(rs -> {
          List<NfiuReport> list = new ArrayList<>();
          rs.forEach(row -> list.add(mapReport(row)));
          return list;
        });
  }

  public Future<Optional<NfiuReport>> findReport(long institutionId, long id) {
    String sql = "SELECT * FROM nfiu_reports WHERE institution_id = $1 AND id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id))
        .map(rs -> {
          var it = rs.iterator();
          return it.hasNext() ? Optional.of(mapReport(it.next())) : Optional.empty();
        });
  }

  public Future<NfiuReport> createReport(long institutionId, String reportType,
      String title, LocalDate periodStart, LocalDate periodEnd, String priority,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      Double amountNgn, int transactionCount, String narrative) {

    String yearMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
    String abbrev    = abbrev(reportType);

    // Count existing reports of this type this month to build sequence
    String seqSql = """
        SELECT COUNT(*) + 1 AS seq FROM nfiu_reports
        WHERE institution_id = $1 AND report_type = $2
          AND TO_CHAR(created_at, 'YYYYMM') = $3
        """;
    return pool.preparedQuery(seqSql)
        .execute(Tuple.of(institutionId, reportType, yearMonth))
        .compose(rs -> {
          int seq       = rs.iterator().next().getInteger("seq");
          String ref    = abbrev + "-" + yearMonth + "-" + String.format("%04d", seq);
          String sql = """
              INSERT INTO nfiu_reports
                (institution_id, report_type, reference, title, period_start, period_end,
                 priority, subject_name, subject_account, subject_bvn, subject_type,
                 amount_ngn, transaction_count, narrative)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
              RETURNING *
              """;
          return pool.preparedQuery(sql).execute(Tuple.of(
              institutionId, reportType, ref, title, periodStart, periodEnd,
              priority, subjectName, subjectAccount, subjectBvn, subjectType,
              amountNgn, transactionCount, narrative
          )).map(ins -> mapReport(ins.iterator().next()));
        });
  }

  public Future<NfiuReport> updateReport(long institutionId, long id,
      String title, LocalDate periodStart, LocalDate periodEnd, String priority,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      Double amountNgn, int transactionCount, String narrative) {
    String sql = """
        UPDATE nfiu_reports SET
          title             = COALESCE($3, title),
          period_start      = COALESCE($4, period_start),
          period_end        = COALESCE($5, period_end),
          priority          = COALESCE($6, priority),
          subject_name      = COALESCE($7, subject_name),
          subject_account   = COALESCE($8, subject_account),
          subject_bvn       = COALESCE($9, subject_bvn),
          subject_type      = COALESCE($10, subject_type),
          amount_ngn        = COALESCE($11::numeric, amount_ngn),
          transaction_count = COALESCE($12, transaction_count),
          narrative         = COALESCE($13, narrative),
          updated_at        = now()
        WHERE institution_id = $1 AND id = $2 AND status = 'draft'
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(
        institutionId, id, title, periodStart, periodEnd, priority,
        subjectName, subjectAccount, subjectBvn, subjectType,
        amountNgn, transactionCount, narrative
    )).compose(rs -> {
      var it = rs.iterator();
      if (!it.hasNext()) return Future.failedFuture(new IllegalStateException("Report not found or already filed"));
      return Future.succeededFuture(mapReport(it.next()));
    });
  }

  public Future<NfiuReport> fileReport(long institutionId, long id, long userId, String userName) {
    String sql = """
        UPDATE nfiu_reports SET
          status           = 'filed',
          filing_date      = now(),
          filed_by_user_id = $3,
          filed_by_name    = $4,
          updated_at       = now()
        WHERE institution_id = $1 AND id = $2 AND status = 'draft'
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id, userId, userName))
        .compose(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Future.failedFuture(new IllegalStateException("Report not found or already filed"));
          return Future.succeededFuture(mapReport(it.next()));
        });
  }

  public Future<Void> deleteReport(long institutionId, long id) {
    String sql = "DELETE FROM nfiu_reports WHERE institution_id = $1 AND id = $2 AND status = 'draft'";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id)).mapEmpty();
  }

  // ── Schedules ─────────────────────────────────────────────────────────────

  public Future<List<NfiuSchedule>> listSchedules(long institutionId) {
    String sql = """
        SELECT * FROM nfiu_schedules
        WHERE institution_id = $1
        ORDER BY next_due ASC
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId))
        .map(rs -> {
          List<NfiuSchedule> list = new ArrayList<>();
          rs.forEach(row -> list.add(mapSchedule(row)));
          return list;
        });
  }

  public Future<NfiuSchedule> createSchedule(long institutionId, String reportType,
      String name, String frequency, LocalDate nextDue, boolean autoFile, Long createdBy) {
    String sql = """
        INSERT INTO nfiu_schedules
          (institution_id, report_type, name, frequency, next_due, auto_file, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(
        institutionId, reportType, name, frequency, nextDue, autoFile, createdBy
    )).map(rs -> mapSchedule(rs.iterator().next()));
  }

  public Future<NfiuSchedule> updateSchedule(long institutionId, long id,
      String name, String frequency, LocalDate nextDue, Boolean isActive, Boolean autoFile) {
    String sql = """
        UPDATE nfiu_schedules SET
          name       = COALESCE($3, name),
          frequency  = COALESCE($4, frequency),
          next_due   = COALESCE($5, next_due),
          is_active  = COALESCE($6, is_active),
          auto_file  = COALESCE($7, auto_file),
          updated_at = now()
        WHERE institution_id = $1 AND id = $2
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(
        institutionId, id, name, frequency, nextDue, isActive, autoFile
    )).compose(rs -> {
      var it = rs.iterator();
      if (!it.hasNext()) return Future.failedFuture(new IllegalStateException("Schedule not found"));
      return Future.succeededFuture(mapSchedule(it.next()));
    });
  }

  public Future<Void> deleteSchedule(long institutionId, long id) {
    String sql = "DELETE FROM nfiu_schedules WHERE institution_id = $1 AND id = $2";
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id)).mapEmpty();
  }

  // ── Mappers ───────────────────────────────────────────────────────────────

  private static NfiuReport mapReport(Row row) {
    Object amtObj = row.getValue("amount_ngn");
    Double amountNgn = amtObj != null ? ((Number) amtObj).doubleValue() : null;
    Object fbObj = row.getValue("filed_by_user_id");
    Long filedByUserId = fbObj != null ? ((Number) fbObj).longValue() : null;

    return new NfiuReport(
        row.getLong("id"),
        row.getLong("institution_id"),
        row.getString("report_type"),
        row.getString("reference"),
        row.getString("title"),
        row.getLocalDate("period_start"),
        row.getLocalDate("period_end"),
        row.getString("status"),
        row.getString("priority"),
        row.getOffsetDateTime("filing_date"),
        row.getString("subject_name"),
        row.getString("subject_account"),
        row.getString("subject_bvn"),
        row.getString("subject_type"),
        amountNgn,
        row.getInteger("transaction_count"),
        row.getString("narrative"),
        filedByUserId,
        row.getString("filed_by_name"),
        row.getString("acknowledgement_ref"),
        row.getString("rejection_reason"),
        row.getOffsetDateTime("created_at")
    );
  }

  private static NfiuSchedule mapSchedule(Row row) {
    Object cbObj = row.getValue("created_by");
    Long createdBy = cbObj != null ? ((Number) cbObj).longValue() : null;
    return new NfiuSchedule(
        row.getLong("id"),
        row.getLong("institution_id"),
        row.getString("report_type"),
        row.getString("name"),
        row.getString("frequency"),
        row.getLocalDate("next_due"),
        row.getOffsetDateTime("last_filed_at"),
        row.getBoolean("is_active"),
        row.getBoolean("auto_file"),
        createdBy,
        row.getOffsetDateTime("created_at")
    );
  }

  private static String abbrev(String reportType) {
    return switch (reportType) {
      case "AML_RETURN" -> "AMLR";
      default           -> reportType;
    };
  }
}
