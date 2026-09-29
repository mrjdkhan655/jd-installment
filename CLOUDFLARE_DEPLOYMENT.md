# Cloudflare Direct Deployment Guide (No GitHub Required)
## Muhammad Wahab — Installment Management System

You can deploy directly to Cloudflare Pages straight from your Mac terminal in **3 simple steps** without connecting to GitHub or creating any Git repositories.

---

### Step 1: Log in to Cloudflare from Terminal

Open your terminal in the project folder and run:

```bash
npx wrangler login
```

- A browser window will automatically open asking you to log into your Cloudflare account.
- Click **Allow / Authorize**.
- Once authorized, return to your terminal. It will say:
  ```text
  Successfully logged in.
  ```

---

### Step 2: Build the Application for Cloudflare Edge

Run the optimized Cloudflare build command:

```bash
npm run build:cf
```

This compiles your Next.js application into static assets and Cloudflare edge functions inside the `.vercel/output/static` folder.

---

### Step 3: Deploy Directly to Cloudflare Pages

Deploy the compiled project to Cloudflare with a single command:

```bash
npx wrangler pages deploy .vercel/output/static --project-name=muhammad-wahab-finance --compatibility-flag=nodejs_compat
```

*(You can choose any project name you like, such as `muhammad-wahab-finance`)*

When prompted:
1. If asked: *"Creating a new project. Would you like to create it?"* → Press **Enter** (Yes).
2. It will upload your assets to Cloudflare’s global edge CDN and output your **live public URL**:
   ```text
   ✨ Deployment complete! Take a peek over at https://muhammad-wahab-finance.pages.dev
   ```

---

### Step 4: Set Your Supabase Environment Variables (One-Time Setup)

To allow your live Cloudflare site to communicate with Supabase:

#### Method A: Via Cloudflare Web Dashboard (Easiest)
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com/) → **Workers & Pages**.
2. Click on your project (`muhammad-wahab-finance`).
3. Go to **Settings** → **Environment variables** → Click **Add variables** under **Production**:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://your-project.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `your-anon-key`
   - `SUPABASE_SERVICE_ROLE_KEY` = `your-service-role-key`
4. Click **Save**.

#### Method B: Directly from Terminal
You can also set secrets directly from terminal without opening the browser:
```bash
npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_URL --project-name=muhammad-wahab-finance
npx wrangler pages secret put NEXT_PUBLIC_SUPABASE_ANON_KEY --project-name=muhammad-wahab-finance
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name=muhammad-wahab-finance
```

---

### 1-Click Redeployment (For Future Updates)

Whenever you make any changes and want to publish them live, simply run:

```bash
npm run deploy:cf
```

This builds and uploads your newest version to Cloudflare in under 30 seconds!

---

### Alternative: Drag-and-Drop via Cloudflare Dashboard (Zero Terminal Upload)

If you prefer using the browser rather than the terminal:

1. The build has already been compiled with the full server worker into the **`cloudflare-deploy`** folder in your project root! (Contains 151 clean files with `_worker.js`).
2. Open [Cloudflare Dashboard](https://dash.cloudflare.com/) → Click **Workers & Pages** → **Create application** → **Pages** → select **Direct Upload**.
3. Enter project name: `muhammad-wahab-finance`.
4. Drag and drop the unhidden folder **`cloudflare-deploy`** from your project directory.
5. Click **Deploy site**.
6. Set the 3 environment variables in project settings (see Step 4 above).
