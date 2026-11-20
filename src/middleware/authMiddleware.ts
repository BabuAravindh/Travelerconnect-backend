import jwt from "jsonwebtoken";

const authenticateUser = (req, res, next) => {
  const token = req.header("Authorization");

  if (!token) {
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);

console.log("Decoded JWT:", decoded);
    // Ensure `_id` is assigned correctly
    req.user = { _id: decoded.id, name: decoded.name, role: decoded.role };



    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    res.status(400).json({ message: "Invalid token." });
  }
};



// Decodes the token if present, but never blocks the request when it's missing/invalid.
// Use for routes that are public but behave differently for an authenticated owner/admin.
export const optionalAuth = (req, res, next) => {
  const token = req.header("Authorization");
  if (!token) return next();

  try {
    const decoded = jwt.verify(token.replace("Bearer ", ""), process.env.JWT_SECRET);
    req.user = { _id: decoded.id, name: decoded.name, role: decoded.role };
  } catch {
    // ignore invalid/expired token on an optional-auth route
  }
  next();
};

export default authenticateUser;
