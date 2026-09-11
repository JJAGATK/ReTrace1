# Hosting ReTrace on Supabase (PostgreSQL Guide)

ReTrace supports **Supabase (PostgreSQL)** and cloud PostgreSQL out of the box with zero code changes required.

---

## 3-Step Setup Guide

### Step 1: Create a Free Project on Supabase
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **New Project**, select an organization, enter a project name (e.g. etrace-campus), and set a secure database password.
3. Choose your nearest region (e.g., US East).

---

### Step 2: Get your Database Connection String
1. In your Supabase Dashboard, click the **Project Settings** (gear icon) on the bottom left.
2. Navigate to **Database** -> **Connection string**.
3. Select **URI** mode (Transaction pooler or Session pooler).
4. Copy the connection string. It looks like:
   `
   postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
   `

---

### Step 3: Run Database Migrations & Connect
You have two easy options:

#### Option A: Automatic Migration (Recommended)
Simply create a .env file in the project root:
`env
PORT=5000
JWT_SECRET=retrace-campus-super-secret-jwt-key-2026
PII_SECRET_KEY=retrace-secure-campus-2026-pii-secret
DATABASE_URL=postgresql://postgres.[YOUR-PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?sslmode=require
`
When you run 
ode server/server.js or 
pm start, ReTrace will automatically detect Supabase, connect via SSL, verify tables, and seed the initial campus registry!

#### Option B: Supabase SQL Editor
1. In the Supabase Dashboard, click **SQL Editor** on the left menu.
2. Click **New query**.
3. Open supabase_schema.sql from this repository, copy the contents, paste into the SQL editor, and click **Run**.
4. Run 
ode server/seed.js to populate initial demo personas and campus reports.

---

## Features Enabled on Supabase
- **Persistent Cloud Database**: Access your lost & found registry from anywhere.
- **SSL Encrypted Connections**: Bank-grade security with sslmode=require.
- **Automatic Connection Pooling**: Built for high-concurrency campus events.
- **Row Level Security (RLS) Ready**: Fully compatible with Supabase Auth if needed.
