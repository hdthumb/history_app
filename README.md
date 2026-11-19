# Timeline Atlas

A phone-first parallel timeline of world history with country profiles, people, places, a revise mode and your own notes and links. Static files only: no build step.

## Put it online with GitHub Pages
1. Create a new GitHub repo (for example `timeline-atlas`) and upload everything in this folder to the top level.
2. Repo Settings, Pages, Source: "Deploy from a branch", Branch: `main`, folder `/ (root)`. Save.
3. After a minute the site is at `https://<your-username>.github.io/timeline-atlas/`.
4. Open it on your phone and add it to your home screen (iPhone: Safari, Share, Add to Home Screen. Android: Chrome menu, Install app). Open it once with signal so it caches for offline use.

## Notes
- Your notes and added items are stored on the phone. Use Add, Backup, Export now and then, and Import to restore or move phones.
- After changing any file, bump `VERSION` in `sw.js` so installed copies update.
- Render works too (New, Static Site, publish directory `.`), but needs nothing extra for this app.
