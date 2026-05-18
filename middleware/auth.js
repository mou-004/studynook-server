import jwt from "jsonwebtoken";

export default function auth(req, res, next) {
  try {
    const token = req.cookies?.token;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.userId,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}