package com.openiv.backend.cases;

import com.openiv.backend.transactions.Transaction;
import com.openiv.backend.transactions.TransactionScorer;
import io.vertx.core.Future;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;

public final class AutoCaseCreationService {
  private static final Logger log = LoggerFactory.getLogger(AutoCaseCreationService.class);

  private final CaseRepository caseRepository;

  public AutoCaseCreationService(CaseRepository caseRepository) {
    this.caseRepository = caseRepository;
  }

  /**
   * Auto-create a case from a flagged transaction.
   * Called when TransactionScorer flags a transaction.
   */
  public Future<CaseRecord> createCaseFromTransaction(
      long institutionId,
      Transaction transaction,
      TransactionScorer.ScoringResult scoringResult) {

    String priority = TransactionScorer.getPriority(scoringResult.score);
    String title = buildTitle(transaction, scoringResult);
    String brief = buildBrief(transaction, scoringResult);
    String typology = inferTypology(scoringResult.flags);
    String notes = buildNotes(transaction, scoringResult);

    return caseRepository.nextSeq().compose(seq -> {
      String caseId = "CASE-"
          + YearMonth.now().format(DateTimeFormatter.ofPattern("yyyyMM"))
          + "-" + String.format("%06d", seq);

      OffsetDateTime slaDeadline = computeSla(priority);

      return caseRepository.create(
          caseId,
          institutionId,
          title,
          brief,
          typology,
          priority,
          scoringResult.score,
          null, // no assignment yet
          notes,
          slaDeadline,
          null, // system-created, no user
          "Auto-created by fraud detection rules",
          null // no document yet
      ).compose(caseRecord -> {
        // Link transaction to case
        return caseRepository.linkTransaction(caseRecord.id(), transaction.id(), institutionId)
            .compose(v -> caseRepository.addActivity(
                caseRecord.id(),
                null, // system activity
                "opened",
                "Auto-created by transaction rule engine. Rules: " + String.join(", ", scoringResult.flags)
            ))
            .compose(v -> {
              // Add customer profile reference as evidence for system-created cases
              return caseRepository.addEvidence(
                  caseRecord.id(),
                  null, // system-added evidence
                  "kyc",
                  "Customer Profile: " + transaction.customerName(),
                  "View customer KYC data, transaction history, and behavioral patterns for investigation context. Customer ID: " + transaction.customerId(),
                  transaction.customerId() // Customer ID as reference
              );
            })
            .map(caseRecord);
      });
    });
  }

  private String buildBrief(Transaction txn, TransactionScorer.ScoringResult scoring) {
    var sb = new StringBuilder();

    if (scoring.score >= 70) {
      sb.append("HIGH RISK - ");
    } else if (scoring.score >= 40) {
      sb.append("MEDIUM RISK - ");
    } else {
      sb.append("LOW RISK - ");
    }

    if (scoring.flags.contains("High-value wire transfer")) {
      sb.append(String.format("Large wire of ₦%,d to %s", txn.amount().longValue(), txn.recipientName()));
    } else if (scoring.flags.contains("OTP attack detected in time window")) {
      sb.append("OTP attack detected with transaction");
    } else if (scoring.flags.contains("Late-night large transfer")) {
      sb.append("Large transfer at unusual time");
    } else if (scoring.flags.contains("High transaction velocity")) {
      sb.append("Multiple rapid transactions detected");
    } else {
      sb.append(String.format("%,d %s transaction", txn.amount().longValue(), txn.channel()));
    }

    return sb.toString();
  }

  private String buildTitle(Transaction txn, TransactionScorer.ScoringResult scoring) {
    var sb = new StringBuilder();
    sb.append("Flagged: ");

    if (scoring.flags.contains("High-value wire transfer")) {
      sb.append(String.format("%,d NGN wire to %s", txn.amount().longValue(), txn.recipientName()));
    } else if (scoring.flags.contains("OTP attack detected in time window")) {
      sb.append("OTP attack + transaction from ").append(txn.customerName());
    } else if (scoring.flags.contains("Late-night large transfer")) {
      sb.append(String.format("Late-night %,d NGN transfer", txn.amount().longValue()));
    } else if (scoring.flags.contains("High transaction velocity")) {
      sb.append("Velocity spike from ").append(txn.customerName());
    } else {
      sb.append(String.format("%,d %s transaction", txn.amount().longValue(), txn.channel()));
    }

    return sb.toString();
  }

  private String inferTypology(java.util.List<String> flags) {
    // Infer most likely AML typology from triggered rules
    if (flags.contains("OTP attack detected in time window")) {
      return "SIM Swap / Account Compromise";
    }
    if (flags.contains("High transaction velocity")) {
      return "Structuring / Smurfing";
    }
    if (flags.contains("High-value wire transfer")) {
      return "Possible Layering / Trade-Based Laundering";
    }
    if (flags.contains("Late-night large transfer")) {
      return "Possible Money Laundering";
    }
    if (flags.contains("POS transaction at unusual time") || flags.contains("Unusually high POS transaction amount")) {
      return "Point-of-Sale Fraud / Card Fraud";
    }
    return "Suspicious Activity";
  }

  private String buildNotes(Transaction txn, TransactionScorer.ScoringResult scoring) {
    var sb = new StringBuilder();
    sb.append("WHY THIS CASE WAS OPENED\n");
    sb.append("─────────────────────────\n");
    sb.append(scoring.reason).append("\n\n");

    sb.append("WHAT OUR SYSTEM DETECTED\n");
    sb.append("────────────────────────\n");
    for (String flag : scoring.flags) {
      sb.append("• ").append(ruleToPainEnglish(flag, txn)).append("\n");
    }

    sb.append("\nTRANSACTION DETAILS\n");
    sb.append("───────────────────\n");
    sb.append("Customer: ").append(txn.customerName()).append("\n");
    sb.append("Amount: ").append(txn.amount().toPlainString()).append(" ").append(txn.currency()).append("\n");
    sb.append("Channel: ").append(txn.channel()).append("\n");
    if (txn.recipientName() != null && !txn.recipientName().isBlank()) {
      sb.append("Sent to: ").append(txn.recipientName()).append("\n");
    }
    if (txn.location() != null && !txn.location().isBlank()) {
      sb.append("Location: ").append(txn.location()).append("\n");
    }
    sb.append("Time: ").append(txn.occurredAt()).append("\n");

    sb.append("\nRISK LEVEL\n");
    sb.append("──────────\n");
    if (scoring.score >= 70) {
      sb.append("HIGH RISK - Review immediately and consider contacting the customer.\n");
    } else if (scoring.score >= 40) {
      sb.append("MEDIUM RISK - Review customer profile and transaction patterns.\n");
    } else {
      sb.append("LOW RISK - Standard review process.\n");
    }

    sb.append("\nNEXT STEPS\n");
    sb.append("──────────\n");
    sb.append("1. Review the customer's profile and KYC information\n");
    sb.append("2. Check their recent transaction history\n");
    if (scoring.score >= 70) {
      sb.append("3. Contact the customer to verify this transaction\n");
      sb.append("4. Document your findings and update the case status\n");
    } else {
      sb.append("3. Verify the transaction matches customer's usual patterns\n");
      sb.append("4. Close the case or escalate if needed\n");
    }

    return sb.toString();
  }

  private String ruleToPainEnglish(String rule, Transaction txn) {
    return switch (rule) {
      case "High-value wire transfer" ->
          String.format("Large wire transfer: ₦%,d being sent (exceeds normal amount for this account)", txn.amount().longValue());
      case "OTP attack detected in time window" ->
          "Multiple failed login attempts detected just before this transaction (possible account compromise)";
      case "Late-night large transfer" ->
          String.format("Large transfer of ₦%,d happening at an unusual time", txn.amount().longValue());
      case "High transaction velocity" ->
          "Many transactions happening in rapid succession from the same customer (unusual pattern)";
      case "POS transaction at unusual time" ->
          "Card purchase at an unusual time of day (outside normal patterns)";
      case "Unusually high POS transaction amount" ->
          String.format("Card purchase of ₦%,d is higher than this customer's normal amounts", txn.amount().longValue());
      case "Device shared across multiple accounts" ->
          "This device has been used to access multiple different customer accounts";
      case "Impossible travel detected" ->
          "Customer appears to be in two different locations within an impossible travel time";
      case "Suspicious IP cluster" ->
          "Multiple accounts accessed from the same IP address (possible coordinated fraud)";
      default -> rule;
    };
  }

  private OffsetDateTime computeSla(String priority) {
    var now = OffsetDateTime.now();
    return switch (priority) {
      case "critical" -> now.plusHours(4);
      case "high" -> now.plusDays(1);
      case "medium" -> now.plusDays(3);
      default -> now.plusDays(7);
    };
  }
}
