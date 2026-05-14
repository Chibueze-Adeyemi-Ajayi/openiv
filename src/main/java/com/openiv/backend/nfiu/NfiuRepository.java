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
      Long officerUserId, String officerName,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      LocalDate subjectDob, String subjectAddress,
      Double amountNgn, int transactionCount, String transactionType, LocalDate transactionDate,
      String linkedTransactionId, String transactionLocation, Double transactionLat, Double transactionLng,
      String transactionSenderAccount, String transactionSenderBank,
      String transactionRecipientName, String transactionRecipientAccount, String transactionRecipientBank,
      String transactionCurrency, String transactionNarration,
      String narrative) {

    String yearMonth = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMM"));
    String abbrev    = abbrev(reportType);
    return insertWithRetry(institutionId, reportType, abbrev, yearMonth, title, periodStart, periodEnd,
        priority, officerUserId, officerName, subjectName, subjectAccount, subjectBvn, subjectType,
        subjectDob, subjectAddress, amountNgn, transactionCount, transactionType, transactionDate,
        linkedTransactionId, transactionLocation, transactionLat, transactionLng,
        transactionSenderAccount, transactionSenderBank, transactionRecipientName,
        transactionRecipientAccount, transactionRecipientBank, transactionCurrency,
        transactionNarration, narrative, 0);
  }

  private Future<NfiuReport> insertWithRetry(
      long institutionId, String reportType, String abbrev, String yearMonth,
      String title, LocalDate periodStart, LocalDate periodEnd, String priority,
      Long officerUserId, String officerName,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      LocalDate subjectDob, String subjectAddress,
      Double amountNgn, int transactionCount, String transactionType, LocalDate transactionDate,
      String linkedTransactionId, String transactionLocation, Double transactionLat, Double transactionLng,
      String transactionSenderAccount, String transactionSenderBank,
      String transactionRecipientName, String transactionRecipientAccount, String transactionRecipientBank,
      String transactionCurrency, String transactionNarration,
      String narrative, int attempt) {

    String seqSql = """
        SELECT COALESCE(
          MAX(CAST(SPLIT_PART(reference, '-', 3) AS INTEGER)), 0
        ) + 1 + $4 AS seq
        FROM nfiu_reports
        WHERE institution_id = $1 AND report_type = $2
          AND reference LIKE $3
        """;
    String pattern = abbrev + "-" + yearMonth + "-%";

    return pool.preparedQuery(seqSql)
        .execute(Tuple.of(institutionId, reportType, pattern, attempt))
        .compose(rs -> {
          int seq    = rs.iterator().next().getInteger("seq");
          String ref = abbrev + "-" + yearMonth + "-" + String.format("%04d", seq);
          String sql = """
              INSERT INTO nfiu_reports
                (institution_id, report_type, reference, title, period_start, period_end, priority,
                 officer_user_id, officer_name,
                 subject_name, subject_account, subject_bvn, subject_type, subject_dob, subject_address,
                 amount_ngn, transaction_count, transaction_type, transaction_date,
                 linked_transaction_id, transaction_location, transaction_lat, transaction_lng,
                 transaction_sender_account, transaction_sender_bank,
                 transaction_recipient_name, transaction_recipient_account, transaction_recipient_bank,
                 transaction_currency, transaction_narration,
                 narrative)
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
                      $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
              RETURNING *
              """;
          return pool.preparedQuery(sql).execute(Tuple.of(
              institutionId, reportType, ref, title, periodStart, periodEnd, priority,
              officerUserId, officerName,
              subjectName, subjectAccount, subjectBvn, subjectType, subjectDob, subjectAddress,
              amountNgn, transactionCount, transactionType, transactionDate,
              linkedTransactionId, transactionLocation, transactionLat, transactionLng,
              transactionSenderAccount, transactionSenderBank,
              transactionRecipientName, transactionRecipientAccount, transactionRecipientBank,
              transactionCurrency, transactionNarration,
              narrative
          ))
          .map(ins -> mapReport(ins.iterator().next()))
          .recover(err -> {
            if (attempt < 4 && err.getMessage() != null
                && err.getMessage().contains("nfiu_reports_ref_idx")) {
              return insertWithRetry(institutionId, reportType, abbrev, yearMonth,
                  title, periodStart, periodEnd, priority, officerUserId, officerName,
                  subjectName, subjectAccount, subjectBvn, subjectType, subjectDob, subjectAddress,
                  amountNgn, transactionCount, transactionType, transactionDate,
                  linkedTransactionId, transactionLocation, transactionLat, transactionLng,
                  transactionSenderAccount, transactionSenderBank, transactionRecipientName,
                  transactionRecipientAccount, transactionRecipientBank, transactionCurrency,
                  transactionNarration, narrative, attempt + 1);
            }
            return Future.failedFuture(err);
          });
        });
  }

  public Future<NfiuReport> updateReport(long institutionId, long id,
      String title, LocalDate periodStart, LocalDate periodEnd, String priority,
      Long officerUserId, String officerName,
      String subjectName, String subjectAccount, String subjectBvn, String subjectType,
      LocalDate subjectDob, String subjectAddress,
      Double amountNgn, int transactionCount, String transactionType, LocalDate transactionDate,
      String linkedTransactionId, String transactionLocation, Double transactionLat, Double transactionLng,
      String transactionSenderAccount, String transactionSenderBank,
      String transactionRecipientName, String transactionRecipientAccount, String transactionRecipientBank,
      String transactionCurrency, String transactionNarration,
      String narrative) {
    String sql = """
        UPDATE nfiu_reports SET
          title                       = COALESCE($3,           title),
          period_start                = COALESCE($4,           period_start),
          period_end                  = COALESCE($5,           period_end),
          priority                    = COALESCE($6,           priority),
          officer_user_id             = COALESCE($7,           officer_user_id),
          officer_name                = COALESCE($8,           officer_name),
          subject_name                = COALESCE($9,           subject_name),
          subject_account             = COALESCE($10,          subject_account),
          subject_bvn                 = COALESCE($11,          subject_bvn),
          subject_type                = COALESCE($12,          subject_type),
          subject_dob                 = COALESCE($13,          subject_dob),
          subject_address             = COALESCE($14,          subject_address),
          amount_ngn                  = COALESCE($15::numeric, amount_ngn),
          transaction_count           = COALESCE($16,          transaction_count),
          transaction_type            = COALESCE($17,          transaction_type),
          transaction_date            = COALESCE($18,          transaction_date),
          linked_transaction_id       = COALESCE($19,          linked_transaction_id),
          transaction_location        = COALESCE($20,          transaction_location),
          transaction_lat             = COALESCE($21::double precision, transaction_lat),
          transaction_lng             = COALESCE($22::double precision, transaction_lng),
          transaction_sender_account  = COALESCE($23,          transaction_sender_account),
          transaction_sender_bank     = COALESCE($24,          transaction_sender_bank),
          transaction_recipient_name  = COALESCE($25,          transaction_recipient_name),
          transaction_recipient_account = COALESCE($26,        transaction_recipient_account),
          transaction_recipient_bank  = COALESCE($27,          transaction_recipient_bank),
          transaction_currency        = COALESCE($28,          transaction_currency),
          transaction_narration       = COALESCE($29,          transaction_narration),
          narrative                   = COALESCE($30,          narrative),
          updated_at                  = now()
        WHERE institution_id = $1 AND id = $2 AND status = 'draft'
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(
        institutionId, id, title, periodStart, periodEnd, priority,
        officerUserId, officerName,
        subjectName, subjectAccount, subjectBvn, subjectType, subjectDob, subjectAddress,
        amountNgn, transactionCount, transactionType, transactionDate,
        linkedTransactionId, transactionLocation, transactionLat, transactionLng,
        transactionSenderAccount, transactionSenderBank,
        transactionRecipientName, transactionRecipientAccount, transactionRecipientBank,
        transactionCurrency, transactionNarration,
        narrative
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

  public Future<NfiuReport> submitForApproval(long institutionId, long id, long userId, String userName) {
    String sql = """
        UPDATE nfiu_reports SET
          status               = 'pending_approval',
          submitted_by_user_id = $3,
          submitted_by_name    = $4,
          submitted_at         = now(),
          updated_at           = now()
        WHERE institution_id = $1 AND id = $2 AND status = 'draft'
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id, userId, userName))
        .compose(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Future.failedFuture(new IllegalStateException("Report not found or already submitted"));
          return Future.succeededFuture(mapReport(it.next()));
        });
  }

  public Future<NfiuReport> approveReport(long institutionId, long id, long userId, String userName) {
    String sql = """
        UPDATE nfiu_reports SET
          status           = 'filed',
          filing_date      = now(),
          filed_by_user_id = $3,
          filed_by_name    = $4,
          updated_at       = now()
        WHERE institution_id = $1 AND id = $2 AND status = 'pending_approval'
        RETURNING *
        """;
    return pool.preparedQuery(sql).execute(Tuple.of(institutionId, id, userId, userName))
        .compose(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Future.failedFuture(new IllegalStateException("Report not found or not pending approval"));
          return Future.succeededFuture(mapReport(it.next()));
        });
  }

  public Future<Void> deleteReport(long institutionId, long id) {
    String sql = "DELETE FROM nfiu_reports WHERE institution_id = $1 AND id = $2 AND status IN ('draft','pending_approval')";
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
    Object ouObj = row.getValue("officer_user_id");
    Long officerUserId = ouObj != null ? ((Number) ouObj).longValue() : null;
    Object latObj = row.getValue("transaction_lat");
    Double txLat = latObj != null ? ((Number) latObj).doubleValue() : null;
    Object lngObj = row.getValue("transaction_lng");
    Double txLng = lngObj != null ? ((Number) lngObj).doubleValue() : null;
    Object sbObj = row.getValue("submitted_by_user_id");
    Long submittedByUserId = sbObj != null ? ((Number) sbObj).longValue() : null;

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
        row.getLocalDate("subject_dob"),
        row.getString("subject_address"),
        amountNgn,
        row.getInteger("transaction_count"),
        row.getString("transaction_type"),
        row.getLocalDate("transaction_date"),
        row.getString("linked_transaction_id"),
        row.getString("transaction_location"),
        txLat,
        txLng,
        row.getString("transaction_sender_account"),
        row.getString("transaction_sender_bank"),
        row.getString("transaction_recipient_name"),
        row.getString("transaction_recipient_account"),
        row.getString("transaction_recipient_bank"),
        row.getString("transaction_currency"),
        row.getString("transaction_narration"),
        row.getString("narrative"),
        officerUserId,
        row.getString("officer_name"),
        filedByUserId,
        row.getString("filed_by_name"),
        row.getString("acknowledgement_ref"),
        row.getString("rejection_reason"),
        row.getOffsetDateTime("created_at"),
        submittedByUserId,
        row.getString("submitted_by_name"),
        row.getOffsetDateTime("submitted_at")
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
