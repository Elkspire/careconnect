This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

This app lives inside the `careconnect` pnpm/Turborepo monorepo, so the Vercel project's **Root Directory must be `apps/web`** (this is where `package.json` declares the `next` dependency Vercel's builder looks for). `apps/web/vercel.json` handles the rest:

- `installCommand`/`buildCommand` `cd ../..` back to the workspace root so `pnpm install` and `pnpm turbo build --filter=@careconnect/web` can resolve the `workspace:*` deps in `packages/*`.
- `outputDirectory` is `.next`, relative to Root Directory.
- `framework: "nextjs"` is set explicitly — with Root Directory at a subfolder, Vercel's own auto-detect can otherwise fail to find the `next` dependency and silently fall back to serving the build output as static files.

Required environment variables (Project Settings → Environment Variables): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.
