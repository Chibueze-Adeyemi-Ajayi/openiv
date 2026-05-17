package com.openiv.backend.aml;

import io.vertx.core.Future;
import io.vertx.sqlclient.Pool;
import io.vertx.sqlclient.Row;
import io.vertx.sqlclient.Tuple;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class AmlSettingsRepository {
  private final Pool pool;

  public AmlSettingsRepository(Pool pool) {
    this.pool = pool;
  }

  public Future<Optional<AmlSettings>> getByInstitution(long institutionId) {
    return pool.preparedQuery(
        "SELECT id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold, beam_window_seconds, timezone, kyc_risk_normal_threshold, kyc_risk_case_threshold FROM aml_settings WHERE institution_id = $1")
        .execute(Tuple.of(institutionId))
        .compose(rs -> {
          var it = rs.iterator();
          if (!it.hasNext()) return Future.succeededFuture(Optional.empty());
          Row settingsRow = it.next();
          long amlSettingsId = settingsRow.getLong("id");
          return getNotificationEmails(amlSettingsId)
              .map(emails -> Optional.of(mapSettings(settingsRow, emails)));
        });
  }

  public Future<AmlSettings> upsert(long institutionId, boolean autoOpenCase, Integer flagThreshold, Integer caseThreshold, Integer behFlagThreshold, Integer behCaseThreshold, Integer normalThreshold, Integer behNormalThreshold, Integer kycNormalThreshold, Integer kycCaseThreshold) {
    String sql = "INSERT INTO aml_settings (institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold, kyc_risk_normal_threshold, kyc_risk_case_threshold) " +
        "VALUES ($1, $2, COALESCE($3, 51), COALESCE($4, 81), COALESCE($5, 60), COALESCE($6, 85), COALESCE($7, 30), COALESCE($8, 30), COALESCE($9, 40), COALESCE($10, 75)) " +
        "ON CONFLICT (institution_id) DO UPDATE SET auto_open_case = $2, " +
        "risk_score_flag_threshold = COALESCE($3, aml_settings.risk_score_flag_threshold), " +
        "risk_score_case_threshold = COALESCE($4, aml_settings.risk_score_case_threshold), " +
        "beh_risk_score_flag_threshold = COALESCE($5, aml_settings.beh_risk_score_flag_threshold), " +
        "beh_risk_score_case_threshold = COALESCE($6, aml_settings.beh_risk_score_case_threshold), " +
        "risk_score_normal_threshold = COALESCE($7, aml_settings.risk_score_normal_threshold), " +
        "beh_risk_score_normal_threshold = COALESCE($8, aml_settings.beh_risk_score_normal_threshold), " +
        "kyc_risk_normal_threshold = COALESCE($9, aml_settings.kyc_risk_normal_threshold), " +
        "kyc_risk_case_threshold = COALESCE($10, aml_settings.kyc_risk_case_threshold) " +
        "RETURNING id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold, beam_window_seconds, timezone, kyc_risk_normal_threshold, kyc_risk_case_threshold";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, autoOpenCase, flagThreshold, caseThreshold, behFlagThreshold, behCaseThreshold, normalThreshold, behNormalThreshold, kycNormalThreshold, kycCaseThreshold))
        .compose(rs -> {
          Row settingsRow = rs.iterator().next();
          long amlSettingsId = settingsRow.getLong("id");
          return getNotificationEmails(amlSettingsId)
              .map(emails -> mapSettings(settingsRow, emails));
        });
  }

  public Future<List<String>> getNotificationEmails(long amlSettingsId) {
    return pool.preparedQuery(
        "SELECT email FROM case_notification_emails WHERE aml_settings_id = $1 ORDER BY created_at")
        .execute(Tuple.of(amlSettingsId))
        .map(rs -> {
          List<String> emails = new ArrayList<>();
          for (Row row : rs) {
            emails.add(row.getString("email"));
          }
          return emails;
        });
  }

  public Future<Void> addNotificationEmail(long amlSettingsId, String email) {
    return pool.preparedQuery(
        "INSERT INTO case_notification_emails (aml_settings_id, email) VALUES ($1, $2) " +
        "ON CONFLICT (aml_settings_id, email) DO NOTHING")
        .execute(Tuple.of(amlSettingsId, email))
        .mapEmpty();
  }

  public Future<Void> removeNotificationEmail(long amlSettingsId, String email) {
    return pool.preparedQuery(
        "DELETE FROM case_notification_emails WHERE aml_settings_id = $1 AND email = $2")
        .execute(Tuple.of(amlSettingsId, email))
        .mapEmpty();
  }

  public Future<AmlSettings> updateBeamWindow(long institutionId, int beamWindowSeconds) {
    return pool.preparedQuery(
        "UPDATE aml_settings SET beam_window_seconds = $2 WHERE institution_id = $1 " +
        "RETURNING id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, " +
        "beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, " +
        "beh_risk_score_normal_threshold, beam_window_seconds, timezone, kyc_risk_normal_threshold, kyc_risk_case_threshold")
        .execute(Tuple.of(institutionId, beamWindowSeconds))
        .compose(rs -> {
          Row settingsRow = rs.iterator().next();
          long amlSettingsId = settingsRow.getLong("id");
          return getNotificationEmails(amlSettingsId)
              .map(emails -> mapSettings(settingsRow, emails));
        });
  }

  public Future<AmlSettings> updateTimezone(long institutionId, String timezone) {
    return pool.preparedQuery(
        "UPDATE aml_settings SET timezone = $2 WHERE institution_id = $1 " +
        "RETURNING id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, " +
        "beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, " +
        "beh_risk_score_normal_threshold, beam_window_seconds, timezone, kyc_risk_normal_threshold, kyc_risk_case_threshold")
        .execute(Tuple.of(institutionId, timezone))
        .compose(rs -> {
          Row settingsRow = rs.iterator().next();
          long amlSettingsId = settingsRow.getLong("id");
          return getNotificationEmails(amlSettingsId)
              .map(emails -> mapSettings(settingsRow, emails));
        });
  }

  private static AmlSettings mapSettings(Row r, List<String> emails) {
    Integer bw  = r.getInteger("beam_window_seconds");
    String  tz  = r.getString("timezone");
    Integer kyn = r.getInteger("kyc_risk_normal_threshold");
    Integer kyc = r.getInteger("kyc_risk_case_threshold");
    return new AmlSettings(
        r.getLong("id"),
        r.getLong("institution_id"),
        r.getBoolean("auto_open_case"),
        emails,
        r.getInteger("risk_score_flag_threshold"),
        r.getInteger("risk_score_case_threshold"),
        r.getInteger("beh_risk_score_flag_threshold"),
        r.getInteger("beh_risk_score_case_threshold"),
        r.getInteger("risk_score_normal_threshold"),
        r.getInteger("beh_risk_score_normal_threshold"),
        bw  != null ? bw  : 180,
        tz  != null ? tz  : "Africa/Lagos",
        kyn != null ? kyn : 40,
        kyc != null ? kyc : 75);
  }
}
