# Personal Expense Tracker

## Overview

Personal Expense Tracker is a full-stack web application that enables users to manage and monitor their personal spending across categories, control monthly budgets, quickly search transactions, and identify overspending trends. The application implements end-to-end functionality including frontend, backend, database persistence, and comprehensive testing.

## Business Scenario

A user tracks personal spending across categories to:
- Control monthly budgets
- Quickly find transactions
- Identify overspending trends
- Monitor spending patterns by category

## Core Rules

- **Multi-user support**: The application supports multiple users
- **Data privacy**: Each user sees only their own data
- **No sharing**: No invites, public links, or shared budgets
- **Technology flexibility**: Stack, database, and UI library choices are up to the developer
- **Local execution**: The app must run locally

---

## Functional Requirements

### 1. Accounts and Authentication (SSO Only)

#### Implementation
- Authentication via SSO only
- Supported providers:
  - Google OAuth / OpenID Connect
  - GitHub OAuth
- Logout functionality supported
- Authentication persists across page refresh

#### User Profile Data
On first successful SSO sign-in, the backend automatically creates a local user record with:
- `provider` (e.g., "google", "github")
- `provider_user_id`
- `email` (if provided by the provider)
- `display_name`
- `avatar_url` (optional)

#### Account Linking
- Not required for MVP
- If the same person signs in with both Google and GitHub, they are treated as separate accounts unless explicitly implemented and documented

### 2. Categories

A category represents how users group expenses.

#### Operations
- Create a category
- Rename a category
- Delete a category

#### Constraints
- Category names must be unique per user
- Deleting a category is handled explicitly (see below)

#### Category Deletion Strategy
**[Developer to select and document one approach]**

Option A: **Block Deletion**
- Cannot delete a category if transactions exist within it
- User must reassign or delete transactions first

Option B: **Allow Deletion with Reassignment**
- Allow deletion and automatically reassign all transactions to a default "Uncategorized" category
- Creates the "Uncategorized" category automatically if needed

**Required Documentation**: The chosen approach must be clearly documented in the "Category Deletion Behavior" section of this README.

### 3. Transactions (Expenses)

Each transaction represents a single expense and belongs to exactly one user.

#### Required Fields
- `title`: Short description (non-empty)
- `amount`: Numeric value (must be greater than 0)
- `currency`: Single currency is acceptable for MVP (must be explicit in UI)
- `transaction_date`: Valid date
- `category`: Associated category (foreign key)
- `notes`: Additional details (optional)

#### Operations
- Create a transaction
- Edit any transaction field
- Delete a transaction

#### Validation Rules
- Amount must be greater than 0
- Transaction date must be a valid date
- Title must be non-empty

### 4. Monthly Budget

#### Functionality
- Users can set a monthly budget amount for a selected month
- Budget calculations include:
  - Total spent for the selected month
  - Remaining budget (budget minus spent)
  - Budget usage percentage

#### UI States
- If a budget is set: Display total, remaining, and percentage
- If no budget is set: Display clear "No budget set" message (no misleading numbers)

### 5. Search and Filters

Users can search and filter transactions by:
- **Search**: Title and notes
- **Category filter**: By category
- **Date range filter**: This month, last month, custom range
- **Amount range filter**: Min/max values

### 6. Real-time Communication (WebSocket Budget Alerts)

The app includes two-way WebSocket communication for real-time budget notifications.

#### Server → Client Behavior

**Budget Threshold Alerts**
- Backend pushes real-time budget threshold alerts over WebSocket
- Alerts are calculated for the current calendar month only
- Required thresholds: 50%, 80%, 100% of monthly budget
- **Each threshold fires once per month** (no spam)

**Alert Generation Triggers**
Alerts are generated when:
1. WebSocket connection opens
2. A transaction is created, updated, or deleted
3. Any change affects the current month's budget status

**No Budget Edge Case**
- If no monthly budget is set for the current calendar month, threshold alerts must NOT be generated

#### Client → Server Behavior

The client must send at least one meaningful WebSocket message to the server that affects server behavior.

**Acceptable message types** (developer chooses):
- `subscribe`: Subscribe to budget alerts
- `ack`: Acknowledge alert as read
- Other meaningful state-changing operations

**Message Format**: [Developer to document in "WebSocket Message Format" section]

#### UI Presentation

Budget alerts must be visible in the UI using one of these approaches:
- Toast notifications
- Alert banner
- Notification panel

---

## UI Requirements

The interface must be modern, styled, responsive, and interactive.

### Required Screens

#### 1. Authentication Entry Screen
- "Continue with Google" button
- "Continue with GitHub" button
- Clear visual hierarchy

#### 2. Main Dashboard Screen
For a selected month, display:
- Total spent
- Budget amount (or "No budget set")
- Remaining budget
- Budget usage percentage (or visual indicator)

#### 3. Transactions Screen/Section
- Transactions list or table
- Search input
- Filter controls (category, date range, amount range)
- Create/Edit transaction UI (modal, drawer, or page)

#### 4. Categories Management
- Page or modal to create, rename, and delete categories

#### 5. Real-time Alerts
- Visible display of WebSocket budget alerts

### Styling & Responsiveness

**Consistent Design**
- Consistent spacing and typography across major screens
- Visible hover and focus states for interactive elements

**Empty States**
- No transactions
- No categories
- No search results
- No budget set

**Loading States**
- At least one visible loading state on a main screen or major data block

**Form Validation**
- Client-side validation feedback for transaction create/edit forms

**Responsive Behavior**
- Responsive for narrow screens (table-to-cards or horizontal scroll acceptable)

**Theme**
- Light theme only (dark mode not required)

---

## Backend Requirements

### API Implementation
- Provide HTTP API supporting all UI flows
- Enforce authorization for every category/transaction/budget operation
- Enforce authorization on WebSocket connections and budget alert delivery

### Input Validation
- Validate inputs
- Return clear error responses for invalid requests

### Authentication
- Implement Google and GitHub SSO securely
- Follow OAuth best practices

### Data Persistence
- Persist data in a database chosen by the developer
- Support multi-user isolation

---

## Quality Requirements

### Automated Testing

Include tests covering at least:
1. **SSO Login**: Success path using mock or stub provider response (no real network calls)
2. **Create Category**: Successful creation and validation
3. **Create Transaction**: Successful creation with validation
4. **Authorization**: Verify users cannot access another user's categories/transactions/budgets
5. **WebSocket Budget Alerts**: Test alert generation for 50%, 80%, and 100% thresholds

### Error Handling
- Basic error handling visible in the UI
- Clear error messages for failed operations

### Local Execution
- Project must start locally with documented commands
- Tests must not depend on real Google or GitHub network calls

---

## Deliverables

### Required
- **Repository**: GitHub repository with frontend and backend source code
- **README**: This document (updated with implementation details)
- **Tests**: Automated test suite covering requirements above

### README Must Include

1. **Local Setup Instructions**
   - How to run backend locally
   - How to run frontend locally
   - All environment variables required

2. **Testing Instructions**
   - How to run tests
   - Test coverage summary

3. **API Documentation**
   - Short description of main endpoints
   - Authentication flow

4. **Category Deletion Behavior**
   - Document chosen approach (Block vs Reassign)

5. **OAuth Configuration**
   - How to configure Google OAuth credentials
   - How to configure GitHub OAuth credentials
   - Required environment variables

6. **WebSocket Documentation**
   - Message format (client → server and server → client)
   - Budget alert rules and thresholds
   - Example payloads

### Optional
- **Containerization**: Dockerfile and/or docker-compose
- If containerization is skipped, document the reason in README

---

## Acceptance Checklist

- [ ] User can sign in with Google
- [ ] User can sign in with GitHub
- [ ] Local user record is created automatically on first successful SSO sign-in
- [ ] User can create categories
- [ ] User can create transactions
- [ ] User can set a monthly budget
- [ ] Dashboard displays total spent, remaining budget, and usage percentage
- [ ] User can search and filter transactions
- [ ] Data is private per user (no cross-account access)
- [ ] App receives real-time budget alerts for 50%, 80%, and 100% thresholds
- [ ] WebSocket flow includes at least one client → server message that changes server behavior
- [ ] App runs locally from README instructions
- [ ] All tests pass locally
- [ ] No real Google or GitHub network calls in tests

---

## Implementation Notes

### Important Considerations

1. **Email Handling**: GitHub may not always provide email depending on user settings. Identity should rely on `provider + provider_user_id`, not email.

2. **Alert Deduplication**: If a user edits or deletes transactions after crossing a threshold, alerts should follow the "once per threshold per month" rule and not spam repeatedly.

3. **Currency**: While MVP can use a single currency, it must be explicit in the UI.

4. **Account Linking**: Not required for MVP. If same person signs in with both providers, treat as separate accounts unless explicitly implemented.

---

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Backend**: Node.js with Express and TypeScript
- **Database**: PostgreSQL
- **WebSocket**: Socket.io
- **UI Library**: Tailwind CSS
- **Authentication**: Passport.js with OAuth strategies
- **Testing**: Jest and Supertest
- **Containerization**: Docker Compose for local development

---

## Getting Started

### Prerequisites
- Node.js 18+ and npm
- Docker and Docker Compose
- Google OAuth credentials (Client ID and Secret)
- GitHub OAuth credentials (Client ID and Secret)

### Installation

#### Backend
```bash
cd backend
npm install
```

#### Frontend
```bash
cd frontend
npm install
```

#### Database
```bash
docker-compose up -d postgres
```

### Running the Application

#### Backend
```bash
cd backend
npm run dev
```

#### Frontend
```bash
cd frontend
npm start
```

#### Full Stack (with Docker)
```bash
docker-compose up
```

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

---

## Environment Variables

### Database
- `DATABASE_URL`: PostgreSQL connection string (e.g., `postgresql://user:password@localhost:5432/expense_tracker`)

### Google OAuth
- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: Callback URL (e.g., `http://localhost:3001/auth/google/callback`)

### GitHub OAuth
- `GITHUB_CLIENT_ID`: Your GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET`: Your GitHub OAuth client secret
- `GITHUB_REDIRECT_URI`: Callback URL (e.g., `http://localhost:3001/auth/github/callback`)

### JWT
- `JWT_SECRET`: Secret key for JWT token signing

### Application
- `NODE_ENV`: Environment (development/production)
- `PORT`: Backend server port (default: 3001)
- `FRONTEND_URL`: Frontend URL (default: http://localhost:3000)

---

## API Overview

### Authentication
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - Handle Google OAuth callback
- `GET /auth/github` - Initiate GitHub OAuth
- `GET /auth/github/callback` - Handle GitHub OAuth callback
- `POST /auth/logout` - Logout user
- `GET /auth/me` - Get current user info

### Categories
- `GET /api/categories` - List user's categories
- `POST /api/categories` - Create category
- `PUT /api/categories/:id` - Update category
- `DELETE /api/categories/:id` - Delete category

### Transactions
- `GET /api/transactions` - List user's transactions with filters
- `POST /api/transactions` - Create transaction
- `PUT /api/transactions/:id` - Update transaction
- `DELETE /api/transactions/:id` - Delete transaction

### Budget
- `GET /api/budget/:year/:month` - Get monthly budget and totals
- `POST /api/budget/:year/:month` - Set monthly budget
- `DELETE /api/budget/:year/:month` - Remove monthly budget

### WebSocket
- `GET /ws` - WebSocket connection endpoint

---

## WebSocket Documentation

This section is also the **WebSocket Message Format** specification referenced from `CLAUDE.md` and `AGENTS.md`.

### Connection
- URL: `ws://localhost:3001/ws`
- Authentication: JWT token passed in connection query parameter

### Server → Client Messages

**Budget Alert**
```json
{
  "type": "budget_alert",
  "threshold": 50,
  "spent": 500.00,
  "budget": 1000.00,
  "percentage": 50,
  "month": "2026-05"
}
```

### Client → Server Messages

**Subscribe to Alerts**
```json
{
  "type": "subscribe",
  "userId": "user_123"
}
```

**Acknowledge Alert**
```json
{
  "type": "ack",
  "alertId": "alert_123"
}
```

---

## Category Deletion Behavior

### Chosen Approach: Reassign to "Uncategorized"

**Explanation**: When a category is deleted, all associated transactions are automatically reassigned to a default "Uncategorized" category. The "Uncategorized" category is created automatically if it doesn't exist. This approach provides a better user experience by avoiding the need to manually reassign transactions before deletion, while maintaining data integrity.

---

## Testing Strategy

### Test Coverage
- SSO login flow with mock OAuth providers
- Category CRUD operations and validation
- Transaction CRUD operations and validation
- Authorization and data isolation between users
- WebSocket budget alert thresholds (50%, 80%, 100%)
- Budget calculations and alert deduplication

### Running Tests
```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

---

## Known Limitations / Future Enhancements

**Current MVP limitations:**
- Single currency (USD) — multi-currency is out of scope.
- No account linking — signing in via Google and GitHub with the same email creates two separate accounts (per spec).
- No CSV import/export.
- No recurring transactions or scheduled budget rollover.
- Light theme only; no dark mode.
- All data lives in a single Postgres instance; no sharding or read replicas.

**Potential future enhancements:**
- Multi-currency support with FX conversion at transaction time.
- Account linking flow for users with multiple SSO identities.
- CSV / OFX import and export.
- Recurring transactions and bill reminders.
- Spend forecasting and category trend charts.
- Mobile-friendly PWA support.

---

## Support

For issues or questions, please refer to the relevant sections in this README or check the test files for usage examples.
