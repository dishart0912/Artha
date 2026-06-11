// utils/messageParser.js

/**
 * Category keyword map.
 * Keys are what we detect in the message (lowercase).
 * Values are the category names stored in MongoDB.
 */
const CATEGORY_KEYWORDS = {
  fuel: "fuel",
  petrol: "fuel",
  diesel: "fuel",
  food: "food",
  swiggy: "food",
  zomato: "food",
  eat: "food",
  amazon: "shopping",
  flipkart: "shopping",
  shopping: "shopping",
  rent: "bills",
  electricity: "bills",
  internet: "bills",
  medical: "medical",
  pharmacy: "medical",
  doctor: "medical",
};

/**
 * Detects category by scanning all tokens against CATEGORY_KEYWORDS.
 * Falls back to "general" if no keyword matches.
 */
function detectCategory(tokens) {
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (CATEGORY_KEYWORDS[lower]) {
      return CATEGORY_KEYWORDS[lower];
    }
  }
  return "general";
}

/**
 * Main parser function.
 *
 * Input:  "500 fuel hdfc"
 * Output: { amount: 500, merchant: "fuel", category: "food", bankKeyword: "hdfc" }
 *
 * Rules:
 * - First numeric token = amount
 * - Last token = bankKeyword (card identifier)
 * - Tokens between first number and last = merchant (joined with space)
 * - Category detected from ALL tokens
 */
function parseExpenseMessage(rawMessage) {
  if (!rawMessage || typeof rawMessage !== "string") {
    return { success: false, error: "Empty or invalid message" };
  }

  // Normalize: lowercase, collapse extra spaces, split into tokens
  const tokens = rawMessage.trim().toLowerCase().split(/\s+/);

  if (tokens.length < 3) {
    return {
      success: false,
      error:
        'Message too short. Format: "<amount> <merchant> <bank>" e.g. "500 fuel hdfc"',
    };
  }

  // --- Extract amount (first numeric token) ---
  const amountToken = tokens[0];
  const amount = parseFloat(amountToken);

  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      error: `"${amountToken}" is not a valid amount. Start your message with a number like "500".`,
    };
  }

  // --- Extract bankKeyword (last token) ---
  const bankKeyword = tokens[tokens.length - 1];

  // --- Extract merchant (everything between amount and bank) ---
  // tokens[0] = amount, tokens[last] = bank, middle = merchant
  const merchantTokens = tokens.slice(1, tokens.length - 1);
  const merchant = merchantTokens.join(" ");

  if (!merchant) {
    return {
      success: false,
      error: 'Missing merchant name. Format: "<amount> <merchant> <bank>"',
    };
  }

  // --- Detect category from all tokens ---
  const category = detectCategory(tokens);

  return {
    success: true,
    amount,
    merchant,
    category,
    bankKeyword,
  };
}

module.exports = { parseExpenseMessage };