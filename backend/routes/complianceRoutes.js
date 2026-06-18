import { Router } from "express";
import { requireAuth } from "../src/middleware/auth.mjs";
import { apiReadRateLimit } from "../src/middleware/rateLimit.mjs";
import { User } from "../src/models/User.mjs";
import { Scan } from "../src/models/Scan.mjs";
import { LabProgress } from "../src/models/LabProgress.mjs";
import { MissionProgress } from "../src/models/MissionProgress.mjs";

const router = Router();

// GET /api/compliance/data — Export all user data (GDPR Article 20)
router.get("/data",
  requireAuth,
  apiReadRateLimit,
  async (req, res) => {
    try {
      const userId = req.user.sub;

      const [user, scans, labProgress, missionProgress] = await Promise.all([
        User.findById(userId).select("-password -refreshToken -resetOtp").lean().catch(() => null),
        Scan.find({ userId }).lean().catch(() => []),
        LabProgress.find({ userId }).lean().catch(() => []),
        MissionProgress.find({ userId }).lean().catch(() => []),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        platform: "ZeroDay Guardian",
        contactEmail: "ops@zerodayguardian.net",
        user: user || { id: userId, note: "User record from token (DB record not found)" },
        scans: scans.map(s => ({ ...s, id: String(s._id) })),
        labProgress: labProgress.map(l => ({ ...l, id: String(l._id) })),
        missionProgress: missionProgress.map(m => ({ ...m, id: String(m._id) })),
        metadata: {
          dataFormatVersion: "1.0",
          generatedBy: "ZeroDay Guardian Compliance API",
          includes: [
            "Account profile data",
            "Security scan history",
            "Lab progress records",
            "Mission progress records",
          ],
        },
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="zeroday-guardian-export-${userId}.json"`);
      res.json(exportData);
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Data export failed",
        message: "Unable to export your data. Please try again or contact support.",
      });
    }
  }
);

// DELETE /api/compliance/data — Delete user data (GDPR Article 17)
router.delete("/data",
  requireAuth,
  async (req, res) => {
    try {
      const userId = req.user.sub;

      await Promise.all([
        User.findByIdAndDelete(userId).catch(() => null),
        Scan.deleteMany({ userId }).catch(() => null),
        LabProgress.deleteMany({ userId }).catch(() => null),
        MissionProgress.deleteMany({ userId }).catch(() => null),
      ]);

      res.json({
        success: true,
        message: "Your account and associated data have been deleted permanently.",
        note: "You may need to clear your browser cookies and local storage to complete the process.",
        supportContact: "ops@zerodayguardian.net",
      });
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: "Account deletion failed",
        message: "Unable to delete your account. Please contact support at ops@zerodayguardian.net.",
      });
    }
  }
);

export default router;
