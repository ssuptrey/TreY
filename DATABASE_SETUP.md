# Cloud Database Setup Guide

## Option 1: Neon (Recommended - 3GB Free Tier)

### Step 1: Create Neon Account
1. Go to https://neon.tech
2. Sign up with GitHub/Google (free)
3. Create a new project named "compliance-execution"
4. Select region: **AWS ap-south-1 (Mumbai)** for Indian NBFCs
5. PostgreSQL version: **14** or higher

### Step 2: Get Connection String
After creating the project, Neon will show you a connection string like:
```
postgresql://username:password@ep-xxx-xxx.ap-south-1.aws.neon.tech/neondb?sslmode=require
```

### Step 3: Configure Environment
Copy this connection string and we'll use it in your `.env` file.

**Neon Free Tier Includes:**
- 3 GB storage
- 1 compute unit
- Unlimited databases
- Auto-suspend after 5 minutes of inactivity
- Always accessible from any device
- No credit card required

---

## Option 2: Supabase (Alternative - 500MB Free Tier)

### Step 1: Create Supabase Account
1. Go to https://supabase.com
2. Sign up with GitHub (free)
3. Create a new project named "compliance-execution"
4. Select region: **Southeast Asia (Singapore)** (closest to India)
5. Set a strong database password

### Step 2: Get Connection Details
1. Go to Project Settings → Database
2. Find "Connection string" → "URI"
3. Copy the connection string (replace [YOUR-PASSWORD] with your password)

**Supabase Free Tier Includes:**
- 500 MB database space
- Unlimited API requests
- 50,000 monthly active users
- Auto-pause after 1 week of inactivity
- No credit card required

---

## Option 3: Railway (Alternative - $5 Free Credits)

### Step 1: Create Railway Account
1. Go to https://railway.app
2. Sign up with GitHub
3. Create new project → "Add PostgreSQL"
4. Railway will provision a database

### Step 2: Get Connection Details
1. Click on your PostgreSQL service
2. Go to "Connect" tab
3. Copy the "Postgres Connection URL"

**Railway Free Tier:**
- $5 in credits (lasts ~1 month for small apps)
- 1 GB storage
- No auto-pause
- Requires credit card after trial

---

## Quick Setup Instructions

I'll help you set up whichever option you choose. Just let me know:

**Which database provider do you want to use?**
1. **Neon** (3GB, recommended for development)
2. **Supabase** (500MB, includes additional features)
3. **Railway** ($5 credits, no auto-pause)

Once you choose, I'll:
1. Help you configure the connection string
2. Run both database migrations automatically
3. Set up your `.env` files
4. Test the connection
5. Seed initial data (optional)

**My recommendation: Neon** - Best free tier for pure PostgreSQL database needs.
