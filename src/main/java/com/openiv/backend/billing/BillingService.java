package com.openiv.backend.billing;

import com.openiv.backend.auth.model.Session;
import com.openiv.backend.auth.repository.UserRepository;
import io.vertx.core.Future;
import io.vertx.core.Vertx;

import java.util.List;

/**
 * Manages institution billing, wallets, payment methods, and topups.
 */
public class BillingService {
  private final BillingRepository billingRepository;
  private final UserRepository userRepository;
  private final Vertx vertx;
  private final String paystackSecret;
  private final String billingEncKey;

  public BillingService(BillingRepository billingRepository, UserRepository userRepository,
      Vertx vertx, String paystackSecret, String billingEncKey) {
    this.billingRepository = billingRepository;
    this.userRepository = userRepository;
    this.vertx = vertx;
    this.paystackSecret = paystackSecret;
    this.billingEncKey = billingEncKey;
  }

  // ── Wallet & Summary ──────────────────────────────────────────────────────

  public Future<BillingWallet> getOrCreateWallet(long institutionId) {
    return billingRepository.getOrCreateWallet(institutionId);
  }

  public Future<BillingWallet> getSummary(Session session) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          return billingRepository.getOrCreateWallet(opt.get().institutionId());
        });
  }

  // ── Usage (current billing period) ────────────────────────────────────────

  public Future<BillingUsage> getUsage(Session session) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          return billingRepository.getUsage(opt.get().institutionId());
        });
  }

  // ── Ledger ────────────────────────────────────────────────────────────────

  public Future<List<BillingLedgerEntry>> getLedger(Session session) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          return billingRepository.listLedger(opt.get().institutionId(), 100);
        });
  }

  // ── Payment Methods ───────────────────────────────────────────────────────

  public Future<List<PaymentMethod>> listPaymentMethods(Session session) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          return billingRepository.listPaymentMethods(opt.get().institutionId());
        });
  }

  public Future<Boolean> deletePaymentMethod(Session session, long methodId) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          return billingRepository.deletePaymentMethod(opt.get().institutionId(), methodId);
        });
  }

  // ── Payment & Topup (Paystack integration) ────────────────────────────────

  public Future<Object> initializePayment(Session session, Long amountNgn, String email) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          // TODO: Integrate with Paystack for payment initialization
          return Future.failedFuture(new UnsupportedOperationException("Payment integration not yet implemented"));
        });
  }

  public Future<Object> verifyAndSaveCard(Session session, String reference, boolean saveCard) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          // TODO: Integrate with Paystack for payment verification
          return Future.failedFuture(new UnsupportedOperationException("Payment verification not yet implemented"));
        });
  }

  public Future<Object> topupWithSavedCard(Session session, Long methodId, Long amountNgn, String email) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          // TODO: Integrate with Paystack for topup
          return Future.failedFuture(new UnsupportedOperationException("Topup not yet implemented"));
        });
  }

  public Future<Object> chargeCardDirect(Session session, String cardNumber, String expiryMonth,
      String expiryYear, String cvv, Long amountNgn, String email, boolean saveCard) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          // TODO: Integrate with Paystack for direct card charging
          return Future.failedFuture(new UnsupportedOperationException("Direct card charge not yet implemented"));
        });
  }

  public Future<Object> submitCardChallenge(Session session, String reference, String otp,
      String cvv, Long amountNgn, String email, boolean saveCard) {
    return userRepository.findById(session.userId())
        .compose(opt -> {
          if (opt.isEmpty()) return Future.failedFuture(new IllegalStateException("User not found"));
          // TODO: Integrate with Paystack for OTP challenge
          return Future.failedFuture(new UnsupportedOperationException("Card challenge not yet implemented"));
        });
  }

}
