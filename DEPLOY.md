# Deploy

GitHub `main` is the source of truth for Rivet.

If https://imtimp3.vercel.app still shows the soft serif UI ("The link goes in"),
Vercel is serving an old Grok export and is **not** building from this repo.

## Fix (once)

1. Vercel → Project for `imtimp3` → Settings → Git
2. Connect `Imti420/imti_MP3`, production branch `main`
3. Deployments → Redeploy latest `main` commit
4. Hard refresh. Footer must read **BUILD desk-3 · A26 skin**

Until that lands, Git pushes will not change the live site.
