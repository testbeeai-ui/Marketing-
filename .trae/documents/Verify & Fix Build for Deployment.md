I will verify your project's readiness for Vercel and GitHub deployment by performing a full build simulation.

### **Plan**
1.  **Simulate Production Build**:
    *   I will run `npm run build` locally. This matches exactly what Vercel does.
    *   This checks for: **TypeScript errors**, **compilation failures**, and **Next.js specific issues**.
2.  **Check Code Quality (Linting)**:
    *   I will run `npm run lint`. Vercel will fail your deployment if there are any ESLint errors, so we must ensure this passes cleanly.
3.  **Fix Detected Issues**:
    *   If any errors are found in steps 1 or 2, I will immediately fix them in the code.
4.  **Prepare Environment Variables List**:
    *   I will verify which environment variables (like `GOOGLE_API_KEY`, `SUPABASE_URL`) are used in the code.
    *   I will provide you with a clean list of variables you **must** add to the Vercel Project Settings (since `.env.local` is ignored by git).

This ensures that when you push to GitHub, Vercel will deploy successfully without "Build Failed" errors.