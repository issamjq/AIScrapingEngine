import { query } from "../db"

/** Get wallet for a user. Returns null if not found. */
export async function getWallet(userEmail: string) {
  const { rows } = await query(
    `SELECT * FROM user_wallet WHERE user_email = $1 LIMIT 1`,
    [userEmail]
  )
  return rows[0] || null
}

/** Create wallet with an initial balance and log a signup_bonus transaction. */
export async function createWallet(userEmail: string, initialCredits: number) {
  const { rows } = await query(
    `INSERT INTO user_wallet (user_email, balance, total_added)
     VALUES ($1, $2, $2)
     ON CONFLICT (user_email) DO NOTHING
     RETURNING *`,
    [userEmail, initialCredits]
  )
  const wallet = rows[0]
  if (wallet && initialCredits > 0) {
    await query(
      `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
       VALUES ($1, $2, $2, 'signup_bonus', 'Trial credits on signup')`,
      [userEmail, initialCredits]
    )
  }
  return wallet
}

/**
 * Deduct 1 credit from wallet.
 * Returns { success: true } or { success: false, balance } if insufficient.
 */
export async function deductCredit(userEmail: string): Promise<{ success: boolean; balance: number }> {
  // Atomic deduct — only if balance > 0
  const { rows } = await query(
    `UPDATE user_wallet
     SET balance    = balance - 1,
         total_used = total_used + 1,
         updated_at = NOW()
     WHERE user_email = $1 AND balance > 0
     RETURNING balance`,
    [userEmail]
  )
  if (!rows.length) {
    const wallet = await getWallet(userEmail)
    return { success: false, balance: wallet?.balance ?? 0 }
  }
  const newBalance = rows[0].balance
  await query(
    `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
     VALUES ($1, -1, $2, 'usage', 'AI search credit used')`,
    [userEmail, newBalance]
  )
  return { success: true, balance: newBalance }
}

/**
 * Deduct N credits from wallet atomically.
 * Returns { success: true } or { success: false, balance } if insufficient.
 */
export async function deductCredits(
  userEmail:   string,
  amount:      number,
  description: string
): Promise<{ success: boolean; balance: number }> {
  const { rows } = await query(
    `UPDATE user_wallet
     SET balance    = balance - $2,
         total_used = total_used + $2,
         updated_at = NOW()
     WHERE user_email = $1 AND balance >= $2
     RETURNING balance`,
    [userEmail, amount]
  )
  if (!rows.length) {
    const wallet = await getWallet(userEmail)
    return { success: false, balance: wallet?.balance ?? 0 }
  }
  const newBalance = rows[0].balance
  await query(
    `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
     VALUES ($1, $2, $3, 'usage', $4)`,
    [userEmail, -amount, newBalance, description]
  )
  return { success: true, balance: newBalance }
}

/** Add credits to wallet (top-up / adjustment). */
export async function addCredits(userEmail: string, amount: number, type: string, description: string) {
  const { rows } = await query(
    `UPDATE user_wallet
     SET balance    = balance + $2,
         total_added = total_added + $2,
         updated_at = NOW()
     WHERE user_email = $1
     RETURNING balance`,
    [userEmail, amount]
  )
  if (!rows.length) throw new Error("Wallet not found for " + userEmail)
  const newBalance = rows[0].balance
  await query(
    `INSERT INTO wallet_transactions (user_email, amount, balance_after, type, description)
     VALUES ($1, $2, $3, $4, $5)`,
    [userEmail, amount, newBalance, type, description]
  )
  return newBalance
}

/** Get recent transaction history for a user. */
export async function getTransactions(userEmail: string, limit = 20) {
  const { rows } = await query(
    `SELECT * FROM wallet_transactions WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2`,
    [userEmail, limit]
  )
  return rows
}
