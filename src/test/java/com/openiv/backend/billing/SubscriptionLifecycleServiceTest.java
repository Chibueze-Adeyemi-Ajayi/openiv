package com.openiv.backend.billing;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;

/**
 * Pure unit tests for SubscriptionLifecycleService business logic.
 *
 * No database, no Mockito.  Both SubscriptionRepository and InvoiceRepository
 * are final classes, so they cannot be subclassed.  Instead we construct the
 * service with null dependencies — safe because every method under test is a
 * package-private pure calculation/validation method that never touches
 * this.subscriptions, this.invoices, this.paystack, or this.users.
 *
 * Methods exercised:
 *   calculateUpgradeAmount(InstitutionSubscription, SubscriptionPlan)   – pkg-private
 *   calculateAmount(InstitutionSubscription, SubscriptionPlan, String)  – pkg-private
 *   validateDowngradeWindow(InstitutionSubscription)                    – pkg-private
 *   determineType(SubscriptionPlan, SubscriptionPlan)                   – pkg-private
 *   applyDiscount(BigDecimal, BigDecimal)                               – pkg-private static
 */
class SubscriptionLifecycleServiceTest {

  // ─────────────────────────────────────────────────────────────────────────
  // Plan price constants (must match real seed values)
  // ─────────────────────────────────────────────────────────────────────────
  private static final BigDecimal STARTER_PRICE = new BigDecimal("500000");
  private static final BigDecimal GROWTH_PRICE  = new BigDecimal("750000");

  // ─────────────────────────────────────────────────────────────────────────
  // SUT — all constructor args null; only pure methods are called in tests
  // ─────────────────────────────────────────────────────────────────────────
  private SubscriptionLifecycleService sut;

  @BeforeEach
  void setup() {
    sut = new SubscriptionLifecycleService(null, null, null, null);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Plan factory helpers (sortOrder: starter=0, growth=1, enterprise=2)
  // ─────────────────────────────────────────────────────────────────────────
  private static SubscriptionPlan starterPlan() {
    return new SubscriptionPlan(
        UUID.randomUUID().toString(), "Starter", "starter",
        STARTER_PRICE, 5, 10_000L, 10,
        false, 60, 100_000L, List.of(), 0,
        false, false, false, false, false, 5, 50);
  }

  private static SubscriptionPlan growthPlan() {
    return new SubscriptionPlan(
        UUID.randomUUID().toString(), "Growth", "growth",
        GROWTH_PRICE, 25, -1L, 50,
        true, 300, 500_000L, List.of(), 1,
        true, true, true, true, true, 29, -1);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Subscription factory helpers
  // ─────────────────────────────────────────────────────────────────────────
  private static InstitutionSubscription subWithStartsAt(SubscriptionPlan plan, OffsetDateTime startsAt) {
    return new InstitutionSubscription(plan, "active", startsAt, null,
        startsAt != null ? startsAt.plusDays(30) : null);
  }

  private static InstitutionSubscription subWithRenewsAt(SubscriptionPlan plan, OffsetDateTime renewsAt) {
    return new InstitutionSubscription(plan, "active",
        renewsAt != null ? renewsAt.minusDays(30) : null,
        null, renewsAt);
  }

  // =========================================================================
  // 1. Upgrade within 7 days of starts_at → charge = difference only
  // =========================================================================
  @Test
  @DisplayName("upgradeWithin7Days_chargesDifference: starter→growth on day 3 = ₦250,000")
  void upgradeWithin7Days_chargesDifference() {
    SubscriptionPlan starter = starterPlan();
    SubscriptionPlan growth  = growthPlan();
    InstitutionSubscription current = subWithStartsAt(starter, OffsetDateTime.now().minusDays(3));

    BigDecimal charge = sut.calculateUpgradeAmount(current, growth);

    // 750,000 − 500,000 = 250,000
    assertThat(charge).isEqualByComparingTo(new BigDecimal("250000"));
  }

  // =========================================================================
  // 2. Upgrade after 7 days → charge = full new plan price
  // =========================================================================
  @Test
  @DisplayName("upgradeAfter7Days_chargesFullNewPlanPrice: any→growth on day 15 = ₦750,000")
  void upgradeAfter7Days_chargesFullNewPlanPrice() {
    SubscriptionPlan starter = starterPlan();
    SubscriptionPlan growth  = growthPlan();
    InstitutionSubscription current = subWithStartsAt(starter, OffsetDateTime.now().minusDays(15));

    BigDecimal charge = sut.calculateUpgradeAmount(current, growth);

    assertThat(charge).isEqualByComparingTo(GROWTH_PRICE);
  }

  // =========================================================================
  // 3. Downgrade within 3 days BEFORE renewsAt → allowed (no exception)
  // =========================================================================
  @Test
  @DisplayName("downgradeWithin3DaysBeforeRenewal_isAllowed: 2 days before renewsAt")
  void downgradeWithin3DaysBeforeRenewal_isAllowed() {
    SubscriptionPlan growth = growthPlan();
    // renewsAt is 2 days in the future (Math.abs(2) ≤ 3 → OK)
    InstitutionSubscription current = subWithRenewsAt(growth, OffsetDateTime.now().plusDays(2));

    assertThatCode(() -> sut.validateDowngradeWindow(current)).doesNotThrowAnyException();
  }

  // =========================================================================
  // 4. Downgrade outside window (10 days before renewsAt) → IllegalStateException
  // =========================================================================
  @Test
  @DisplayName("downgradeOutsideWindow_throwsException: 10 days before renewsAt")
  void downgradeOutsideWindow_throwsException() {
    SubscriptionPlan growth = growthPlan();
    InstitutionSubscription current = subWithRenewsAt(growth, OffsetDateTime.now().plusDays(10));

    assertThatThrownBy(() -> sut.validateDowngradeWindow(current))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("3 days");
  }

  // =========================================================================
  // 5. Downgrade 2 days AFTER renewsAt → allowed (Math.abs(-2) ≤ 3)
  // =========================================================================
  @Test
  @DisplayName("downgrade3DaysAfterRenewal_isAllowed: 2 days after renewsAt")
  void downgrade3DaysAfterRenewal_isAllowed() {
    SubscriptionPlan growth = growthPlan();
    // renewsAt is 2 days in the past
    InstitutionSubscription current = subWithRenewsAt(growth, OffsetDateTime.now().minusDays(2));

    assertThatCode(() -> sut.validateDowngradeWindow(current)).doesNotThrowAnyException();
  }

  // =========================================================================
  // 6. Downgrade 5 days AFTER renewsAt → exception (Math.abs(-5) > 3)
  // =========================================================================
  @Test
  @DisplayName("downgradeMoreThan3DaysAfterRenewal_throwsException: 5 days after renewsAt")
  void downgradeMoreThan3DaysAfterRenewal_throwsException() {
    SubscriptionPlan growth = growthPlan();
    InstitutionSubscription current = subWithRenewsAt(growth, OffsetDateTime.now().minusDays(5));

    assertThatThrownBy(() -> sut.validateDowngradeWindow(current))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("3 days");
  }

  // =========================================================================
  // 7. Same planId → determineType returns "renewal"
  // =========================================================================
  @Test
  @DisplayName("samePlanId_isRenewalType: determineType returns \"renewal\"")
  void samePlanId_isRenewalType() {
    SubscriptionPlan growth = growthPlan();

    String type = sut.determineType(growth, growth);

    assertThat(type).isEqualTo("renewal");
  }

  // =========================================================================
  // 8. Lower sort order → determineType returns "downgrade";
  //    calculateAmount with "downgrade" returns the new (lower) plan price
  // =========================================================================
  @Test
  @DisplayName("lowerSortOrder_isDowngradeType: growth→starter returns \"downgrade\" and ₦500,000")
  void lowerSortOrder_isDowngradeType() {
    SubscriptionPlan growth  = growthPlan();   // sortOrder = 1
    SubscriptionPlan starter = starterPlan();  // sortOrder = 0

    // Verify sort orders confirm the downgrade direction
    assertThat(starter.sortOrder()).isLessThan(growth.sortOrder());

    String type = sut.determineType(growth, starter);
    assertThat(type).isEqualTo("downgrade");

    // calculateAmount with "downgrade" type returns the new plan's monthly price
    InstitutionSubscription current = subWithRenewsAt(growth, OffsetDateTime.now().plusDays(2));
    BigDecimal amount = sut.calculateAmount(current, starter, "downgrade");
    assertThat(amount).isEqualByComparingTo(STARTER_PRICE);
  }

  // =========================================================================
  // 9. Discount applied: 5% off ₦750,000 = ₦712,500
  // =========================================================================
  @Test
  @DisplayName("discountApplied_whenCouponValid: 5% off ₦750,000 = ₦712,500")
  void discountApplied_whenCouponValid() {
    BigDecimal discounted = SubscriptionLifecycleService.applyDiscount(
        GROWTH_PRICE, new BigDecimal("5"));

    assertThat(discounted).isEqualByComparingTo(new BigDecimal("712500.00"));
  }

  // =========================================================================
  // Extra: upgrade exactly on day 7 (boundary) → difference only
  // =========================================================================
  @Test
  @DisplayName("upgradeOnDay7Boundary_chargesDifference: exactly 7 days = difference")
  void upgradeOnDay7Boundary_chargesDifference() {
    SubscriptionPlan starter = starterPlan();
    SubscriptionPlan growth  = growthPlan();
    InstitutionSubscription current = subWithStartsAt(starter, OffsetDateTime.now().minusDays(7));

    BigDecimal charge = sut.calculateUpgradeAmount(current, growth);

    // daysSinceStart = 7 → still within the ≤ 7 window → charge difference
    assertThat(charge).isEqualByComparingTo(new BigDecimal("250000"));
  }

  // =========================================================================
  // Extra: null startsAt treated as 99 days → full price
  // =========================================================================
  @Test
  @DisplayName("nullStartsAt_treatedAsOld_chargesFullPrice")
  void nullStartsAt_treatedAsOld_chargesFullPrice() {
    SubscriptionPlan starter = starterPlan();
    SubscriptionPlan growth  = growthPlan();
    InstitutionSubscription current = new InstitutionSubscription(
        starter, "active", null, null, OffsetDateTime.now().plusDays(20));

    BigDecimal charge = sut.calculateUpgradeAmount(current, growth);

    assertThat(charge).isEqualByComparingTo(GROWTH_PRICE);
  }

  // =========================================================================
  // Extra: null renewsAt → validateDowngradeWindow throws
  // =========================================================================
  @Test
  @DisplayName("nullRenewsAt_validateDowngradeWindow_throwsIllegalState")
  void nullRenewsAt_validateDowngradeWindow_throwsIllegalState() {
    SubscriptionPlan growth = growthPlan();
    InstitutionSubscription current = new InstitutionSubscription(
        growth, "active", OffsetDateTime.now().minusDays(15), null, null);

    assertThatThrownBy(() -> sut.validateDowngradeWindow(current))
        .isInstanceOf(IllegalStateException.class);
  }

  // =========================================================================
  // Extra: higher sort order → determineType returns "upgrade"
  // =========================================================================
  @Test
  @DisplayName("higherSortOrder_isUpgradeType: starter→growth returns \"upgrade\"")
  void higherSortOrder_isUpgradeType() {
    SubscriptionPlan starter    = starterPlan();   // sortOrder = 0
    SubscriptionPlan growth     = growthPlan();    // sortOrder = 1

    String type = sut.determineType(starter, growth);

    assertThat(type).isEqualTo("upgrade");
  }

  // =========================================================================
  // Extra: renewal calculateAmount returns plan price regardless of startsAt age
  // =========================================================================
  @Test
  @DisplayName("renewalType_calculateAmount_returnsFullPrice")
  void renewalType_calculateAmount_returnsFullPrice() {
    SubscriptionPlan growth = growthPlan();
    // 20-day-old subscription (would be "full price" for an upgrade)
    InstitutionSubscription current = subWithStartsAt(growth, OffsetDateTime.now().minusDays(20));

    BigDecimal amount = sut.calculateAmount(current, growth, "renewal");

    assertThat(amount).isEqualByComparingTo(GROWTH_PRICE);
  }

  // =========================================================================
  // Extra: applyDiscount with 0% returns original amount unchanged
  // =========================================================================
  @Test
  @DisplayName("applyDiscount_zero_returnsOriginal")
  void applyDiscount_zero_returnsOriginal() {
    BigDecimal result = SubscriptionLifecycleService.applyDiscount(GROWTH_PRICE, BigDecimal.ZERO);

    assertThat(result).isEqualByComparingTo(GROWTH_PRICE);
  }

  // =========================================================================
  // Extra: applyDiscount 2.5% matches reminder scheduler's 3-day discount
  // =========================================================================
  @Test
  @DisplayName("applyDiscount_2point5percent_onGrowth")
  void applyDiscount_2point5percent_onGrowth() {
    // 750,000 × (1 − 0.025) = 731,250.00
    BigDecimal result = SubscriptionLifecycleService.applyDiscount(
        GROWTH_PRICE, new BigDecimal("2.5"));

    assertThat(result).isEqualByComparingTo(new BigDecimal("731250.00"));
  }
}
