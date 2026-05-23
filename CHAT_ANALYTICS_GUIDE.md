# 📊 Chat Analytics Guide

## Overview

Every user prompt and AI response is automatically saved to the database, allowing you to analyze user preferences, shopping behavior, and conversation patterns.

## Database Schema

### ChatSession
```sql
chat_sessions {
  id: UUID (PK)
  userId: UUID (FK to users) - NULL for guest sessions
  guestId: string - Anonymous identifier for non-logged-in users
  context: JSON - Custom metadata
  createdAt: timestamp
  updatedAt: timestamp
  expiresAt: timestamp - Auto-expires after 24 hours
}
```

### ChatMessage
```sql
chat_messages {
  id: UUID (PK)
  sessionId: UUID (FK to chat_sessions)
  role: enum("USER", "ASSISTANT", "SYSTEM")
  content: TEXT - The actual message content
  metadata: JSON - Products shown, cart actions, etc.
  toolCalls: JSON - AI tool executions (search_products, add_to_cart, etc.)
  createdAt: timestamp
}
```

**Indexes:**
- `userId` (for user-specific queries)
- `guestId` (for anonymous user tracking)
- `createdAt` (for time-based analytics)
- `sessionId` (for fetching conversation threads)

---

## API Endpoints

All analytics endpoints require authentication. Admin endpoints require `ADMIN` or `SUPER_ADMIN` role.

### 1. Get My Preferences

**User Endpoint** - Analyze your own chat history

```http
GET /api/v1/chat-analytics/my-preferences
Authorization: Bearer {access_token}
```

**Response:**
```json
{
  "userId": "uuid",
  "totalSessions": 42,
  "totalMessages": 380,
  "averageMessagesPerSession": 9.05,
  "topSearchedCategories": [
    { "category": "electronics", "count": 28 },
    { "category": "beauty", "count": 15 },
    { "category": "food", "count": 12 }
  ],
  "topSearchedProducts": [
    { "product": "laptop", "count": 8 },
    { "product": "phone", "count": 6 },
    { "product": "headphones", "count": 5 }
  ],
  "commonPriceRanges": [
    { "range": "50-100", "count": 18 },
    { "range": "10-50", "count": 12 },
    { "range": "100-500", "count": 8 }
  ],
  "popularNetworks": [
    { "network": "POLYGON", "count": 15 },
    { "network": "ETHEREUM", "count": 10 },
    { "network": "SUI", "count": 7 }
  ],
  "popularStablecoins": [
    { "stablecoin": "USDC", "count": 22 },
    { "stablecoin": "USDT", "count": 18 }
  ],
  "mostActiveHours": [
    { "hour": 14, "count": 45 },
    { "hour": 20, "count": 38 },
    { "hour": 10, "count": 30 }
  ],
  "conversionMetrics": {
    "sessionsWithCartAdd": 25,
    "sessionsWithOrder": 12,
    "conversionRate": 28.57
  }
}
```

### 2. Get User Preferences (Admin)

**Admin Endpoint** - Analyze a specific user's chat history

```http
GET /api/v1/chat-analytics/user-preferences/{userId}
Authorization: Bearer {admin_access_token}
```

Same response format as `/my-preferences`.

### 3. Platform-Wide Analytics (Admin)

**Admin Endpoint** - Analyze all chat data across the platform

```http
GET /api/v1/chat-analytics/platform?startDate=2025-01-01&endDate=2025-02-28
Authorization: Bearer {admin_access_token}
```

**Query Parameters:**
- `startDate` (optional): ISO date string (e.g., "2025-01-01")
- `endDate` (optional): ISO date string (e.g., "2025-02-28")

**Response:**
```json
{
  "totalUsers": 1250,
  "totalSessions": 8450,
  "totalMessages": 75230,
  "topCategories": [
    { "category": "electronics", "count": 1850 },
    { "category": "beauty", "count": 1420 },
    { "category": "food", "count": 980 }
  ],
  "topProducts": [
    { "product": "laptop", "count": 520 },
    { "product": "phone", "count": 480 },
    { "product": "headphones", "count": 350 }
  ],
  "dailyActiveUsers": [
    { "date": "2025-01-01", "users": 145 },
    { "date": "2025-01-02", "users": 168 },
    { "date": "2025-01-03", "users": 152 }
  ]
}
```

### 4. Product Interest Analysis (Admin)

**Admin Endpoint** - Analyze product interest trends (last 30 days)

```http
GET /api/v1/chat-analytics/product-interest
Authorization: Bearer {admin_access_token}
```

**Response:**
```json
{
  "productMentions": [
    { "productName": "laptop", "mentions": 450 },
    { "productName": "phone", "mentions": 380 },
    { "productName": "keyboard", "mentions": 220 }
  ],
  "categoryInterest": [
    { "category": "electronics", "searches": 1850 },
    { "category": "beauty", "searches": 920 }
  ],
  "pricePreferences": {
    "avgMin": 45.00,
    "avgMax": 280.00
  }
}
```

### 5. Search Chat History (Admin)

**Admin Endpoint** - Search all chat messages for specific keywords

```http
GET /api/v1/chat-analytics/search?keyword=macbook&userId={optional}
Authorization: Bearer {admin_access_token}
```

**Query Parameters:**
- `keyword` (required): Search term (case-insensitive)
- `userId` (optional): Filter by specific user

**Response:**
```json
{
  "matches": 47,
  "sessions": [
    {
      "sessionId": "uuid",
      "userId": "uuid",
      "matches": [
        "Show me macbook pro laptops",
        "How much is the macbook air?",
        "Add the macbook pro to my cart"
      ]
    }
  ]
}
```

---

## Use Cases

### 1. Personalized Product Recommendations

**Goal:** Recommend products based on user's search history

**API Call:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/my-preferences" \
  -H "Authorization: Bearer {token}"
```

**Implementation:**
```typescript
const preferences = await api.get('/chat-analytics/my-preferences');

// Show products from user's top categories
const topCategory = preferences.topSearchedCategories[0].category;
const recommendedProducts = await api.get(`/products?category=${topCategory}`);
```

### 2. Marketing Campaigns

**Goal:** Target users interested in specific product categories

**API Call:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/search?keyword=electronics" \
  -H "Authorization: Bearer {admin_token}"
```

**Result:** Get list of all users who searched for electronics

### 3. Inventory Planning

**Goal:** Stock products based on demand signals from chat data

**API Call:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/product-interest" \
  -H "Authorization: Bearer {admin_token}"
```

**Implementation:**
```typescript
const analysis = await api.get('/chat-analytics/product-interest');

// Identify trending products
const trending = analysis.productMentions
  .filter(p => p.mentions > 50)
  .slice(0, 10);

// Ensure these products are well-stocked
```

### 4. User Behavior Analysis

**Goal:** Understand when users are most active

**API Call:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/platform" \
  -H "Authorization: Bearer {admin_token}"
```

**Result:**
- Daily active users chart
- Peak activity hours
- Conversion metrics

### 5. A/B Testing Insights

**Goal:** Measure impact of new features on user engagement

**Before Feature Launch:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/platform?startDate=2025-01-01&endDate=2025-01-15"
```

**After Feature Launch:**
```bash
curl -X GET "https://api.0xmart.com/api/v1/chat-analytics/platform?startDate=2025-01-16&endDate=2025-01-31"
```

**Compare:**
- Average messages per session
- Conversion rates
- Session duration (inferred from message timestamps)

---

## Data Retention & Privacy

### Current Implementation

1. **24-Hour Session Expiry:**
   - Sessions automatically expire after 24 hours
   - Run cleanup job to delete expired sessions:
     ```typescript
     // In SessionService
     await sessionService.deleteExpiredSessions();
     ```

2. **User Data Access:**
   - Users can view their own analytics via `/my-preferences`
   - Users CANNOT see other users' data

3. **GDPR Compliance:**
   - Add user data deletion endpoint (recommended):
     ```typescript
     @Delete('chat-analytics/my-data')
     async deleteMyData(@CurrentUser() user: any) {
       await this.prisma.chatSession.deleteMany({
         where: { userId: user.id }
       });
       return { message: 'All your chat data has been deleted' };
     }
     ```

### Recommended: Scheduled Cleanup Job

Add to your backend (e.g., in a cron service):

```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ChatCleanupService {
  constructor(private sessionService: SessionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredSessions() {
    const deleted = await this.sessionService.deleteExpiredSessions();
    console.log(`Cleaned up ${deleted} expired chat sessions`);
  }
}
```

---

## Frontend Integration Example

### User Preferences Dashboard

```tsx
// components/analytics/MyPreferences.tsx
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export function MyPreferences() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPreferences() {
      try {
        const data = await api.get('/chat-analytics/my-preferences');
        setInsights(data);
      } catch (error) {
        console.error('Failed to fetch preferences:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchPreferences();
  }, []);

  if (loading) return <div>Loading your preferences...</div>;
  if (!insights) return <div>No data available</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Your Shopping Preferences</h2>

      {/* Top Categories */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Favorite Categories</h3>
        <div className="flex gap-2">
          {insights.topSearchedCategories.slice(0, 3).map(cat => (
            <span key={cat.category} className="px-3 py-1 bg-blue-100 rounded-full">
              {cat.category} ({cat.count})
            </span>
          ))}
        </div>
      </div>

      {/* Price Preferences */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Your Price Range</h3>
        <div className="text-sm text-gray-600">
          You typically search for products in the{' '}
          <strong>{insights.commonPriceRanges[0]?.range}</strong> range
        </div>
      </div>

      {/* Conversion Rate */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Activity</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{insights.totalSessions}</div>
            <div className="text-sm text-gray-600">Chat Sessions</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{insights.conversionMetrics.sessionsWithOrder}</div>
            <div className="text-sm text-gray-600">Orders Placed</div>
          </div>
          <div className="p-4 bg-gray-50 rounded">
            <div className="text-2xl font-bold">{insights.conversionMetrics.conversionRate.toFixed(1)}%</div>
            <div className="text-sm text-gray-600">Conversion Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## SQL Queries (Direct Database Access)

If you prefer direct database queries:

### Most Popular Products (Last 30 Days)

```sql
SELECT
  content,
  COUNT(*) as mentions
FROM chat_messages
WHERE
  role = 'USER'
  AND created_at > NOW() - INTERVAL '30 days'
  AND (
    content ILIKE '%laptop%' OR
    content ILIKE '%phone%' OR
    content ILIKE '%keyboard%'
  )
GROUP BY content
ORDER BY mentions DESC
LIMIT 20;
```

### User Engagement by Hour

```sql
SELECT
  EXTRACT(HOUR FROM created_at) as hour,
  COUNT(DISTINCT session_id) as sessions
FROM chat_messages
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY hour
ORDER BY hour;
```

### Conversion Funnel

```sql
WITH funnel AS (
  SELECT
    cs.id,
    BOOL_OR(cm.metadata::text LIKE '%search_products%') as searched,
    BOOL_OR(cm.metadata::text LIKE '%add_to_cart%') as added_to_cart,
    BOOL_OR(cm.metadata::text LIKE '%place_order%') as placed_order
  FROM chat_sessions cs
  JOIN chat_messages cm ON cs.id = cm.session_id
  WHERE cs.created_at > NOW() - INTERVAL '30 days'
  GROUP BY cs.id
)
SELECT
  COUNT(*) as total_sessions,
  SUM(CASE WHEN searched THEN 1 ELSE 0 END) as searched,
  SUM(CASE WHEN added_to_cart THEN 1 ELSE 0 END) as added_to_cart,
  SUM(CASE WHEN placed_order THEN 1 ELSE 0 END) as placed_order
FROM funnel;
```

---

## Performance Optimization

### 1. Add Indexes (Already Done)

The schema already includes indexes on:
- `userId` - Fast user-specific queries
- `guestId` - Anonymous user tracking
- `sessionId` - Conversation thread retrieval
- `createdAt` - Time-based analytics

### 2. Implement Caching

Cache frequently accessed analytics:

```typescript
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ChatAnalyticsService {
  constructor(
    private prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getPlatformAnalytics() {
    const cacheKey = 'platform-analytics';
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) return cached;

    const data = await this.calculatePlatformAnalytics();
    await this.cacheManager.set(cacheKey, data, 3600); // 1 hour TTL

    return data;
  }
}
```

### 3. Batch Processing

For large-scale analytics, use background jobs:

```typescript
@Cron(CronExpression.EVERY_HOUR)
async generateAnalyticsReport() {
  const report = await this.analyticsService.getPlatformAnalytics();
  await this.cacheManager.set('latest-report', report, 3600);
}
```

---

## Next Steps

1. ✅ **Already Working:** All prompts are being saved
2. ✅ **Analytics API:** Ready to use
3. 🔨 **Implement Cleanup Job:** Add scheduled task to delete expired sessions
4. 🔨 **Add User Data Export:** Allow users to download their chat history (GDPR)
5. 🔨 **Build Admin Dashboard:** Visualize analytics in the admin panel
6. 🔨 **Implement Caching:** Cache frequently accessed analytics

## Testing

Start the backend:
```bash
cd 0xmart-backend
npm run start:dev
```

Test the endpoints:
```bash
# Get your own preferences
curl -X GET "http://localhost:8000/api/v1/chat-analytics/my-preferences" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Admin: Platform analytics
curl -X GET "http://localhost:8000/api/v1/chat-analytics/platform" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

Check Swagger UI: `http://localhost:8000/api/v1/docs#/Chat%20Analytics`
