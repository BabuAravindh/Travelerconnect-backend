import jwt from 'jsonwebtoken';

export const verifyAdmin = (req, res, next) => {
  try {
    // Get token from the Authorization header (matches authMiddleware's scheme)
    const header = req.header("Authorization");

    if (!header) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = header.replace("Bearer ", "");

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Check admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};