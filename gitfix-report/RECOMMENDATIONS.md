# GitFix Report — Recommendations for Future Stability

## Repository: ZeroDay Guardian
## Date: 2026-05-29

---

## 1. Prevent Large Files in History

- **Pre-commit hook:** Install a pre-commit hook that rejects files > 50 MB
- **GitHub file size limits:** Enforce via `.github/settings.yml` or branch protection rules
- **Review large files regularly:** Run `git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' | sort -k2 -n -r | head -20` monthly

## 2. OneDrive Sync Management

- **Exclude `C:\projects` from OneDrive** to prevent future interference
- If you must keep the repo on OneDrive, **exclude `.git` from sync** using OneDrive's selective sync settings
- Consider using **`git worktree`** for backup copies instead of OneDrive

## 3. Git LFS Maintenance

- **Regularly run** `git lfs prune` to remove old LFS objects from local cache
- **Monitor LFS bandwidth** on GitHub (free tier: 1 GB/month storage, 1 GB/month bandwidth)
- **Consider paid LFS plan** if storing large assets frequently

## 4. CI/CD Best Practices

- **Use the auto-commit workflow** for automated Codebuff/Freebuff changes
- The workflow uses **exponential backoff** (5 retries with doubling delay)
- For critical pushes, use **GitHub Deploy Keys** or **Personal Access Tokens (classic)** with appropriate scopes

## 5. Network Reliability

- **Use SSH instead of HTTPS** for more stable pushes:
  ```bash
  git remote set-url origin git@github.com:shubhrajkumar/ZeroDay_Guardian.git
  ```
- **Configure SSH keepalive** in `~/.ssh/config`:
  ```
  Host github.com
    ServerAliveInterval 60
    ServerAliveCountMax 5
    IPQoS=throughput
  ```
- **Avoid pushing during peak OneDrive sync times**

## 6. Monitoring & Alerts

- Set up **GitHub Actions notifications** for workflow failures
- Review **`git push` output** for warnings about file sizes or LFS limits

## 7. For Codebuff Integration

- Always work from `C:\projects\zeroday-guardian-main` (not OneDrive path)
- Changes will be automatically detected and can be pushed via the auto-commit workflow
- Run `npm run typecheck && npm test` before pushing to avoid CI failures

---

## Recovery Plan (if push fails again)

```bash
# 1. Check Git status and remote
git status
git remote -v

# 2. Verify large objects
git rev-list --objects --all | git cat-file --batch-check='%(objecttype) %(objectsize) %(rest)' | sort -k2 -n -r | head -10

# 3. Increase buffer further
git config http.postBuffer 1048576000  # 1 GB

# 4. Use SSH instead
git remote set-url origin git@github.com:shubhrajkumar/ZeroDay_Guardian.git

# 5. Push in stages
git push --force origin main
```
