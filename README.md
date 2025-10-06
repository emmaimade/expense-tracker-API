
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
   MONGODB_URI=your_db_uri
   JWT_SECRET=your_jwt_secret
   EMAIL_USER=your_email_user
   EMAIL_PASS=your_email_pass
   BASE_URL=[https://expense-tracker-api-hvss.onrender.com](https://expense-tracker-api-hvss.onrender.com)
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

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
