package com.openiv.backend.auth.service;

public final class EmailTemplates {

  private static final String PRIMARY_COLOR = "#1e3a8a";
  private static final String BACKGROUND_COLOR = "#f8fafc";
  private static final String TEXT_COLOR = "#0f172a";
  private static final String BORDER_COLOR = "#e2e8f0";

  private EmailTemplates() {}

  public static String verification(String code) {
    return wrap("Security Verification",
        "<p style=\"font-size: 16px; margin-bottom: 24px;\">Please use the following single-use code to complete your security verification:</p>"
            + "<div style=\"background-color: #f1f5f9; padding: 24px; text-align: center; border: 1px solid " + BORDER_COLOR + ";\">"
            + "  <span style=\"font-size: 32px; font-weight: 700; color: " + PRIMARY_COLOR + "; letter-spacing: 0.25em; font-family: monospace;\">" + code + "</span>"
            + "</div>"
            + "<p style=\"font-size: 13px; color: #64748b; margin-top: 24px;\">This code will expire in 15 minutes. If you did not request this, please contact your administrator immediately.</p>"
    );
  }

  public static String passwordReset(String code) {
    return wrap("Password Reset Requested",
        "<p style=\"font-size: 16px; margin-bottom: 24px;\">A request was made to reset your account password. Use the code below to proceed:</p>"
            + "<div style=\"background-color: #f1f5f9; padding: 24px; text-align: center; border: 1px solid " + BORDER_COLOR + ";\">"
            + "  <span style=\"font-size: 32px; font-weight: 700; color: " + PRIMARY_COLOR + "; letter-spacing: 0.25em; font-family: monospace;\">" + code + "</span>"
            + "</div>"
            + "<p style=\"font-size: 13px; color: #dc2626; margin-top: 24px; font-weight: 600;\">For your security, do not share this code with anyone.</p>"
    );
  }

  private static String wrap(String title, String body) {
    return "<!DOCTYPE html><html><body style=\"margin:0;padding:0;background-color:" + BACKGROUND_COLOR + ";\">"
        + "<div style=\"padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'; color: " + TEXT_COLOR + ";\">"
        + "  <div style=\"max-width: 500px; margin: 0 auto; background: #ffffff; border: 1px solid " + BORDER_COLOR + "; border-radius: 0;\">"
        + "    <div style=\"background-color: " + PRIMARY_COLOR + "; padding: 20px; text-align: center;\">"
        + "      <h2 style=\"color: #ffffff; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase;\">OpenIV</h2>"
        + "    </div>"
        + "    <div style=\"padding: 40px;\">"
        + "      <h1 style=\"font-size: 20px; font-weight: 700; color: " + TEXT_COLOR + "; margin: 0 0 20px 0;\">" + title + "</h1>"
        + body
        + "    </div>"
        + "    <div style=\"background-color: #fafbfc; padding: 20px; text-align: center; border-top: 1px solid " + BORDER_COLOR + ";\">"
        + "      <p style=\"font-size: 12px; color: #94a3b8; margin: 0;\">© 2026 Synapsio Platform · Advanced Institutional Intelligence</p>"
        + "    </div>"
        + "  </div>"
        + "</div>"
        + "</body></html>";
  }
}
