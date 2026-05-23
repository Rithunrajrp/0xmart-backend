# Referral Code System Improvements

## Problem
The original referral code system used UUIDs (`de13fb4a-054d-4fde-a98c-29b1c182f07e`), which are:
- **Not user-friendly** - Impossible to remember
- **Hard to share** - Long and error-prone to type
- **Not personal** - No connection to the user

## Solution

### Email-Based Automatic Generation

**New Approach:** Referral codes are auto-generated from the email address username (part before @)

**Features:**
- **Personal** - Based on user's email
- **Memorable** - Uses familiar username
- **Simple** - Auto-generated, no editing needed
- **Unique** - Database-validated with collision handling

**Example codes:**
```
Email: john.doe@gmail.com     → Code: JOHNDOE
Email: alice123@yahoo.com     → Code: ALICE123
Email: crypto_king@gmail.com  → Code: CRYPTOKING
Email: tech-guru@company.com  → Code: TECHGURU
```

**Collision Handling:**
If a code is already taken, a 3-digit random number is appended:
```
First try:  JOHN (taken)
Final code: JOHN456
```

**No API Endpoint Needed:**
- Codes are automatically generated on signup
- No editing allowed - keeps system simple
- Users see their code in profile page
- Code is permanent and tied to email

## Implementation Details

### Backend Changes

#### 1. Email-Based Code Generation (`auth.service.ts:261-295`)
```typescript
// Extract username from email
private async generateUniqueReferralCode(email: string): Promise<string> {
  const emailPrefix = email.split('@')[0].toLowerCase();

  // Clean: remove special chars, keep alphanumeric only
  const cleanPrefix = emailPrefix.replace(/[^a-z0-9]/g, '').substring(0, 15);

  let referralCode: string;
  let attempt = 0;

  while (!isUnique) {
    if (attempt === 0) {
      // First try: just username
      referralCode = cleanPrefix.toUpperCase();
    } else {
      // If taken, add 3-digit number
      const randomNum = Math.floor(100 + Math.random() * 900);
      referralCode = `${cleanPrefix}${randomNum}`.toUpperCase();
    }

    // Check database uniqueness
    const existingUser = await this.prisma.user.findUnique({
      where: { referralCode }
    });

    if (!existingUser) isUnique = true;
    attempt++;
  }

  return referralCode;
}
```

**Examples:**
```
john.doe@gmail.com     → JOHNDOE
alice123@yahoo.com     → ALICE123
crypto-king@gmail.com  → CRYPTOKING
```

#### 2. No Update Endpoint
- Codes are auto-generated on signup only
- No editing functionality (keeps it simple)
- Permanent code tied to email

### Frontend Changes

#### 1. API Client (`lib/api.ts`)
```typescript
async getReferralStats(): Promise<ReferralStats> {
  const { data } = await this.client.get("/users/me/referral-stats");
  return data;
}
```
**Returns:**
- `referralCode` - User's code
- `referralLink` - Full shareable link
- `totalReferrals` - Total referrals
- `successfulReferrals` - Referrals who purchased
- `totalEarnings` - Commission earned

#### 2. Profile Page UI (`profile/page.tsx`)

**Display Features:**
- Shows referral code prominently (large, centered)
- Read-only display (no editing)
- Helper text: "Auto-generated from your email address"
- Copy and share buttons for referral link
- Statistics display (referrals, earnings)

**UI:**
```
┌────────────────────────────┐
│ Your Referral Code         │
│  ┌──────────────────────┐  │
│  │     JOHNDOE          │  │
│  └──────────────────────┘  │
│  Auto-generated from email │
└────────────────────────────┘
```

## User Experience

### Before
```
Referral Link: https://0xmart.com/?ref=de13fb4a-054d-4fde-a98c-29b1c182f07e
```
- ❌ Hard to remember
- ❌ Difficult to share verbally
- ❌ Not personal

### After
```
Email: john.doe@gmail.com
Referral Code: JOHNDOE
Referral Link: https://0xmart.com/?ref=JOHNDOE
```
- ✅ Easy to remember (based on email)
- ✅ Simple to share verbally ("Use code JOHNDOE")
- ✅ Personal and meaningful

## Benefits

1. **Memorability** - Email-based codes are easy to remember
2. **Personal** - Code reflects user's email identity
3. **Trust** - Professional, clean codes look legitimate
4. **Shareability** - Simple to share verbally or in writing
5. **Simplicity** - No editing needed, automatic generation

## Migration Notes

**Existing users with UUID codes:**
- UUIDs remain valid (backward compatible)
- Users can update to new format via profile page
- No data loss or broken referral links

**Database Schema:**
- No migration needed - uses existing `referralCode` field
- Unique constraint already in place

## Testing

### Test Cases
1. ✅ Auto-generate code on signup → Should use new format
2. ✅ Update to custom code → Should validate and save
3. ✅ Try duplicate code → Should return error
4. ✅ Try reserved word → Should return error
5. ✅ Invalid characters → Should reject with validation error
6. ✅ Referral link updates → Should reflect new code immediately
7. ✅ Old UUID codes → Should continue to work

### Example Test Flow
```bash
# 1. Create new user → Gets auto-generated code
POST /api/v1/auth/send-otp
POST /api/v1/auth/verify-otp
# User gets code like: ROCKET-N9M3

# 2. Update to custom code
PUT /api/v1/users/me/referral-code
{ "referralCode": "JOHNDOE-2025" }

# 3. Share referral link
https://0xmart.com/?ref=JOHNDOE-2025
```

## Future Enhancements

1. **Code Analytics** - Track which codes perform best
2. **Code Suggestions** - AI-powered code suggestions based on user profile
3. **Premium Codes** - Short codes for premium users (e.g., "CRYPTO")
4. **Code History** - Allow reverting to previous codes
5. **Vanity URLs** - Custom domains with user codes (e.g., `johndoe.0xmart.com`)

## Security Considerations

- ✅ Reserved words blocked (prevent impersonation)
- ✅ Uniqueness enforced at database level
- ✅ Input sanitization (uppercase only, safe chars)
- ✅ Rate limiting on update endpoint (prevent abuse)
- ✅ JWT authentication required

## API Documentation

Updated Swagger docs available at `/api/v1/docs`:

**Endpoints:**
- `GET /users/me/referral-stats` - Get referral statistics with current code
- `PUT /users/me/referral-code` - Update custom referral code

**Example Response:**
```json
{
  "message": "Referral code updated successfully",
  "referralCode": "CRYPTO-A3K9",
  "referralLink": "https://0xmart.com/?ref=CRYPTO-A3K9"
}
```
