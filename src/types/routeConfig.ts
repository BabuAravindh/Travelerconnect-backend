// types/routeConfig.ts
import { RequestHandler } from "express";

export interface RouteConfig {
  method:       "get" | "post" | "put" | "delete" | "patch";
  path:         string;
  middlewares?: RequestHandler[];
  handler:      RequestHandler;
}