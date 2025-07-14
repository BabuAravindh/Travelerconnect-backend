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



export default authenticateUser;
