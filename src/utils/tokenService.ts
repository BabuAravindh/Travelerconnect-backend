//tokenService.ts
import jwt from "jsonwebtoken";

export const generateToken = (payload: object, expiresIn = "7d") =>
  jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn });