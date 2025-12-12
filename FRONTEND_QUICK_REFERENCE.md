# Frontend Quick Reference - API Key Management

## 🎯 What Needs to Be Built

### **Primary Task: API Keys Management Page**

Create a page where users can:
1. ✅ Create new API keys
2. ✅ View all their API keys
3. ✅ Revoke/Delete API keys
4. ✅ See API key statistics

---

## 📍 Page Location
**Route**: `/settings/api-keys` or `/api-keys`  
**Access**: Requires user authentication (JWT token)

---

## 🔑 API Endpoints

### Base URL
```
https://your-api-domain.com
```

### Authentication
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### 1. Create API Key
```http
POST /api-keys
Content-Type: application/json

Body:
{
  "name": "My API Key",           // Required
  "expiresInDays": 90             // Optional (1-365)
}

Response: 201
{
  "id": "uuid",
  "name": "My API Key",
  "key": "xmart_abc123...",       // ⚠️ SHOW ONLY ONCE!
  "prefix": "xmart_ab",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-04-01T00:00:00Z"
}
```

### 2. List API Keys
```http
GET /api-keys

Response: 200
[
  {
    "id": "uuid",
    "name": "My API Key",
    "prefix": "xmart_ab",          // Only prefix shown
    "status": "ACTIVE",            // ACTIVE | REVOKED | EXPIRED
    "lastUsedAt": "2024-01-15T10:30:00Z",
    "expiresAt": "2024-04-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "revokedAt": null
  }
]
```

### 3. Get Statistics
```http
GET /api-keys/stats

Response: 200
{
  "total": 5,
  "active": 3,
  "revoked": 1,
  "expired": 1
}
```

### 4. Revoke API Key
```http
DELETE /api-keys/:id

Response: 200
{
  "id": "uuid",
  "status": "REVOKED",
  "revokedAt": "2024-01-15T12:00:00Z"
}
```

### 5. Delete API Key Permanently
```http
DELETE /api-keys/:id/permanent

Response: 200
{
  "message": "API key deleted successfully"
}
```

---

## 📝 Required Form Fields

### Create API Key Form

| Field | Type | Required | Validation | Notes |
|-------|------|---------|------------|-------|
| `name` | Text | ✅ Yes | Max 100 chars | User-friendly name |
| `expiresInDays` | Number | ❌ No | 1-365 | Optional expiration |

---

## 🎨 UI Components Needed

### 1. **Create API Key Modal**
**Critical Requirements:**
- ⚠️ **Non-dismissible** until user confirms they copied the key
- Show full API key in **monospace font**
- Large **"Copy" button**
- Warning banner: "⚠️ This key will only be shown once. Copy it now!"
- Confirmation checkbox: "I have copied the API key"

**Fields:**
- Name (text input, required)
- Expiration days (number input, optional, 1-365)

### 2. **API Keys List**
**Display for each key:**
- Name
- Prefix (e.g., "xmart_ab...")
- Status badge (Active/Revoked/Expired)
- Created date
- Last used date (if available)
- Expiration date (if set)
- Action buttons: [Revoke] [Delete]

**Status Colors:**
- Active: Green
- Revoked: Red
- Expired: Gray

### 3. **Statistics Card**
Show:
- Total keys
- Active keys
- Revoked keys
- Expired keys

---

## 📊 TypeScript Types

```typescript
// Create API Key Request
interface CreateApiKeyRequest {
  name: string;              // Required, max 100 chars
  expiresInDays?: number;    // Optional, 1-365
}

// Create API Key Response
interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;               // ⚠️ Only in create response!
  prefix: string;
  createdAt: string;
  expiresAt?: string;
}

// API Key List Item
interface ApiKeyListItem {
  id: string;
  name: string;
  prefix: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  revokedAt?: string;
}

// API Key Statistics
interface ApiKeyStats {
  total: number;
  active: number;
  revoked: number;
  expired: number;
}
```

---

## ⚠️ Critical Warnings

1. **API Key Display**: The full key is **ONLY shown once** when created. User must copy it immediately.

2. **Security**: Never store API keys in localStorage. Only show in memory.

3. **Masking**: Always mask API keys in displays (show only prefix: "xmart_ab...")

4. **Confirmation**: Require confirmation for destructive actions (revoke/delete)

---

## 🚀 Implementation Steps

1. **Create API service** for API key endpoints
2. **Create page component** (`ApiKeysPage.tsx`)
3. **Create Create API Key modal** with key display
4. **Create API Keys list component**
5. **Create statistics card component**
6. **Add to navigation** (Settings menu)
7. **Add error handling** and loading states
8. **Add toast notifications** for success/error

---

## 📱 Example Page Layout

```
┌─────────────────────────────────────────┐
│  API Keys                                │
├─────────────────────────────────────────┤
│  [+ Create New API Key]                  │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ Statistics                         │ │
│  │ Total: 5  Active: 3  Revoked: 2    │ │
│  └───────────────────────────────────┘ │
│                                         │
│  Your API Keys:                         │
│  ┌───────────────────────────────────┐ │
│  │ Production Key                    │ │
│  │ xmart_ab...                       │ │
│  │ Status: Active                   │ │
│  │ Created: Jan 1, 2024              │ │
│  │ Last Used: 2 hours ago            │ │
│  │ [Revoke] [Delete]                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🔗 Related Endpoints

### User Address Management (Also Added)
- `GET /users/me/addresses` - List addresses
- `POST /users/me/addresses` - Create address
- `PUT /users/me/addresses/:id` - Update address
- `DELETE /users/me/addresses/:id` - Delete address
- `PUT /users/me/addresses/:id/default` - Set default

---

## ✅ Checklist

- [ ] Create API Keys page
- [ ] Create API key service
- [ ] Create API key form
- [ ] Create API key modal (with key display)
- [ ] Create API keys list
- [ ] Create statistics card
- [ ] Add revoke functionality
- [ ] Add delete functionality
- [ ] Add to navigation
- [ ] Add error handling
- [ ] Add loading states
- [ ] Add toast notifications
- [ ] Test all flows

---

**See `FRONTEND_INTEGRATION_GUIDE.md` for complete documentation.**

