const normalizeRole = (value = "") => String(value || "").toLowerCase();

export const requireRole = (roles = []) => (req, res, next) => {
  const role = normalizeRole(req.user?.role || "user");
  const allowed = roles.map(normalizeRole);
  if (!allowed.length || allowed.includes(role)) {
    next();
    return;
  }
  res.status(403).json({ error: "Forbidden", code: "rbac_forbidden" });
};
