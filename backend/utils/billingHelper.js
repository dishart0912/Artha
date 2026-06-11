// utils/billingHelper.js

/**
 * Determines billing status based on the card's billing date.
 *
 * @param {number} billingDate - Day of month when card generates statement (e.g., 15)
 * @returns {"billed" | "unbilled"}
 *
 * Logic:
 *   - today's date < billingDate  → unbilled (statement not yet generated)
 *   - today's date >= billingDate → billed   (this month's statement is out)
 */
function calculateBillingStatus(billingDate) {
  const today = new Date();
  const todayDate = today.getDate(); // e.g., 9 for June 9

  if (todayDate < billingDate) {
    return "unbilled";
  } else {
    return "billed";
  }
}

module.exports = { calculateBillingStatus };