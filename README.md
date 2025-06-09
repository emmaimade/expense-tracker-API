
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

- User Registration & Login with JWT Authentication
- Create, Read, Update & Delete Expenses
- Filter Expenses by Custom Date Range or Past Week
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
   git clone https://github.com/your-username/expense-tracker-API.git
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
   ```

4. **Start the server:**
   ```bash
   npm run dev
   ```

---

## 🧪 API Endpoints

### 🔐 Auth Routes

| Method | Endpoint           | Description         |
|--------|--------------------|---------------------|
| POST   | `/user/register`   | Register a new user |
| POST   | `/user/login`      | Login & receive JWT |

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
│   └── user.js
│   └── expense.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   └── User.js
│   └── Expense.js
├── routes/
│   └── user.js
│   └── expense.js
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
