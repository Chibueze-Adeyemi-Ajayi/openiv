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
        "SELECT id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold FROM aml_settings WHERE institution_id = $1")
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

  public Future<AmlSettings> upsert(long institutionId, boolean autoOpenCase, Integer flagThreshold, Integer caseThreshold, Integer behFlagThreshold, Integer behCaseThreshold, Integer normalThreshold, Integer behNormalThreshold) {
    String sql = "INSERT INTO aml_settings (institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold) " +
        "VALUES ($1, $2, COALESCE($3, 51), COALESCE($4, 81), COALESCE($5, 60), COALESCE($6, 85), COALESCE($7, 30), COALESCE($8, 30)) " +
        "ON CONFLICT (institution_id) DO UPDATE SET auto_open_case = $2, " +
        "risk_score_flag_threshold = COALESCE($3, aml_settings.risk_score_flag_threshold), " +
        "risk_score_case_threshold = COALESCE($4, aml_settings.risk_score_case_threshold), " +
        "beh_risk_score_flag_threshold = COALESCE($5, aml_settings.beh_risk_score_flag_threshold), " +
        "beh_risk_score_case_threshold = COALESCE($6, aml_settings.beh_risk_score_case_threshold), risk_score_normal_threshold = COALESCE($7, aml_settings.risk_score_normal_threshold), beh_risk_score_normal_threshold = COALESCE($8, aml_settings.beh_risk_score_normal_threshold) " +
        "RETURNING id, institution_id, auto_open_case, risk_score_flag_threshold, risk_score_case_threshold, beh_risk_score_flag_threshold, beh_risk_score_case_threshold, risk_score_normal_threshold, beh_risk_score_normal_threshold";
    return pool.preparedQuery(sql)
        .execute(Tuple.of(institutionId, autoOpenCase, flagThreshold, caseThreshold, behFlagThreshold, behCaseThreshold, normalThreshold, behNormalThreshold))
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

  private static AmlSettings mapSettings(Row r, List<String> emails) {
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
        r.getInteger("beh_risk_score_normal_threshold"));
  }
}
