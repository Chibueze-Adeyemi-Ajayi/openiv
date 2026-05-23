package com.openiv.backend.nfiu;

import com.openiv.backend.auth.model.Institution;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.StringWriter;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Produces a goAML-compliant XML document (UNODC goAML Data Model v4.x)
 * for submission to the NFIU goAML portal.
 *
 * Fields map from NfiuReport + Institution as closely as the stored data
 * permits; mandatory goAML elements with no stored equivalent are set to
 * sensible defaults so the portal's schema validator will accept the file.
 */
public final class GoAmlXmlBuilder {

  private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ISO_LOCAL_DATE;
  private static final DateTimeFormatter DT_FMT   =
      DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

  private GoAmlXmlBuilder() {}

  // ── Public entry point ───────────────────────────────────────────────────────

  public static String build(NfiuReport r, Institution inst) {
    try {
      DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
      DocumentBuilder db = dbf.newDocumentBuilder();
      Document doc = db.newDocument();

      Element report = doc.createElement("report");
      doc.appendChild(report);

      // ── Reporting entity ────────────────────────────────────────────────────
      elem(doc, report, "rentity_id",      coalesce(inst.cbnCode(), "INSTITUTION-ID"));
      elem(doc, report, "rentity_branch",  "HQ");

      // ── Submission metadata ─────────────────────────────────────────────────
      elem(doc, report, "submission_code",    "E");
      elem(doc, report, "report_code",        goAmlCode(r.reportType()));
      elem(doc, report, "entity_reference",   coalesce(r.reference(), ""));
      elem(doc, report, "fiu_ref_number",     coalesce(r.acknowledgementRef(), ""));
      elem(doc, report, "submission_date",    submissionDate(r));
      elem(doc, report, "currency_code_local","NGN");

      // ── Reporting person (compliance officer) ───────────────────────────────
      report.appendChild(buildReportingPerson(doc, r, inst));

      // ── Institution location ────────────────────────────────────────────────
      report.appendChild(buildLocation(doc, inst));

      // ── Narrative / reason ──────────────────────────────────────────────────
      elem(doc, report, "reason",
          coalesce(r.narrative(), r.title(), "Suspicious activity detected"));
      elem(doc, report, "action",
          "Reported to the NFIU via the goAML electronic filing portal");
      elem(doc, report, "report_date_time", reportDateTime(r));

      // ── Transaction block (omitted only when no financial data is stored) ───
      if (hasTransactionData(r)) {
        report.appendChild(buildTransaction(doc, r));
      }

      return serialise(doc);

    } catch (Exception e) {
      throw new RuntimeException("GoAML XML generation failed: " + e.getMessage(), e);
    }
  }

  // ── Reporting person ─────────────────────────────────────────────────────────

  private static Element buildReportingPerson(Document doc, NfiuReport r, Institution inst) {
    Element rp = doc.createElement("reporting_person");
    String[] name = splitName(r.officerName());
    elem(doc, rp, "gender",       "U");
    elem(doc, rp, "title",        "");
    elem(doc, rp, "first_name",   name[0]);
    elem(doc, rp, "last_name",    name[1]);
    elem(doc, rp, "dob",          "");
    elem(doc, rp, "nationality1", "NG");
    elem(doc, rp, "id_number",    "");
    elem(doc, rp, "email",        "");
    elem(doc, rp, "phone",        coalesce(inst.contactPhone(), ""));
    elem(doc, rp, "occupation",   "Compliance Officer");
    rp.appendChild(addressElem(doc, "address", inst.address()));
    return rp;
  }

  // ── Institution location ─────────────────────────────────────────────────────

  private static Element buildLocation(Document doc, Institution inst) {
    return addressElem(doc, "location", inst.address());
  }

  // ── Transaction ──────────────────────────────────────────────────────────────

  private static Element buildTransaction(Document doc, NfiuReport r) {
    Element txn = doc.createElement("transaction");

    String txnNum = coalesce(r.linkedTransactionId(), r.reference() + "-T001");
    elem(doc, txn, "transactionnumber",      txnNum);
    elem(doc, txn, "transaction_location",   coalesce(r.transactionLocation(), "N/A"));
    elem(doc, txn, "date_transaction",
        r.transactionDate() != null ? r.transactionDate().format(DATE_FMT) : "");
    elem(doc, txn, "teller",                 "");
    elem(doc, txn, "amount_local",
        r.amountNgn() != null ? String.format("%.2f", r.amountNgn()) : "0.00");
    elem(doc, txn, "value_date",
        r.transactionDate() != null ? r.transactionDate().format(DATE_FMT) : "");
    elem(doc, txn, "transaction_description",
        coalesce(r.transactionNarration(), r.transactionType(), "See narrative"));

    txn.appendChild(buildFromParty(doc, r));
    txn.appendChild(buildToParty(doc, r));
    return txn;
  }

  // ── From party (sender / subject) ────────────────────────────────────────────

  private static Element buildFromParty(Document doc, NfiuReport r) {
    Element party = doc.createElement("involved_party_from");
    elem(doc, party, "from_funds_code", fundsCode(r.transactionType()));
    elem(doc, party, "from_country",    "NG");

    boolean isCorporate = "corporate".equalsIgnoreCase(r.subjectType());
    if (isCorporate) {
      party.appendChild(buildSubjectEntity(doc, r));
    } else {
      party.appendChild(buildSubjectPerson(doc, r));
    }

    if (r.transactionSenderAccount() != null || r.transactionSenderBank() != null) {
      Element tAccount = doc.createElement("t_account");
      tAccount.appendChild(buildAccount(doc,
          r.transactionSenderBank(),
          r.transactionSenderAccount(),
          r.subjectName(),
          coalesce(r.transactionCurrency(), "NGN")));
      party.appendChild(tAccount);
    }
    return party;
  }

  // ── To party (recipient) ──────────────────────────────────────────────────────

  private static Element buildToParty(Document doc, NfiuReport r) {
    Element party = doc.createElement("involved_party_to");
    elem(doc, party, "to_funds_code", "T");
    elem(doc, party, "to_country",    "NG");

    if (r.transactionRecipientName() != null || r.transactionRecipientAccount() != null) {
      String[] recip = splitName(r.transactionRecipientName());
      Element tPerson = doc.createElement("t_person");
      elem(doc, tPerson, "gender",     "U");
      elem(doc, tPerson, "title",      "");
      elem(doc, tPerson, "first_name", recip[0]);
      elem(doc, tPerson, "last_name",  recip[1]);
      elem(doc, tPerson, "dob",        "");
      elem(doc, tPerson, "nationality1", "NG");
      elem(doc, tPerson, "id_number",  "");
      tPerson.appendChild(addressElem(doc, "address", null));
      party.appendChild(tPerson);
    }

    if (r.transactionRecipientAccount() != null || r.transactionRecipientBank() != null) {
      Element tAccount = doc.createElement("t_account");
      tAccount.appendChild(buildAccount(doc,
          r.transactionRecipientBank(),
          r.transactionRecipientAccount(),
          r.transactionRecipientName(),
          coalesce(r.transactionCurrency(), "NGN")));
      party.appendChild(tAccount);
    }
    return party;
  }

  // ── Subject person (individual) ───────────────────────────────────────────────

  private static Element buildSubjectPerson(Document doc, NfiuReport r) {
    String[] name = splitName(r.subjectName());
    Element p = doc.createElement("t_person");
    elem(doc, p, "gender",      "U");
    elem(doc, p, "title",       "");
    elem(doc, p, "first_name",  name[0]);
    elem(doc, p, "last_name",   name[1]);
    elem(doc, p, "dob",
        r.subjectDob() != null ? r.subjectDob().format(DATE_FMT) : "");
    elem(doc, p, "nationality1","NG");
    // BVN used as the primary identifier
    elem(doc, p, "id_number",   coalesce(r.subjectBvn(), ""));
    p.appendChild(addressElem(doc, "address", r.subjectAddress()));
    return p;
  }

  // ── Subject entity (corporate) ────────────────────────────────────────────────

  private static Element buildSubjectEntity(Document doc, NfiuReport r) {
    Element e = doc.createElement("t_entity");
    elem(doc, e, "name",                    coalesce(r.subjectName(), ""));
    elem(doc, e, "commercial_name",         coalesce(r.subjectName(), ""));
    elem(doc, e, "incorporation_number",    coalesce(r.subjectBvn(), ""));
    elem(doc, e, "country_of_incorporation","NG");
    e.appendChild(addressElem(doc, "address", r.subjectAddress()));
    return e;
  }

  // ── Account element ───────────────────────────────────────────────────────────

  private static Element buildAccount(Document doc,
      String institutionName, String accountNumber, String accountName, String currency) {
    Element acct = doc.createElement("account");
    elem(doc, acct, "institution_name", coalesce(institutionName, ""));
    elem(doc, acct, "swift",            "");
    elem(doc, acct, "account_number",   coalesce(accountNumber, ""));
    elem(doc, acct, "account_name",     coalesce(accountName, ""));
    elem(doc, acct, "iban",             "");
    elem(doc, acct, "currency_code",    coalesce(currency, "NGN"));
    elem(doc, acct, "balance",          "0.00");
    elem(doc, acct, "date_balance",     "");
    elem(doc, acct, "status_code",      "A");
    return acct;
  }

  // ── Address helper ────────────────────────────────────────────────────────────

  private static Element addressElem(Document doc, String tagName, String rawAddress) {
    Element addr = doc.createElement(tagName);
    elem(doc, addr, "address_line", coalesce(rawAddress, ""));
    elem(doc, addr, "city",         inferCity(rawAddress));
    elem(doc, addr, "country_code", "NG");
    return addr;
  }

  // ── Serialisation ─────────────────────────────────────────────────────────────

  private static String serialise(Document doc) throws Exception {
    TransformerFactory tf = TransformerFactory.newInstance();
    tf.setAttribute("indent-number", 2);
    Transformer t = tf.newTransformer();
    t.setOutputProperty(OutputKeys.INDENT,     "yes");
    t.setOutputProperty(OutputKeys.ENCODING,   "UTF-8");
    t.setOutputProperty(OutputKeys.STANDALONE, "yes");
    t.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
    StringWriter w = new StringWriter();
    t.transform(new DOMSource(doc), new StreamResult(w));
    return w.toString();
  }

  // ── Domain helpers ────────────────────────────────────────────────────────────

  /**
   * Maps OpenIV report types to the goAML submission report_code.
   * Reference: UNODC goAML Data Model v4 + NFIU Nigeria portal guide.
   */
  static String goAmlCode(String reportType) {
    if (reportType == null) return "STR";
    return switch (reportType.toUpperCase()) {
      case "STR"        -> "STR";
      case "CTR"        -> "CTR";
      case "SAR"        -> "SAR";
      case "ITF"        -> "EFTR";  // Electronic Funds Transfer Report
      case "PEP"        -> "PEP";
      case "AML_RETURN" -> "STR";   // Monthly aggregate filed as bulk STR batch
      default           -> "STR";
    };
  }

  private static String fundsCode(String transactionType) {
    if (transactionType == null) return "T";
    String t = transactionType.toLowerCase();
    if (t.contains("cash"))     return "C";
    if (t.contains("transfer")) return "T";
    if (t.contains("deposit"))  return "D";
    if (t.contains("wire"))     return "W";
    return "T";
  }

  private static String submissionDate(NfiuReport r) {
    if (r.filingDate() != null)
      return r.filingDate().atZoneSameInstant(ZoneOffset.UTC).toLocalDate().format(DATE_FMT);
    return OffsetDateTime.now(ZoneOffset.UTC).toLocalDate().format(DATE_FMT);
  }

  private static String reportDateTime(NfiuReport r) {
    if (r.filingDate() != null)
      return r.filingDate().atZoneSameInstant(ZoneOffset.UTC)
          .toLocalDateTime().format(DT_FMT);
    return OffsetDateTime.now(ZoneOffset.UTC).toLocalDateTime().format(DT_FMT);
  }

  private static boolean hasTransactionData(NfiuReport r) {
    return r.amountNgn() != null
        || r.transactionSenderAccount() != null
        || r.transactionRecipientAccount() != null
        || r.transactionDate() != null;
  }

  /** Splits "Firstname Lastname ..." into a two-element array. */
  static String[] splitName(String fullName) {
    if (fullName == null || fullName.isBlank()) return new String[]{"", ""};
    String trimmed = fullName.trim();
    int idx = trimmed.indexOf(' ');
    if (idx < 0) return new String[]{trimmed, ""};
    return new String[]{trimmed.substring(0, idx), trimmed.substring(idx + 1).trim()};
  }

  /** Best-effort city extraction from a free-form address string. */
  private static String inferCity(String address) {
    if (address == null || address.isBlank()) return "Lagos";
    // Common Nigerian cities
    String[] cities = {
        "Lagos", "Abuja", "Kano", "Ibadan", "Port Harcourt",
        "Benin City", "Maiduguri", "Kaduna", "Enugu", "Aba",
    };
    String upper = address.toUpperCase();
    for (String city : cities) {
      if (upper.contains(city.toUpperCase())) return city;
    }
    return "Lagos";
  }

  @SafeVarargs
  private static <T> T coalesce(T... values) {
    for (T v : values) if (v != null && !String.valueOf(v).isBlank()) return v;
    return values[values.length - 1];
  }

  // ── XML utilities ─────────────────────────────────────────────────────────────

  private static void elem(Document doc, Element parent, String tag, String text) {
    Element el = doc.createElement(tag);
    el.setTextContent(text != null ? text : "");
    parent.appendChild(el);
  }
}
