
# 💰 Expense Tracker API

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-4.x-blue)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)

A RESTful API built with Node.js, Express, and MongoDB that allows authenticated users to manage their personal expenses. This includes creating, reading, updating, and deleting expense records, as well as filtering expenses by date range.


## 🌐 Live Demo

**🔗 [View Live API Documentation](https://expense-tracker-api-hvss.onrender.com/api-docs)**

**Base URL:** `https://expense-tracker-api-hvss.onrender.com`

---

## 🚀 Features

- User Registration & Login with **JWT Authentication**
- User Profile Retrieval, Update, and Management
- Secure Email Change Verification (Two-Step Process)
- Password Change Functionality (Requires Current Password)
- **Budget Management (CRUD):** Set, track, and manage spending limits for specific periods.
- **Category Management (CRUD):** Create, update, and delete custom expense categories.
- **Full Expense Management (CRUD):** Create, Read, Update & Delete Expenses
- **Advanced Expense Filtering** by Custom Date Range or Predefined Periods (Past Week, Month, 3 Months)
- Export Expenses as CSV or PDF
- Data Validation & Error Handling
- Protected Routes via Middleware
- MongoDB Integration with Mongoose
- Environment Variable Configuration with dotenv

---

## 🛠 Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB with Mongoose
- **Authentication:** JSON Web Tokens (JWT), bcrypt
- **Other Tools:** dotenv, nodemon

---

## 📦 Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/emmaimade/expense-tracker-API.git
   cd expense-tracker-API
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**

   Create a `.env` file in the root directory and add:

   ```env
   PORT=3000
   DB_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret

   # URLs
   BASE_URL=http://localhost:3000          # this API's public URL
   FRONTEND_URL=http://localhost:5173      # allowed by CORS, used in email links

   # Google OAuth
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret

   # Email - pick one provider
   EMAIL_PROVIDER=gmail                    # or "resend" / "brevo"
   EMAIL_FROM="SpendWise <you@gmail.com>"  # Gmail: the authorized Gmail address; Resend/Brevo: an address on your verified domain
   GMAIL_CLIENT_ID=your_client_id          # if EMAIL_PROVIDER=gmail
   GMAIL_CLIENT_SECRET=your_client_secret  # if EMAIL_PROVIDER=gmail
   GMAIL_REFRESH_TOKEN=your_refresh_token  # if EMAIL_PROVIDER=gmail - from `npm run gmail:auth`
   RESEND_API_KEY=your_resend_api_key      # if EMAIL_PROVIDER=resend
   BREVO_API_KEY=your_brevo_api_key        # if EMAIL_PROVIDER=brevo
   ```

   > **Email without a domain:** Resend and Brevo both require a domain you own before they will send to other people. Until then, use `EMAIL_PROVIDER=gmail`: it sends from your Gmail account through the Gmail API over HTTPS (about 500 emails/day). In Google Cloud Console, enable the Gmail API, create a **Desktop app** OAuth client, put its ID and secret in `.env`, and run `npm run gmail:auth` to get the refresh token. Set the OAuth consent screen to **In production** - refresh tokens for apps left in *Testing* expire after 7 days.

4. **Start the server:**
   ```bash
   npm run dev
   ```

5. **Run the tests:**
   ```bash
   npm test
   ```
   Tests use an in-memory MongoDB and stub all email sending, so they never touch your real database or send emails. The first run downloads a MongoDB binary, which can take a few minutes. Tests also run automatically on every pull request (GitHub Actions).

---

## 🧪 API Endpoints

### 🔐 Auth Routes

| Method | Endpoint                | Description                                  |
|--------|-------------------------|----------------------------------------------|
| POST   | `/user/register`        | Register a new user                          |
| POST   | `/user/login`           | Login & receive JWT                          |
| POST   | `/user/forgot-password` | Request a password reset email (sends token) |
| POST   | `/user/reset-password/` | Reset password using the sent token          |


### 👤 User Profile & Security Routes

| Method | Endpoint                            | Description                                                                  |
|--------|-------------------------------------|------------------------------------------------------------------------------|
| GET    | `/user/me`                          | **[Auth Required]** Get the authenticated user's profile                         |
| PUT    | `/user/profile`                     | **[Auth Required]** Update user profile (name, optional email change initiation) |
| PUT    | `/user/change-password`             | **[Auth Required]** Change user's password (requires current password)           |
| GET    | `/user//verify-email-change/current`| Verify old email in the 2-step change process                                |
| GET    | `/user/verify-email-change/new`     | Verify new email to finalize the change                                      |
| PUT    | `/user/currency`                   | **[Auth Required]** Update preferred currency (3-letter ISO code, e.g. USD)   |

> ⚠️ All routes below require the token in `Authorization: Bearer <token>`

### 💸 Expense Routes

| Method | Endpoint                 | Description                          |
|--------|--------------------------|--------------------------------------|
| GET    | `/expense`               | Get all expenses                     |
| GET    | `/expense/weekly`        | Get expenses for the past 7 days     |
| GET    | `/expense/monthly`       | Get expenses for the past month      |
| GET    | `/expense/three-months`  | Get expenses for the last 3 months   |
| GET    | `/expense/custom`        | Get expenses within a date range     |
| POST   | `/expense`               | Add a new expense                    |
| PATCH  | `/expense/:id`           | Update an expense                    |
| DELETE | `/expense/:id`           | Delete an expense                    |

### 🏷️ Category Routes

| Method | Endpoint        | Description                     |
|--------|-----------------|---------------------------------|
| GET    | `/category`     | Get all user-defined categories |
| POST   | `/category`     | Create a new expense category   |
| PUT    | `/category/:id` | Update a category by ID         |
| DELETE | `/category/:id` | Delete a category by ID         |

### 💸 Budget Routes

| Method | Endpoint           | Description                     |
|--------|--------------------|---------------------------------|
| GET    | `/budget/overview` | Get user budgets overview       |
| GET    | `/budget/total`    | Get total monthly budgets       |
| GET    | `/budget/trends`   | Get user budget trends          |
| GET    | `/budget/alerts`   | Get budget alerts for user      |
| POST   | `/budget`          | Set & Update budget             |
| DELETE | `/budget/:id`      | Delete a budget by ID           |


---

## 📋 Usage Examples

### Register a New User
```bash
curl -X POST https://expense-tracker-api-hvss.onrender.com/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }'
```
### Add an Expense
```bash
curl -X POST https://expense-tracker-api-hvss.onrender.com/expense \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "description": "Coffee",
    "amount": 50,
    "category": "Food",
    "date": "2025-06-09"
  }'
```
### Change Preferred Currency (non-destructive)

When updating the user's preferred currency you can optionally convert existing expenses and budgets. Conversion is **non-destructive** by default — original amounts are preserved in `amountOriginal`/`currencyOriginal` fields. Use `convertExisting: true` to perform the conversion during the update.

```bash
curl -X PUT https://expense-tracker-api-hvss.onrender.com/user/currency \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"currency":"NGN", "convertExisting": true}'
```

Note: If you want to backfill existing documents so they include `amountOriginal`/`currencyOriginal` ahead of any conversion, run the migration script:

```bash
npm run migrate:backfill-originals
```
### Sample Response
```json
{
  "success": true,
  "message": "Expense created successfully",
  "data": {
    "_id": "645f1234567890abcdef1234",
    "description": "Coffee",
    "amount": 50,
    "category": "Food",
    "date": "2025-06-09T00:00:00.000Z"
  }
}
```

---

## 🧹 Folder Structure

```
├── config/
│   └── dbConfig.js
├── controllers/
│   └── userController.js
│   └── expenseControler.js
│   └── categoryController.js
│   └── budgetControler.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   └── User.js
│   └── Expense.js
│   └── Category.js
│   └── Budget.js
├── routes/
│   └── user.js
│   └── expense.js
│   └── category.js
│   └── budget.js
├── utils/
│   └── email.js
├── index.js
├── swagger.yaml
├── .env
└── README.md
```

---

## 🐛 Error Handling

All API responses return structured error messages for:

- Validation errors
- Missing or invalid fields
- Unauthorized or forbidden access
- Resource not found

---

## 📬 Contact

**Developer:** Imade-Taye Emmanuel  
**Email:** emmaimade14@gmail.com

---

## Project URL
https://roadmap.sh/projects/expense-tracker-api
