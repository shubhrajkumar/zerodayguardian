export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "body",
      message: issue.message,
      code: issue.code,
    }));
    res.status(400).json({
      status: "error",
      code: "invalid_request_body",
      error: "Invalid request body",
      message: "Request payload validation failed",
      details,
      requestId: req.requestId || "",
    });
    return;
  }
  req.validatedBody = result.data;
  next();
};

export const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join(".") || "query",
      message: issue.message,
      code: issue.code,
    }));
    res.status(400).json({
      status: "error",
      code: "invalid_query",
      error: "Invalid query",
      message: "Query validation failed",
      details,
      requestId: req.requestId || "",
    });
    return;
  }
  req.validatedQuery = result.data;
  next();
};
