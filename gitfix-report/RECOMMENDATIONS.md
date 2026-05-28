# Recommendations — Long-Term Stability

## 1. Move Repository OUT of OneDrive (IMMEDIATE — CRITICAL)

OneDrive interferes with Git operations by locking files, causing `.git` corruption, and introducing sync race conditions.

**Action:** Abandon the old OneDrive repo and use the new clone at:
```
C:\Users\ksubh\zeroday-guardian-clean
```

To move to a different location:
```bash
# If you need it elsewhere, just copy the directory (not the OneDrive version)
copy C:\Users\ksubh\zeroday-guardian-clean D:\Projects\zeroday-guardian
```

## 2. Never Commit Large Binaries to Git

**Maximum file size:** GitHub warns at 50 MB, hard-rejects at 100 MB.
- Always use **Git LFS** for any file > 5 MB
- Never commit installers (`.msi`, `.exe`, `.dmg`)
- Never commit database dumps, VM images, or ML model files

**Git LFS Web UI**: https://github.com/shubhrajkumar/ZeroDay_Guardian/settings/billing

## 3. Git Hygiene Best Practices

### Before every commit:
```bash
# Check what you're about to commit
git add --dry-run .

# Check for large files in staging
git diff --cached --stat

# Check for files exceeding 10 MB
find . -not -path './.git/*' -size +10M -exec ls -lh {} \;
```

### Regular maintenance:
```bash
# Weekly repack to optimize storage
git gc --aggressive

# Prune stale references
git remote prune origin

# Check repository health
git fsck
```

## 4. Use the Auto-Commit Workflow

The existing `.github/workflows/auto-commit.yml` already provides:
- **Manual trigger** with custom commit message
- **Automated push** on every commit
- **Exponential backoff retry** (5 attempts)
- **Git LFS support**

To use: Go to GitHub → Actions → Auto-Commit & Push → Run workflow

## 5. Monitor Push Health

```bash
# Quick health check script
echo "=== Git Health Check ==="
git fsck --no-dangling 2>&1
git count-objects -vH | grep -E "size-pack|count"
echo "Remote status:"
git remote -v
git push --dry-run origin main
```

If push still fails, check:
1. Network firewall/proxy settings
2. GitHub authentication token validity
3. GitHub service status (https://www.githubstatus.com/)

## 6. OneDrive Alternative

If you must keep the repo on the Desktop, use the **non-OneDrive Desktop**:
```
C:\Users\ksubh\Desktop\   (NOT inside OneDrive)
```

Or better: create a dedicated dev folder:
```
C:\Projects\
D:\Dev\
```

## 7. GitHub Large File Policy Reminder

- **Soft limit:** Files > 50 MB trigger a warning
- **Hard limit:** Files > 100 MB are rejected
- **Repository size limit:** GitHub recommends < 5 GiB total
- **LFS bandwidth:** 1 GiB free per month on free tier
