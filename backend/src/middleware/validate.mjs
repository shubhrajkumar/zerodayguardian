import { ZodError } from "zod";

const formatIssues = (issues = [], fallbackPath = "body") =>
  issues.map((issue) => ({
    path: issue.path.join(".") || fallbackPath,
    message: issue.message,
    code: issue.code,
  }));

const sendValidationError = (res, requestId, payload) => {
  res.status(400).json({
    status: "error",
    requestId: requestId || "",
    ...payload,
  });
};

const validationMiddleware = (schema, source, code, fallbackPath, assign) => (req, res, next) => {
  try {
    const input = source(req);
    const result = schema.safeParse(input);
    if (!result.success) {
      sendValidationError(res, req.requestId, {
        code,
        error: `Invalid ${fallbackPath}`,
        message: `${fallbackPath[0].toUpperCase()}${fallbackPath.slice(1)} validation failed`,
        details: formatIssues(result.error.issues, fallbackPath),
      });
      return;
    }
    assign(req, result.data);
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, req.requestId, {
        code,
        error: `Invalid ${fallbackPath}`,
        message: `${fallbackPath[0].toUpperCase()}${fallbackPath.slice(1)} validation failed`,
        details: formatIssues(error.issues, fallbackPath),
      });
      return;
    }
    next(error);
  }
};

export const validateBody = (schema) => (req, res, next) => {
  validationMiddleware(schema, (request) => request.body, "invalid_request_body", "body", (request, data) => {
    request.validatedBody = data;
  })(req, res, next);
};

export const validateQuery = (schema) => (req, res, next) => {
  validationMiddleware(schema, (request) => request.query, "invalid_query", "query", (request, data) => {
    request.validatedQuery = data;
  })(req, res, next);
};

export const validateParams = (schema) => (req, res, next) => {
  validationMiddleware(schema, (request) => request.params, "invalid_params", "params", (request, data) => {
    request.validatedParams = data;
  })(req, res, next);
};
