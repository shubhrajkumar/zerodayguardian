import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useUserProgress } from "@/context/UserProgressContext";
import {
  buildShareLinks,
  ensureNotificationPreferences,
  ensureReferralRecord,
  getMonthlyReferralLeaderboard,
  getPublicProfile,
  listNotifications,
  markNotificationRead,
  pushNotification,
  sortNotificationsForVirtualList,
  syncPublicProfile,
  type NotificationItem,
} from "@/lib/firestoreGrowth";
import { logger } from "@/lib/logger";

const isRecoverableGrowthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = message.toLowerCase();
  return [
    "firebase auth user is not ready",
    "firebase is not configured",
    "permission-denied",
    "temporarily disabled",
    "service firestore is not available",
    "network-request-failed",
    "failed-precondition",
  ].some((token) => normalized.includes(token));
};

export const useReferralRecord = () => {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["growth", "referral", user?.id],
    enabled: Boolean(user?.id),
    queryFn: () => ensureReferralRecord(String(user?.id)),
    staleTime: 60_000,
  });
};

export const useNotificationCenter = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["growth", "notifications", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      await ensureNotificationPreferences(String(user?.id), user?.email || null);
      return sortNotificationsForVirtualList(await listNotifications(String(user?.id)));
    },
    staleTime: 20_000,
  });

  const markRead = async (notificationId: string) => {
    if (!user?.id) return;
    await markNotificationRead(user.id, notificationId);
    await queryClient.invalidateQueries({ queryKey: ["growth", "notifications", user.id] });
  };

  return {
    ...query,
    unreadCount: (query.data || []).filter((item) => !item.read).length,
    markRead,
  };
};

export const usePublicProfile = (userIdOrHandle?: string) =>
  useQuery({
    queryKey: ["growth", "public-profile", userIdOrHandle],
    enabled: Boolean(userIdOrHandle),
    queryFn: () => getPublicProfile(String(userIdOrHandle)),
    staleTime: 60_000,
  });

export const useMonthlyReferralLeaderboard = () =>
  useQuery({
    queryKey: ["growth", "referral-leaderboard"],
    queryFn: getMonthlyReferralLeaderboard,
    staleTime: 60_000,
  });

export const useGrowthProfileSync = () => {
  const { user } = useAuth();
  const { progress } = useUserProgress();

  useEffect(() => {
    if (!user?.id) return;
    syncPublicProfile({
      userId: user.id,
      name: user.name,
      email: user.email,
      xp: progress.points,
      streak: progress.streak,
      level: Math.max(progress.level, Math.floor(progress.points / 1000) + 1),
      badges: progress.badges.filter((badge) => badge.earned).map((badge) => badge.label),
      completedLabs: progress.completedLabs,
    }).catch((error) => {
      if (isRecoverableGrowthError(error)) return;
      logger.warn("Failed to sync public profile to Firestore", "useGrowthProfileSync", {
        reason: error instanceof Error ? error.message : String(error),
      });
    });
  }, [progress.badges, progress.completedLabs, progress.level, progress.points, progress.streak, user]);
};

export const useAchievementNotifications = (activeReward: { id: string; title: string; detail: string } | null) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const lastRewardIdRef = useRef<string>("");

  useEffect(() => {
    if (!user?.id || !activeReward) return;
    if (lastRewardIdRef.current === activeReward.id) return;
    lastRewardIdRef.current = activeReward.id;

    const payload: Omit<NotificationItem, "id" | "createdAt" | "read"> = {
      type: "achievement",
      title: activeReward.title,
      message: activeReward.detail,
      actionUrl: "/dashboard",
    };
    pushNotification(user.id, payload)
      .then((pushed) => {
        if (!pushed) return;
        return queryClient.invalidateQueries({ queryKey: ["growth", "notifications", user.id] });
      })
      .catch((error) => {
        if (isRecoverableGrowthError(error)) return;
        logger.warn("Failed to push achievement notification", "useAchievementNotifications", {
          reason: error instanceof Error ? error.message : String(error),
        });
      });
  }, [activeReward, queryClient, user]);
};

export const useShareLinks = (shareUrl: string, text: string) => buildShareLinks(shareUrl, text);
