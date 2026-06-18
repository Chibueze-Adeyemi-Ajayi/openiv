package com.openiv.backend.customers;

import com.openiv.backend.auth.repository.UserRepository;
import com.openiv.backend.auth.service.EmailSender;
import com.openiv.backend.notifications.NotificationService;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public final class RiskReportService {
  private static final Logger log = LoggerFactory.getLogger(RiskReportService.class);

  private final CustomerRepository customerRepository;
  private final UserRepository userRepository;
  private final EmailSender emailSender;
  private final NotificationService notificationService;

  public RiskReportService(CustomerRepository customerRepository, UserRepository userRepository,
      EmailSender emailSender, NotificationService notificationService) {
    this.customerRepository  = customerRepository;
    this.userRepository      = userRepository;
    this.emailSender         = emailSender;
    this.notificationService = notificationService;
  }

  public void run() {
    log.info("[RiskReport] Starting nightly risk report run");
    customerRepository.distinctInstitutionIds()
        .compose(ids -> {
          List<Future<Void>> futures = ids.stream()
              .map(instId -> processInstitution(instId).onFailure(
                  e -> log.error("[RiskReport] Failed for institution {}: {}", instId, e.getMessage())))
              .toList();
          return Future.join(futures);
        })
        .onSuccess(v -> log.info("[RiskReport] Nightly run complete"))
        .onFailure(e -> log.error("[RiskReport] Nightly run failed", e));
  }

  private Future<Void> processInstitution(long institutionId) {
    return customerRepository.refreshAllScores(institutionId)
        .compose(v -> customerRepository.listHighRisk(institutionId, 100, 0))
        .compose(highRisk -> {
          int count = highRisk.size();
          String topName = highRisk.isEmpty() ? null : highRisk.get(0).name();
          int highestScore = highRisk.isEmpty() ? 0 : highRisk.get(0).riskScore();

          // Build the email report section
          String reportHtml = buildReportHtml(highRisk);

          // Register institution-wide notification
          Future<Void> notifFuture = notificationService
              .notifyRiskReport(institutionId, count, highestScore, topName)
              .mapEmpty();

          // Send email to all admin/compliance users
          Future<Void> emailFuture = userRepository.listActiveByInstitution(institutionId)
              .compose(users -> {
                List<Future<Void>> sends = users.stream()
                    .filter(u -> "admin".equals(u.role()) || "cco".equals(u.role()))
                    .map(u -> emailSender
                        .sendDailyRiskReport(u.email(), firstName(u.fullName()), reportHtml)
                        .onFailure(e -> log.warn("[RiskReport] Email failed for {}: {}", u.email(), e.getMessage())))
                    .toList();
                return Future.join(sends).mapEmpty();
              });

          return Future.join(notifFuture, emailFuture).mapEmpty();
        });
  }

  private static String buildReportHtml(List<Customer> highRisk) {
    if (highRisk.isEmpty()) {
      return "<div style=\"background:#f0fdf4;border:1px solid #bbf7d0;padding:16px;margin:20px 0;\">"
          + "<p style=\"color:#166534;font-weight:700;margin:0;\">All clear — no high-risk customers today.</p>"
          + "</div>";
    }

    var sb = new StringBuilder();
    sb.append("<div style=\"background:#fef2f2;border:1px solid #fecaca;padding:16px;margin:20px 0;\">");
    sb.append("<p style=\"color:#991b1b;font-weight:700;font-size:15px;margin:0 0 8px;\">")
      .append(highRisk.size()).append(" High-Risk Customer").append(highRisk.size() == 1 ? "" : "s").append(" Detected</p>");
    sb.append("<p style=\"color:#7f1d1d;font-size:13px;margin:0;\">The following customers have an overall risk score above 75. ")
      .append("This score combines their KYC data quality, their open fraud investigation history, and the proportion of flagged transactions on their account.</p>");
    sb.append("</div>");

    sb.append("<table style=\"width:100%;border-collapse:collapse;font-size:13px;margin:20px 0;\">");
    sb.append("<tr style=\"background:#f1f5f9;\">");
    sb.append("<th style=\"padding:10px 12px;text-align:left;color:#475569;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;\">Customer</th>");
    sb.append("<th style=\"padding:10px 12px;text-align:left;color:#475569;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;\">Risk Score</th>");
    sb.append("<th style=\"padding:10px 12px;text-align:left;color:#475569;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;\">Customer ID</th>");
    sb.append("<th style=\"padding:10px 12px;text-align:left;color:#475569;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;\">Last Evaluated</th>");
    sb.append("</tr>");

    for (int i = 0; i < highRisk.size(); i++) {
      Customer c = highRisk.get(i);
      int score = c.riskScore();
      String bg = (i % 2 == 0) ? "#ffffff" : "#fafbfc";
      String scoreColor = score >= 90 ? "#dc2626" : score >= 80 ? "#f59e0b" : "#f97316";
      String lastEval = c.lastEvaluatedAt() != null
          ? c.lastEvaluatedAt().toLocalDate().toString() : "—";

      sb.append("<tr style=\"background:").append(bg).append(";border-bottom:1px solid #f1f5f9;\">");
      sb.append("<td style=\"padding:10px 12px;color:#0f172a;font-weight:600;\">").append(esc(c.name())).append("</td>");
      sb.append("<td style=\"padding:10px 12px;color:").append(scoreColor).append(";font-weight:700;\">").append(score).append("/100</td>");
      sb.append("<td style=\"padding:10px 12px;color:#334155;\">").append(esc(c.externalId())).append("</td>");
      sb.append("<td style=\"padding:10px 12px;color:#334155;\">").append(lastEval).append("</td>");
      sb.append("</tr>");
    }
    sb.append("</table>");

    sb.append("<div style=\"background:#fff7ed;border:1px solid #fed7aa;padding:16px;margin:20px 0;\">");
    sb.append("<p style=\"color:#9a3412;font-weight:700;margin:0 0 8px;\">What does this mean?</p>");
    sb.append("<p style=\"color:#7c2d12;font-size:13px;margin:0 0 6px;\">A risk score above 75 indicates that this customer exhibits multiple indicators that are consistent with financial crime — ")
      .append("this could be money laundering, structuring, or account takeover fraud.</p>");
    sb.append("<p style=\"color:#7c2d12;font-size:13px;margin:0;\">The <strong>Risk Score</strong> is derived from the most recent CDD workflow evaluation for each customer. It combines identity verification quality, watchlist screening, and behavioural signals — a score above 75 warrants review.</p>");
    sb.append("</div>");

    sb.append("<div style=\"background:#eff6ff;border:1px solid #bfdbfe;padding:16px;margin:20px 0;\">");
    sb.append("<p style=\"color:#1e40af;font-weight:700;margin:0 0 8px;\">Recommended Actions</p>");
    sb.append("<ol style=\"color:#1e3a8a;font-size:13px;margin:0;padding-left:20px;\">");
    sb.append("<li style=\"margin-bottom:6px;\">Log in to openIV and navigate to <strong>Investigate → High-Risk Customers</strong></li>");
    sb.append("<li style=\"margin-bottom:6px;\">Review each customer's full profile and transaction history</li>");
    sb.append("<li style=\"margin-bottom:6px;\">For customers you believe pose a genuine risk: open a formal <strong>Investigation Case</strong></li>");
    sb.append("<li style=\"margin-bottom:6px;\">If the evidence is strong enough: file a <strong>Suspicious Activity Report (SAR)</strong> with the NFIU</li>");
    sb.append("<li>Document your decision — even if you decide no action is needed, record why. This protects your institution during a CBN audit.</li>");
    sb.append("</ol>");
    sb.append("</div>");

    return sb.toString();
  }

  private static String firstName(String fullName) {
    if (fullName == null || fullName.isBlank()) return "Compliance Officer";
    int space = fullName.indexOf(' ');
    return space > 0 ? fullName.substring(0, space) : fullName;
  }

  private static String esc(String s) {
    if (s == null) return "";
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
  }
}
