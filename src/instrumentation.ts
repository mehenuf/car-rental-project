import type { Instrumentation } from "next";
import { reportError } from "@/lib/observability";

export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  await reportError(err, { path: request.path, method: request.method, route: context.routePath, kind: context.routeType });
};
