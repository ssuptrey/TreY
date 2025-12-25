# Complete Setup Guide - Compliance Execution System

## Prerequisites Installation

### 1. Install Node.js (Required for Backend & Frontend)

**On macOS:**
```bash
# Download and install from official website
# Go to: https://nodejs.org/
# Download LTS version (v18.x or v20.x)
# Run the installer

# OR use nvm (Node Version Manager - Recommended):
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.zshrc
nvm install 18
nvm use 18
```

**Verify installation:**
```bash
node --version  # Should show v18.x.x or v20.x.x
npm --version   # Should show 9.x.x or 10.x.x
```

---

## Step-by-Step Setup

### Step 1: Set Up Cloud Database

**Option A: Neon (Recommended - 3GB Free)**

1. Go to **https://neon.tech**
2. Click "Sign Up" → Use GitHub/Google
3. Create new project:
   - Name: `compliance-execution`
   - Region: **Asia Pacific (Mumbai)** `ap-south-1`
   - PostgreSQL version: **14**
4. Copy your connection string (looks like):
   ```
   postgresql://username:password@ep-xxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
   ```
5. Keep this handy - you'll need it in Step 3

**Option B: Supabase (Alternative - 500MB Free)**

1. Go to **https://supabase.com**
2. Sign up with GitHub
3. Create new project:
   - Name: `compliance-execution`
   - Database password: (create a strong password)
   - Region: **Southeast Asia (Singapore)**
4. After project is created:
   - Go to Project Settings → Database
   - Find "Connection string" → URI
   - Copy it and replace `[YOUR-PASSWORD]` with your actual password

---

### Step 2: Install Dependencies

```bash
# Navigate to backend folder
cd /Users/mac/TreY/backend

# Install all backend dependencies
npm install

# Navigate to frontend folder
cd /Users/mac/TreY/frontend

# Install all frontend dependencies
npm install
```

**Expected output:** Installation should complete without errors.

---

### Step 3: Configure Environment Variables

#### Backend Configuration

```bash
cd /Users/mac/TreY/backend

# Create .env file from template
cp .env.example .env

# Edit .env file with your database connection
nano .env  # or use any text editor
```

**Update these values in `backend/.env`:**

```env
# Server
NODE_ENV=development
PORT=3001

# Database - PASTE YOUR NEON/SUPABASE CONNECTION STRING HERE
DATABASE_URL=postgresql://your-username:your-password@your-host/your-database?sslmode=require

# JWT - Generate a random secret (32+ characters)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string-32-chars-min

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email (for SLA alerts) - Optional for now, can configure later
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=noreply@compliance-system.com

# Timezone
TZ=Asia/Kolkata
```

**To generate a strong JWT_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

#### Frontend Configuration

```bash
cd /Users/mac/TreY/frontend

# Create .env file
cp .env.example .env

# Edit .env file
nano .env
```

**Update `frontend/.env`:**
```env
REACT_APP_API_URL=http://localhost:3001/api
```

---

### Step 4: Set Up Database Schema

```bash
cd /Users/mac/TreY/backend

# Run the automated database setup script
node setup-database.js
```

**What this does:**
1. Tests connection to your cloud database
2. Runs migration 001_initial_schema.sql (creates all tables)
3. Runs migration 002_password_security.sql (adds security features)
4. Verifies all tables were created
5. Shows table counts

**Expected output:**
```
✅ Connected successfully!
📋 Database is empty, ready for migrations.
🚀 Starting database migrations...
✅ Migration completed: 001_initial_schema.sql
✅ Migration completed: 002_password_security.sql
✅ Database setup complete!
```

---

### Step 5: Start the Application

#### Terminal 1: Start Backend

```bash
cd /Users/mac/TreY/backend
npm start
```

**Expected output:**
```
[SERVER] Starting Compliance Execution Backend...
[DB] Connected to PostgreSQL
[CRON] SLA Alert Job started (runs daily at 9:00 AM IST)
[SERVER] Server running on port 3001
```

#### Terminal 2: Start Frontend

```bash
cd /Users/mac/TreY/frontend
npm start
```

**Expected output:**
```
Compiled successfully!
Local:            http://localhost:3000
```

Your browser should automatically open to http://localhost:3000

---

## Step 6: Create Your First User

### Option A: Via Frontend (Recommended)

1. Open http://localhost:3000
2. Click "Register"
3. Fill in:
   - **Email:** your-email@example.com
   - **Password:** Must be 12+ chars with uppercase, lowercase, number, special char
     - Example: `SecurePass123!@#`
   - **Name:** Your Name
   - **Organization Name:** Your Company Name
   - **Organization Type:** NBFC (or other)
4. Click Register

### Option B: Via API (Testing)

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@example.com",
    "password": "SecurePassword123!",
    "name": "Admin User",
    "organizationName": "Test NBFC",
    "organizationType": "NBFC"
  }'
```

---

## Verification Checklist

- [ ] Node.js installed (v18 or v20)
- [ ] Cloud database created (Neon/Supabase)
- [ ] Backend dependencies installed (`npm install` in backend/)
- [ ] Frontend dependencies installed (`npm install` in frontend/)
- [ ] `backend/.env` configured with DATABASE_URL
- [ ] `frontend/.env` configured with API URL
- [ ] Database migrations completed successfully
- [ ] Backend server running (port 3001)
- [ ] Frontend app running (port 3000)
- [ ] First user account created
- [ ] Can login successfully

---

## Troubleshooting

### "Cannot connect to database"

**Solution:**
1. Check your DATABASE_URL in `backend/.env`
2. Ensure database isn't paused (Neon/Supabase auto-pause)
3. Go to your database dashboard and wake it up
4. Verify connection string is correct

### "npm: command not found"

**Solution:**
```bash
# Install Node.js from https://nodejs.org
# Then restart your terminal
source ~/.zshrc
```

### "Migration failed"

**Solution:**
1. Check if tables already exist:
   - Go to your database dashboard (Neon/Supabase)
   - Look at Tables section
   - If tables exist, migrations already ran
2. If you need to reset:
   ```bash
   # In your database SQL editor, drop all tables:
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   # Then re-run: node setup-database.js
   ```

### "Password validation failed"

**Solution:** Password must meet these requirements:
- At least 12 characters
- One uppercase letter (A-Z)
- One lowercase letter (a-z)
- One number (0-9)
- One special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
- No sequential characters (123, abc)
- No repeated characters (aaa, 111)

Example valid passwords:
- `SecurePass123!@#`
- `MyP@ssw0rd2024!`
- `Compliance#2024$`

### "Port 3000/3001 already in use"

**Solution:**
```bash
# Find and kill the process using the port
lsof -ti:3001 | xargs kill -9  # For backend
lsof -ti:3000 | xargs kill -9  # For frontend
```

### "SMTP/Email not working"

**Solution:**
- Email alerts are optional for MVP
- You can leave SMTP settings with dummy values
- Alerts will be logged but not sent
- To properly configure Gmail:
  1. Enable 2FA on your Google account
  2. Generate App Password: https://myaccount.google.com/apppasswords
  3. Use app password in SMTP_PASSWORD

---

## Quick Reference

### Database Dashboard URLs
- **Neon:** https://console.neon.tech
- **Supabase:** https://app.supabase.com

### Application URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001/api
- **Health Check:** http://localhost:3001/health

### Useful Commands

```bash
# Start backend
cd /Users/mac/TreY/backend && npm start

# Start frontend
cd /Users/mac/TreY/frontend && npm start

# Run tests
cd /Users/mac/TreY/frontend && npm test

# View database (using Neon SQL Editor)
# Go to https://console.neon.tech → Your Project → SQL Editor

# Check backend logs
cd /Users/mac/TreY/backend && npm start
# (Logs appear in terminal)
```

---

## Next Steps After Setup

1. **Create test obligations** to verify the system
2. **Test SLA alerts** (manually trigger: POST /api/alerts/trigger-job)
3. **Review audit logs** to see enforcement in action
4. **Configure email alerts** for production use
5. **Customize organization settings**

---

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify all prerequisites are installed
3. Ensure cloud database is active (not paused)
4. Check backend terminal for error messages
5. Check browser console for frontend errors

**Database Providers:**
- Neon Docs: https://neon.tech/docs
- Supabase Docs: https://supabase.com/docs

**Node.js:**
- Download: https://nodejs.org/
- Docs: https://nodejs.org/docs/
