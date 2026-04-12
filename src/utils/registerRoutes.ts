// utils/registerRoutes.ts
import { Router } from "express";
import { RouteConfig } from "../types/routeConfig.js";

export const registerRoutes = (routes: RouteConfig[]): Router => {
  const router = Router();
  routes.forEach(({ method, path, middlewares = [], handler }) => {
    router[method](path, ...middlewares, handler);
  });
  return router;
};