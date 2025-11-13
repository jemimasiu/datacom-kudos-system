# Kudos System Specification

## Functional Requirements

### User Stories

1. **As a user**, I can select another user from a dropdown list (excluding myself) to send kudos to.
2. **As a user**, I can write a message of appreciation (max 500 characters) to express my gratitude.
3. **As a user**, I can submit the kudos which gets stored in the database and appears in the public feed.
4. **As a user**, I can view a feed of recent kudos on the dashboard showing sender, recipient, timestamp, and message.
5. **As an administrator**, I can hide or delete inappropriate kudos messages so the feed remains professional.

### Acceptance Criteria

#### User Story 1: Select User from Dropdown
- Dropdown list displays all users except the current user
- Dropdown is populated on page load from `/api/users` endpoint
- Selected user is required before form submission
- User cannot select themselves (server-side validation enforced)

#### User Story 2: Write Message
- Textarea allows input up to 500 characters
- Character counter displays current count (X/500) and updates in real-time
- Message is required before form submission
- Message is trimmed of leading/trailing whitespace
- Message must be between 1-500 characters after trimming (server-side validation)

#### User Story 3: Submit Kudos
- Form submission creates a new kudos via `POST /api/kudos`
- Success feedback is displayed after successful submission
- Form is cleared after successful submission
- Feed automatically refreshes to show the new kudos
- Validation errors are displayed if submission fails
- Duplicate submissions (same sender→recipient+message within 60s) are rejected
- Messages containing banned words are rejected
- Self-kudos attempts are rejected

#### User Story 4: View Feed
- Feed displays all visible kudos sorted by newest first
- Each kudos card shows:
  - Sender name and title
  - Recipient name and title
  - Formatted timestamp (date and time)
  - Message content
- Feed can be manually refreshed via "Refresh" button
- Empty state is shown when no kudos exist
- Only kudos with `is_visible = true` appear in the feed

#### User Story 5: Admin Moderation
- Admin users see Hide/Unhide/Delete buttons on each kudos card
- Hide action prompts for optional reason and sets `is_visible = false`
- Unhide action restores `is_visible = true` and clears moderation fields
- Delete action requires confirmation and permanently removes the kudos
- Feed updates immediately after any moderation action
- Non-admin users receive 401 Unauthorized when attempting moderation
- All moderation actions are logged with admin ID, action type, timestamp, and reason

### Edge Cases & Validation Rules

#### Spam Prevention
- Reject duplicate identical messages from the same sender to the same recipient within 60 seconds
- Detection: same `senderId` → `recipientId` with identical trimmed message within last 60s
- Error message: "Duplicate submission detected. Please wait before sending the same message again."

#### Inappropriate Content
- Check message against a banned words list (case-insensitive)
- Reject with 400 error if banned words are detected
- Error message: "Message contains inappropriate content."
- Server-side validation required (cannot rely on client-side only)

#### Self-Kudos Prevention
- Prevent users from sending kudos to themselves
- Server-side validation: `senderId` must not equal `recipientId`
- Error message: "You cannot send kudos to yourself."

#### Input Sanitization
- Server-side HTML escaping to prevent XSS attacks
- Trim leading/trailing whitespace from messages
- Normalize line breaks and special characters
- All user input is sanitized before storage

## Technical Design

### Database Schema

**Table: `kudos`**
```sql
CREATE TABLE kudos (
  id VARCHAR(255) PRIMARY KEY,
  senderId VARCHAR(255) NOT NULL,
  recipientId VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  createdAt DATETIME NOT NULL,
  is_visible BOOLEAN DEFAULT TRUE,
  moderated_by VARCHAR(255) NULL,
  moderated_at DATETIME NULL,
  reason_for_moderation TEXT NULL,
  FOREIGN KEY (moderated_by) REFERENCES users(id),
  FOREIGN KEY (senderId) REFERENCES users(id),
  FOREIGN KEY (recipientId) REFERENCES users(id),
  CHECK (senderId != recipientId),
  CHECK (LENGTH(TRIM(message)) >= 1 AND LENGTH(TRIM(message)) <= 500)
);
```

**Table: `users`** (assumed existing)
```sql
CREATE TABLE users (
  id VARCHAR(255) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE
);
```

**Note**: Current implementation uses in-memory storage. Database migration will follow this schema structure.

### API Endpoints

#### GET `/api/current-user`
Returns the currently authenticated user with admin status.

**Response:**
```json
{
  "user": {
    "id": "u1",
    "name": "Jordan Lee",
    "title": "Software Engineer",
    "isAdmin": false
  }
}
```

#### GET `/api/users`
Returns list of colleagues (excludes current user).

**Response:**
```json
{
  "users": [
    { "id": "u0", "name": "Alex Morgan", "title": "Product Manager" },
    { "id": "u2", "name": "Priya Desai", "title": "UX Designer" }
  ]
}
```

#### GET `/api/kudos`
Returns all visible kudos, sorted by newest first.

**Query Parameters (future):**
- `limit` (optional): Number of results per page
- `offset` (optional): Pagination offset

**Response:**
```json
{
  "kudos": [
    {
      "id": "k1",
      "senderId": "u1",
      "recipientId": "u2",
      "message": "Thanks for the quick turnaround!",
      "createdAt": "2025-11-11T01:29:16.378Z",
      "is_visible": true,
      "sender": { "id": "u1", "name": "Jordan Lee", "title": "Software Engineer" },
      "recipient": { "id": "u2", "name": "Priya Desai", "title": "UX Designer" }
    }
  ]
}
```

**Filtering**: Only returns kudos where `is_visible = true`

#### POST `/api/kudos`
Creates a new kudos message.

**Request Body:**
```json
{
  "recipientId": "u2",
  "message": "Great work on the design!"
}
```

**Validations:**
- `recipientId` required and must exist
- `recipientId` cannot equal current user id
- `message` required, trimmed length 1-500
- No banned words in message
- No duplicate submission within 60s window

**Response (201 Created):**
```json
{
  "kudo": {
    "id": "k1762842624648",
    "senderId": "u1",
    "recipientId": "u2",
    "message": "Great work on the design!",
    "createdAt": "2025-11-11T06:30:24.648Z",
    "is_visible": true,
    "sender": { "id": "u1", "name": "Jordan Lee", "title": "Software Engineer" },
    "recipient": { "id": "u2", "name": "Priya Desai", "title": "UX Designer" }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors (missing fields, invalid length, banned words, duplicate, self-kudos)
- `404 Not Found`: Recipient not found

#### PATCH `/api/kudos/:id/hide`
Admin-only: Hides a kudos message from the public feed.

**Request Body:**
```json
{
  "reason": "Inappropriate content"
}
```

**Response (200 OK):**
```json
{
  "kudo": {
    "id": "k1",
    "is_visible": false,
    "moderated_by": "u0",
    "moderated_at": "2025-11-11T07:00:00.000Z",
    "reason_for_moderation": "Inappropriate content"
  }
}
```

**Error Responses:**
- `401 Unauthorized`: User is not an admin
- `404 Not Found`: Kudos not found

#### PATCH `/api/kudos/:id/unhide`
Admin-only: Makes a hidden kudos visible again.

**Response (200 OK):**
```json
{
  "kudo": {
    "id": "k1",
    "is_visible": true,
    "moderated_by": null,
    "moderated_at": null,
    "reason_for_moderation": null
  }
}
```

**Error Responses:**
- `401 Unauthorized`: User is not an admin
- `404 Not Found`: Kudos not found

#### DELETE `/api/kudos/:id`
Admin-only: Permanently deletes a kudos message.

**Response (200 OK):**
```json
{
  "message": "Kudos deleted successfully"
}
```

**Error Responses:**
- `401 Unauthorized`: User is not an admin
- `404 Not Found`: Kudos not found

### Frontend Components

#### Component Hierarchy
```
App
├── Header
│   ├── Title
│   └── Subtitle
├── Main
│   ├── KudosForm
│   │   ├── RecipientSelect
│   │   ├── MessageTextarea
│   │   │   └── CharacterCounter
│   │   ├── SubmitButton
│   │   └── FeedbackMessage
│   └── KudosFeed
│       ├── FeedHeader
│       │   ├── Title
│       │   └── RefreshButton
│       ├── KudosList
│       │   └── KudosCard (for each kudos)
│       │       ├── MetaInfo (sender, recipient, timestamp)
│       │       ├── Message
│       │       └── AdminActions (if admin)
│       │           ├── HideButton / UnhideButton
│       │           └── DeleteButton
│       └── EmptyState
└── Footer
```

#### Component Interactions

**KudosForm**
- On load: Fetches users list and populates recipient dropdown
- On input: Updates character counter in real-time
- On submit: Validates client-side, sends POST request, handles success/error feedback
- On success: Clears form, refreshes feed

**KudosFeed**
- On load: Fetches visible kudos from `/api/kudos`
- On refresh: Re-fetches kudos and re-renders
- After submission: Automatically refreshes to show new kudos
- After moderation: Automatically refreshes to reflect changes

**KudosCard**
- Displays kudos metadata and message
- Conditionally renders admin actions if `user.isAdmin === true`
- Handles click events for Hide/Unhide/Delete actions
- Shows confirmation dialog before delete action

**AdminActions**
- Hide: Prompts for optional reason, sends PATCH request, refreshes feed
- Unhide: Sends PATCH request, refreshes feed
- Delete: Shows confirmation, sends DELETE request, refreshes feed

### Security

#### Role-Based Access Control
- **User Role**: Can create kudos, view public feed
- **Admin Role**: Can create kudos, view public feed, hide/unhide/delete kudos
- Current implementation: Hardcoded admin check (`CURRENT_USER_ID === 'u0'`)
- Future: Integrate with authentication system to determine user roles

#### Input Sanitization
- **HTML Escaping**: All user input is escaped server-side to prevent XSS
- **Message Sanitization**: Trim whitespace, normalize line breaks
- **Length Validation**: Server-side checks (1-500 chars) - never trust client

### Error Handling

#### Consistent Error Format
All error responses follow this structure:
```json
{
  "error": "Human-readable error message"
}
```

#### Logging
- Log all moderation actions (hide/unhide/delete) with:
  - Admin user ID
  - Action type
  - Kudos ID
  - Timestamp
  - Reason (if applicable)

### Performance Considerations

#### Pagination (Future)
- Add `limit` and `offset` query parameters to `/api/kudos`
- Default limit: 50 items
- Consider cursor-based pagination for better performance

#### Caching (Future)
- Cache public feed for 30-60 seconds to reduce database load
- Invalidate cache on new kudos creation or moderation actions

## Implementation Plan

### Phase 1: Data Model Updates
- [x] Add `is_visible` field to in-memory kudos objects (default: `true`)
- [x] Add moderation fields: `moderated_by`, `moderated_at`, `reason_for_moderation`
- [x] Update existing kudos in store to include `is_visible: true`

### Phase 2: Backend API Enhancements
- [x] Update `GET /api/kudos` to filter `is_visible = true` only
- [x] Implement `PATCH /api/kudos/:id/hide` endpoint with admin guard
- [x] Implement `PATCH /api/kudos/:id/unhide` endpoint with admin guard
- [x] Implement `DELETE /api/kudos/:id` endpoint with admin guard
- [x] Add duplicate detection: same sender→recipient+message within 60s
- [x] Add banned words list check (simple array lookup)
- [x] Update message length validation: 1-500 chars (from 1-280)
- [x] Add server-side HTML escaping for message content
- [x] Add logging for moderation actions
- [x] Add `isAdmin` field to current user response

### Phase 3: Frontend Updates
- [x] Create AdminPanel component (integrated into KudosCard)
- [x] Add Hide/Unhide/Delete buttons to kudos cards (admin only)
- [x] Add reason input prompt when hiding kudos
- [x] Wire admin actions to API endpoints
- [x] Update feed to refresh after moderation actions
- [x] Update character counter to show X/500 (from X/280)
- [x] Add confirmation dialog for delete action
- [x] Update HTML maxlength attribute to 500

### Phase 4: Testing
- [ ] Manual test: Create kudos → verify appears in feed
- [ ] Manual test: Hide kudos → verify removed from feed
- [ ] Manual test: Unhide kudos → verify reappears in feed
- [ ] Manual test: Delete kudos → verify permanently removed
- [ ] Manual test: Duplicate submission within 60s → verify rejection
- [ ] Manual test: Banned word in message → verify rejection
- [ ] Manual test: Self-kudos attempt → verify rejection
- [ ] Manual test: Message length validation (0, 1, 500, 501 chars)
- [ ] Manual test: Non-admin attempting moderation → verify 401 error

### Phase 5: Documentation
- [x] Update API documentation
- [x] Document banned words list location and maintenance
- [x] Document admin role assignment process

## Banned Words List

**Location**: Server-side configuration (array in `server.js`)

**Initial List** (to be expanded):
- `spam`
- `test123`
- `inappropriate`
- Profanity and offensive language (to be added)
- Company-specific inappropriate terms (to be added)

**Implementation**: Simple case-insensitive substring matching (future: consider regex patterns or external service)

## Future Enhancements

- Database persistence (migrate from in-memory storage)
- Real authentication system with JWT/sessions
- User roles and permissions management UI
- Real-time feed updates (WebSockets or Server-Sent Events)
- User search and filtering
- Kudos reactions/emojis
- Pagination for large feeds
- Advanced spam detection (rate limiting, ML-based)
- Moderation queue for admins
- Email notifications for recipients
- Analytics dashboard (most thanked users, kudos trends)

## Notes

- Current implementation uses in-memory storage (resets on server restart)
- Admin role is currently hardcoded (user `u0` - Alex Morgan)
- Authentication is simulated (hardcoded `CURRENT_USER_ID`)
- All timestamps are in ISO 8601 format (UTC)
- To test admin features, change `CURRENT_USER_ID` in `server.js` from `'u1'` to `'u0'`
