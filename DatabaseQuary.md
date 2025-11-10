// ============================================
// DATABASE QUERIES FOR ANALYSIS
// ============================================
/\*

-- Total deposits by network
SELECT
network,
COUNT(\*) as deposit_count,
SUM(amount) as total_volume
FROM deposits
WHERE status = 'COMPLETED'
GROUP BY network;

-- Average confirmation time
SELECT
network,
AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))) / 60 as avg_minutes
FROM deposits
WHERE status = 'COMPLETED'
GROUP BY network;

-- Pending deposits (alert if > 1 hour)
SELECT
d.id,
d.tx_hash,
d.amount,
d.network,
d.confirmations,
d.required_confirms,
u.email,
EXTRACT(EPOCH FROM (NOW() - d.created_at)) / 60 as minutes_pending
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE d.status = 'PENDING'
AND d.created_at < NOW() - INTERVAL '1 hour';

-- Top depositors
SELECT
u.email,
COUNT(d.id) as deposit_count,
SUM(d.amount) as total_deposited
FROM deposits d
JOIN wallets w ON d.wallet_id = w.id
JOIN users u ON w.user_id = u.id
WHERE d.status = 'COMPLETED'
GROUP BY u.id, u.email
ORDER BY total_deposited DESC
LIMIT 10;

-- Deposit success rate
SELECT
COUNT(_) FILTER (WHERE status = 'COMPLETED') as completed,
COUNT(_) FILTER (WHERE status = 'FAILED') as failed,
COUNT(_) FILTER (WHERE status = 'PENDING') as pending,
ROUND(
100.0 _ COUNT(_) FILTER (WHERE status = 'COMPLETED') /
NULLIF(COUNT(_), 0),
2
) as success_rate_percent
FROM deposits;

\*/

// ============================================
// DATABASE QUERIES FOR MONITORING
// ============================================
/\*

-- Pending withdrawals needing approval
SELECT
w.id,
w.amount,
w.network_fee,
w.to_address,
u.email,
w.created_at,
EXTRACT(EPOCH FROM (NOW() - w.created_at)) / 60 as minutes_pending
FROM withdrawals w
JOIN wallets wal ON w.wallet_id = wal.id
JOIN users u ON wal.user_id = u.id
WHERE w.status = 'PENDING'
AND w.approved_at IS NULL
ORDER BY w.created_at ASC;

-- Failed withdrawals in last 24 hours
SELECT
w.id,
w.amount,
w.to_address,
w.failure_reason,
u.email,
w.created_at
FROM withdrawals w
JOIN wallets wal ON w.wallet_id = wal.id
JOIN users u ON wal.user_id = u.id
WHERE w.status = 'FAILED'
AND w.created_at > NOW() - INTERVAL '24 hours'
ORDER BY w.created_at DESC;

-- Withdrawal volume by user
SELECT
u.email,
COUNT(w.id) as withdrawal_count,
SUM(w.amount) as total_withdrawn,
AVG(w.amount) as avg_withdrawal
FROM withdrawals w
JOIN wallets wal ON w.wallet_id = wal.id
JOIN users u ON wal.user_id = u.id
WHERE w.status = 'COMPLETED'
GROUP BY u.id, u.email
ORDER BY total_withdrawn DESC
LIMIT 10;

-- Average processing time
SELECT
network,
AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) / 60 as avg_minutes
FROM withdrawals
WHERE status = 'COMPLETED'
GROUP BY network;

-- Hot wallet should be funded alert
SELECT
'HOT_WALLET_LOW_BALANCE' as alert_type,
'Immediate action required' as priority
WHERE EXISTS (
SELECT 1 FROM withdrawals
WHERE status = 'FAILED'
AND failure_reason LIKE '%Insufficient hot wallet balance%'
AND created_at > NOW() - INTERVAL '1 hour'
);

\*/
