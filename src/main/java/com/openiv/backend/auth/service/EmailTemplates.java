package com.openiv.backend.auth.service;

/**
 * HTML email templates for all transactional messages sent by OpenIV.
 *
 * <p>
 * Layout rules:
 * <ul>
 * <li>Table-based structure — most email clients (Outlook, Gmail, Apple Mail)
 * ignore CSS
 * floats and flex; nested tables are the only reliable layout primitive.</li>
 * <li>All styles are inlined — external/embedded stylesheets are stripped by
 * many webmail
 * clients before rendering.</li>
 * <li>max-width 580 px — fits every common viewport without horizontal
 * scroll.</li>
 * <li>A hidden preheader line is injected so inbox preview text is
 * controlled.</li>
 * </ul>
 */
public final class EmailTemplates {

  private static final String BRAND = "#00288e";
  private static final String BRAND_DARK = "#001e6e";
  private static final String ACCENT = "#d9f99d";
  private static final String TEXT = "#0f172a";
  private static final String MUTED = "#64748b";
  private static final String BORDER = "#e2e8f0";
  private static final String BG_PAGE = "#f1f5f9";
  private static final String BG_CARD = "#ffffff";
  private static final String BG_FOOTER = "#f8fafc";
  private static final String DANGER = "#dc2626";
  private static final String DANGER_BG = "#fef2f2";
  private static final String DANGER_BORDER = "#fecaca";

  private EmailTemplates() {
  }

  // ---- Public templates ---------------------------------------------------

  public static String verification(String code) {
    return wrap("Security Verification Code", "Confirm your identity with the code below.",
        p("Please use the following single-use code to complete your security verification:")
            + codeBlock(code)
            + p(small("This code expires in <strong>15 minutes</strong>. "
                + "If you did not request this, contact your administrator immediately.")));
  }

  public static String passwordReset(String code) {
    return wrap("Password Reset Request", "Use this code to reset your OpenIV password.",
        p("A password reset was requested for your account. Enter the code below to proceed:")
            + codeBlock(code)
            + p("<span style=\"color:" + DANGER + ";font-weight:600;\">"
                + "For your security, do not share this code with anyone. "
                + "It expires in 15 minutes.</span>"));
  }

  public static String stepUpLockoutUser(String fullName, String timestamp) {
    return wrap("Security Alert — Account Locked", "Suspicious activity was detected on your account.",
        p("Hi <strong>" + esc(fullName) + "</strong>,")
            + p("We detected <strong>3 consecutive failed TOTP verification attempts</strong> "
                + "on your account at <strong>" + esc(timestamp) + " UTC</strong>. "
                + "As a precaution, your active session has been <strong>terminated</strong>.")
            + alertBox(DANGER_BG, DANGER_BORDER, DANGER, "If this was not you:",
                "<ul style=\"margin:6px 0 0;padding-left:20px;color:#7f1d1d;font-size:14px;line-height:1.8;\">"
                    + "<li>Change your password immediately</li>"
                    + "<li>Contact your institution administrator</li>"
                    + "<li>Re-enrol your authenticator app if your device may be compromised</li>"
                    + "</ul>")
            + p(small("If you triggered these attempts yourself, simply sign in again.")));
  }

  public static String accountLockoutSecurity(String fullName, String ip, String userAgent,
      int lockMinutes, String timestamp) {
    String safeIp = (ip == null || ip.isBlank()) ? "Unknown" : esc(ip);
    String safeUserAgent = (userAgent == null || userAgent.isBlank()) ? "Unknown device" : esc(userAgent);
    return wrap("Security Alert — Account Temporarily Locked",
        "We've locked your account after several failed sign-in attempts.",
        p("Hi <strong>" + esc(fullName == null ? "there" : fullName) + "</strong>,")
            + p("We detected <strong>multiple failed sign-in attempts</strong> on your OpenIV account just now. "
                + "To protect your account, we've <strong>temporarily locked it for " + lockMinutes
                + " minutes</strong>. "
                + "Sign-in will automatically work again once that window passes.")
            + dataTable(DANGER, "What we saw", new String[][] {
                { "When", esc(timestamp) + " UTC" },
                { "IP address", "<span style=\"font-family:monospace;\">" + safeIp + "</span>" },
                { "Device", safeUserAgent },
                { "Action",
                    "<span style=\"color:" + DANGER + ";font-weight:600;\">Account locked for " + lockMinutes
                        + " minutes</span>" },
            })
            + p("<strong>What this means:</strong> someone — possibly you — entered the wrong password "
                + "several times in a row. If it was you, just wait for the lock to expire and try again.")
            + alertBox(DANGER_BG, DANGER_BORDER, DANGER, "If this wasn't you:",
                "<ul style=\"margin:6px 0 0;padding-left:20px;color:#7f1d1d;font-size:14px;line-height:1.8;\">"
                    + "<li>Reset your password as soon as the lock expires, using the <strong>Forgot password?</strong> link on the sign-in page</li>"
                    + "<li>If you have not already, enable two-factor authentication (TOTP) from your profile</li>"
                    + "<li>Sign out of any active sessions you do not recognise</li>"
                    + "<li>Notify your institution's security contact so they can review activity from this IP</li>"
                    + "</ul>")
            + p(small("This is an automated security notification from OpenIV. You don't need to reply.")));
  }

  public static String stepUpLockoutAdmin(String adminName, String userName,
      String userEmail, String timestamp) {
    return wrap("Security Alert — Step-Up Lockout", "A user in your institution has been locked out.",
        p("Hi <strong>" + esc(adminName) + "</strong>,")
            + p("A user in your institution was locked out after 3 consecutive failed "
                + "TOTP verification attempts.")
            + dataTable(DANGER, "Lockout Event", new String[][] {
                { "User", esc(userName) },
                { "Email", "<span style=\"font-family:monospace;\">" + esc(userEmail) + "</span>" },
                { "Reason",
                    "<span style=\"color:" + DANGER + ";font-weight:600;\">3 failed TOTP step-up attempts</span>" },
                { "Time", esc(timestamp) + " UTC" },
            })
            + p("Please review this activity in the <strong>OpenIV dashboard</strong> "
                + "and take appropriate action."));
  }

  public static String caseNotification(String caseId, String caseTitle,
      String priority, String brief) {
    String priorityColor = switch (priority.toLowerCase()) {
      case "critical" -> "#dc2626";
      case "high" -> "#f59e0b";
      case "medium" -> "#f97316";
      default -> "#6b7280";
    };
    return wrap("Fraud Investigation Case Opened", "A new case requires your attention.",
        p("A new fraud investigation case has been created and is awaiting review.")
            + dataTable(priorityColor, "Case Opened", new String[][] {
                { "Case ID", "<span style=\"font-family:monospace;font-weight:600;\">" + esc(caseId) + "</span>" },
                { "Priority",
                    "<span style=\"color:" + priorityColor + ";font-weight:600;text-transform:uppercase;\">"
                        + esc(priority) + "</span>" },
                { "Title", "<span style=\"font-weight:600;\">" + esc(caseTitle) + "</span>" },
                { "Brief", esc(brief) },
            })
            + p("Log in to the <strong>OpenIV dashboard</strong> to review the case and begin your investigation."));
  }

  public static String dailyRiskReport(String recipientName, String reportHtml) {
    return wrap("Daily High-Risk Customer Report", "Your automated fraud monitoring report is ready.",
        p("Hi <strong>" + esc(recipientName) + "</strong>,")
            + p("Your automated nightly fraud monitoring report is ready. The system has analysed "
                + "all customers in your institution and identified those who need your attention today.")
            + reportHtml
            + p(small("Log in to the <strong>OpenIV dashboard</strong> to review each customer's full profile, "
                + "open an investigation case, or file a regulatory report. Acting promptly on high-risk signals "
                + "helps your institution stay ahead of fraud and remain compliant with CBN AML guidelines.")));
  }

  public static String institutionInvite(String contactName, String institutionName,
      String inviteCode, String invitePageUrl) {
    return wrap("You're Invited to OpenIV", "Your institution has been approved on the platform.",
        p("Hi <strong>" + esc(contactName) + "</strong>,")
            + p("Your institution, <strong>" + esc(institutionName) + "</strong>, has been approved on the "
                + "OpenIV platform. You've been designated as the account administrator.")
            + "<p style=\"font-size:13px;font-weight:600;color:" + MUTED
            + ";margin:24px 0 8px;\">YOUR INVITATION CODE</p>"
            + codeBlock(inviteCode)
            + p("Go to the link below, click <strong>Accept Your Invitation</strong>, and enter this code to set up your account. "
                + "The code expires in <strong>7 days</strong>.")
            + ctaButton("Go to Invitation Page", invitePageUrl)
            + p(small("If the button doesn't work, copy this link into your browser: "
                + "<a href=\"" + invitePageUrl + "\" style=\"color:" + BRAND + ";\">" + invitePageUrl + "</a>"))
            + p(small("If you did not expect this invitation, you can safely ignore this email.")));
  }

  public static String teamInvite(String recipientName, String institutionName,
      String tempPassword, String loginUrl) {
    return wrap("You've Been Invited to OpenIV",
        "You have been added to " + esc(institutionName) + " on OpenIV.",
        p("Hi <strong>" + esc(recipientName) + "</strong>,")
            + p("A member of your team has set up an OpenIV account for you at "
                + "<strong>" + esc(institutionName) + "</strong>. OpenIV is the platform your "
                + "institution uses to monitor financial activity and detect fraud.")
            + "<p style=\"font-size:13px;font-weight:600;color:" + MUTED + ";margin:24px 0 8px;\">"
            + "YOUR TEMPORARY PASSWORD</p>"
            + codeBlock(tempPassword)
            + p("Use the button below to go to the login page. Enter your email address and this "
                + "temporary password. You will be asked to create a new password before you can use "
                + "your account.")
            + ctaButton("Log In to OpenIV", loginUrl)
            + p(small("If the button doesn't work, copy this link into your browser: "
                + "<a href=\"" + loginUrl + "\" style=\"color:" + BRAND + ";\">" + loginUrl + "</a>"))
            + alertBox("#fffbeb", "#fde68a", "#92400e", "Important",
                "<p style=\"margin:6px 0 0;font-size:14px;color:#78350f;line-height:1.7;\">"
                    + "This temporary password is for your first login only. You will be asked to choose "
                    + "a new password immediately after signing in. "
                    + "<strong>Do not share this email with anyone.</strong></p>"));
  }

  public static String welcome(String recipientName, String institutionName) {
    return wrap("Welcome to OpenIV — Your Account Is Ready",
        "Your account is fully set up and ready to use.",
        p("Hi <strong>" + esc(recipientName) + "</strong>,")
            + p("Your OpenIV account for <strong>" + esc(institutionName) + "</strong> is now fully "
                + "set up. You can sign in at any time to access the dashboard, review customer "
                + "activity, and collaborate with your team.")
            + alertBox("#f0fdf4", "#bbf7d0", "#166534", "You're all set",
                "<p style=\"margin:6px 0 0;font-size:14px;color:#14532d;line-height:1.7;\">"
                    + "Your two-factor authenticator is linked and your account is protected. "
                    + "If you ever lose access to your authenticator app, contact your "
                    + "institution administrator.</p>")
            + p("Questions? Reach out to your team administrator or contact us at "
                + "<a href=\"mailto:hello@openiv.ng\" style=\"color:" + BRAND + ";\">"
                + "hello@openiv.ng</a>.")
            + p(small("Welcome aboard.")));
  }

  public static String accessRequestConfirmation(String contactName, String institutionName) {
    return wrap("Request Received — OpenIV",
        "Your access request has been received. Our compliance team will be in touch shortly.",
        p("Hi <strong>" + esc(contactName) + "</strong>,")
            + p("Thank you for your interest in OpenIV. We have received your access request for "
                + "<strong>" + esc(institutionName) + "</strong> and it is now in our review queue.")
            + alertBox("#f0fdf4", "#bbf7d0", "#166534", "What happens next",
                "<p style=\"margin:6px 0 0;font-size:14px;color:#14532d;line-height:1.7;\">"
                    + "Our compliance team will review your request and reach out to you within <strong>one business day</strong>. "
                    + "If approved, you will receive a separate invitation email with your access credentials.</p>")
            + p("In the meantime, if you have any questions please contact us at "
                + "<a href=\"mailto:compliance@openiv.ng\" style=\"color:" + BRAND + ";\">compliance@openiv.ng</a>.")
            + p(small("You submitted this request on behalf of <strong>" + esc(institutionName) + "</strong>. "
                + "If this was not you, you can safely ignore this email.")));
  }

  public static String waitlistNotification(String userName, String userEmail, String expectation) {
    return wrap("New Waitlist Signup", "A new user has joined the OpenIV waitlist.",
        p("A new user has signed up for early access to OpenIV.")
            + dataTable(BRAND, "Signup Details", new String[][] {
                { "Name", esc(userName) },
                { "Email", "<span style=\"font-family:monospace;\">" + esc(userEmail) + "</span>" },
                { "Expectation", esc(expectation) },
            })
            + p("Review this submission in the super-admin portal and approve or waitlist the institution."));
  }

  // ---- HTML primitives ----------------------------------------------------

  private static String p(String content) {
    return "<p style=\"font-size:15px;line-height:1.65;color:" + TEXT + ";margin:0 0 16px;"
        + "font-family:" + FONT_STACK + ";\">"
        + content + "</p>";
  }

  private static String small(String content) {
    return "<span style=\"font-size:13px;color:" + MUTED + ";font-family:" + FONT_STACK + ";\">"
        + content + "</span>";
  }

  private static String codeBlock(String code) {
    return "<div style=\"background:#f1f5f9;border:1px solid " + BORDER
        + ";padding:24px;text-align:center;margin:20px 0;\">"
        + "<span style=\"font-size:30px;font-weight:700;color:" + BRAND + ";letter-spacing:0.3em;"
        + "font-family:'Courier New',Courier,monospace;\">" + esc(code) + "</span>"
        + "</div>";
  }

  private static String ctaButton(String label, String url) {
    return "<div style=\"text-align:center;margin:28px 0;\">"
        + "<a href=\"" + url + "\" style=\"background-color:" + BRAND + ";color:#ffffff;"
        + "padding:14px 36px;font-size:15px;font-weight:700;text-decoration:none;"
        + "display:inline-block;letter-spacing:0.04em;font-family:" + FONT_STACK + ";\">"
        + esc(label) + "</a>"
        + "</div>";
  }

  private static String alertBox(String bg, String border, String titleColor,
      String title, String content) {
    return "<div style=\"background:" + bg + ";border:1px solid " + border + ";padding:16px 20px;margin:20px 0;\">"
        + "<p style=\"color:" + titleColor + ";font-weight:700;font-size:14px;margin:0 0 8px;"
        + "font-family:" + FONT_STACK + ";\">" + title + "</p>"
        + content
        + "</div>";
  }

  private static String dataTable(String accentColor, String label, String[][] rows) {
    StringBuilder sb = new StringBuilder();
    sb.append("<div style=\"border:1px solid ").append(BORDER).append(";margin:20px 0;overflow:hidden;\">");
    sb.append("<div style=\"background:").append(accentColor)
        .append(";padding:11px 16px;\">")
        .append("<span style=\"color:#ffffff;font-weight:700;font-size:11px;")
        .append("text-transform:uppercase;letter-spacing:0.1em;font-family:").append(FONT_STACK).append(";\">")
        .append(esc(label)).append("</span>")
        .append("</div>");
    sb.append("<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\">");
    for (int i = 0; i < rows.length; i++) {
      String rowBg = (i % 2 == 0) ? BG_FOOTER : BG_CARD;
      sb.append("<tr style=\"background:").append(rowBg).append(";\">")
          .append("<td style=\"padding:10px 16px;font-size:11px;font-weight:700;color:#94a3b8;")
          .append("text-transform:uppercase;letter-spacing:0.08em;white-space:nowrap;width:110px;")
          .append("font-family:").append(FONT_STACK).append(";\">")
          .append(esc(rows[i][0])).append("</td>")
          .append("<td style=\"padding:10px 16px;font-size:14px;color:").append(TEXT)
          .append(";font-family:").append(FONT_STACK).append(";\">")
          .append(rows[i][1]).append("</td>")
          .append("</tr>");
    }
    sb.append("</table></div>");
    return sb.toString();
  }

  // ---- Outer shell --------------------------------------------------------

  private static final String FONT_STACK = "'Jost',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

  private static String wrap(String title, String preheader, String body) {
    return "<!DOCTYPE html>"
        + "<html lang=\"en\" xmlns=\"http://www.w3.org/1999/xhtml\">"
        + "<head>"
        + "<meta charset=\"UTF-8\">"
        + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1.0\">"
        + "<meta http-equiv=\"X-UA-Compatible\" content=\"IE=edge\">"
        + "<title>OpenIV</title>"
        + "<link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">"
        + "<link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>"
        + "<link rel=\"stylesheet\" href=\"https://fonts.googleapis.com/css2?family=Jost:wght@400;600;700;800&display=swap\">"
        + "<style>@import url('https://fonts.googleapis.com/css2?family=Jost:wght@400;600;700;800&display=swap');</style>"
        + "</head>"
        + "<body style=\"margin:0;padding:0;background-color:" + BG_PAGE + ";"
        + "font-family:" + FONT_STACK + ";\">"

        // Hidden preheader — controls the grey preview text in inbox list views
        + "<div style=\"display:none;max-height:0;overflow:hidden;mso-hide:all;\">"
        + esc(preheader)
        + "&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;"
        + "&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;&nbsp;&#847;"
        + "</div>"

        // Page wrapper
        + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\""
        + " style=\"background-color:" + BG_PAGE + ";\">"
        + "<tr><td align=\"center\" style=\"padding:40px 16px;\">"

        // Email card
        + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\""
        + " style=\"max-width:580px;\">"

        // ── Header ──────────────────────────────────────────────────────────
        + "<tr><td style=\"background-color:" + BRAND + ";padding:22px 32px;\">"
        + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\">"
        + "<tr>"
        + "<td style=\"vertical-align:middle;\">"
        + "<div style=\"border-top:2px solid " + ACCENT + ";padding-top:5px;display:inline-block;\">"
        + "<span style=\"font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.14em;"
        + "font-family:'Arial Black',Arial,sans-serif;\">OPENIV</span>"
        + "</div>"
        + "</td>"
        + "<td style=\"vertical-align:middle;text-align:right;\">"
        + "<span style=\"font-size:10px;font-weight:600;color:rgba(255,255,255,0.4);"
        + "letter-spacing:0.1em;text-transform:uppercase;\">AML &amp; Fraud Intelligence</span>"
        + "</td>"
        + "</tr>"
        + "</table>"
        + "</td></tr>"

        // ── Title band ──────────────────────────────────────────────────────
        + "<tr><td style=\"background-color:" + BRAND_DARK + ";padding:16px 32px;\">"
        + "<p style=\"margin:0;font-size:11px;font-weight:700;color:" + ACCENT + ";"
        + "letter-spacing:0.16em;text-transform:uppercase;font-family:" + FONT_STACK + ";\">" + esc(title) + "</p>"
        + "</td></tr>"

        // ── Body ────────────────────────────────────────────────────────────
        + "<tr><td style=\"background-color:" + BG_CARD + ";padding:36px 32px;"
        + "border-left:1px solid " + BORDER + ";border-right:1px solid " + BORDER + ";\">"
        + body
        + "</td></tr>"

        // ── Footer ──────────────────────────────────────────────────────────
        + "<tr><td style=\"background-color:" + BG_FOOTER + ";padding:22px 32px;"
        + "border:1px solid " + BORDER + ";border-top:none;\">"
        + "<table role=\"presentation\" cellspacing=\"0\" cellpadding=\"0\" border=\"0\" width=\"100%\">"
        + "<tr><td style=\"padding-bottom:12px;border-bottom:1px solid " + BORDER + ";\">"
        + "<p style=\"margin:0;font-size:12px;color:#475569;font-family:" + FONT_STACK + ";\">"
        + "<strong style=\"color:" + BRAND + ";\">OpenIV</strong>"
        + " &nbsp;·&nbsp; Fraud Intelligence Platform"
        + " &nbsp;·&nbsp; <a href=\"https://openiv.ng\" style=\"color:" + BRAND
        + ";text-decoration:none;\">openiv.ng</a>"
        + "</p>"
        + "</td></tr>"
        + "<tr><td style=\"padding-top:12px;\">"
        + "<p style=\"margin:0 0 6px;font-size:11px;color:#94a3b8;line-height:1.6;font-family:" + FONT_STACK + ";\">"
        + "You received this email because an action was performed on the OpenIV platform "
        + "for your institution. For support, contact "
        + "<a href=\"mailto:hello@openiv.ng\" style=\"color:" + BRAND + ";text-decoration:none;\">hello@openiv.ng</a>."
        + "</p>"
        + "<p style=\"margin:0;font-size:10px;color:#cbd5e1;font-family:" + FONT_STACK + ";\">"
        + "&#169; 2026 OpenIV &nbsp;&middot;&nbsp; This is a system-generated message."
        + "</p>"
        + "</td></tr>"
        + "</table>"
        + "</td></tr>"

        + "</table>"
        + "</td></tr>"
        + "</table>"
        + "</body></html>";
  }

  private static String esc(String s) {
    if (s == null)
      return "";
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
  }
}
