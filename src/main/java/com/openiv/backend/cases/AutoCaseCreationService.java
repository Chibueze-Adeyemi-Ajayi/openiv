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
  private static final long SYSTEM_USER_ID = 0L; // System user ID for auto-created cases

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
          typology,
          priority,
          scoringResult.score,
          null, // no assignment yet
          notes,
          slaDeadline,
          SYSTEM_USER_ID, // system user
          "Auto-created by fraud detection rules",
          null // no document yet
      ).compose(caseRecord -> {
        // Link transaction to case
        return caseRepository.linkTransaction(caseRecord.id(), transaction.id(), institutionId)
            .compose(v -> caseRepository.addActivity(
                caseRecord.id(),
                SYSTEM_USER_ID,
                "opened",
                "Auto-created by transaction rule engine. Rules: " + String.join(", ", scoringResult.flags)
            ))
            .map(caseRecord);
      });
    });
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
    sb.append("AUTO-FLAGGED TRANSACTION\n\n");
    sb.append("Risk Score: ").append(scoring.score).append("/100\n");
    sb.append("Triggered Rules:\n");
    for (String flag : scoring.flags) {
      sb.append("  • ").append(flag).append("\n");
    }
    sb.append("\nTransaction Details:\n");
    sb.append("  Customer: ").append(txn.customerName()).append(" (").append(txn.customerId()).append(")\n");
    sb.append("  Amount: ").append(txn.amount()).append(" ").append(txn.currency()).append("\n");
    sb.append("  Channel: ").append(txn.channel()).append("\n");
    sb.append("  Recipient: ").append(txn.recipientName()).append(" (").append(txn.recipientAccount()).append(")\n");
    sb.append("  Time: ").append(txn.occurredAt()).append("\n");
    sb.append("  Location: ").append(txn.location()).append("\n");
    sb.append("  Reason: ").append(scoring.reason).append("\n");
    sb.append("\nNEXT STEPS:\n");
    sb.append("1. Review transaction details\n");
    sb.append("2. Check customer history and KYC profile\n");
    sb.append("3. Contact customer if high-risk\n");
    sb.append("4. Update case status with findings\n");

    return sb.toString();
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
