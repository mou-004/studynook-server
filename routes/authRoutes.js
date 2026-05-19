import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  path: "/",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const createToken = (user) => {
  return jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

const sendUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  photo: user.photo,
});

router.post("/register", async (req, res) => {
  try {
    const { name, email, photo, password } = req.body;

    if (!name || !email || !photo || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (
      password.length < 6 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password)
    ) {
      return res.status(400).json({
        message:
          "Password must be at least 6 characters and include uppercase and lowercase letters.",
      });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      photo,
      password: hashedPassword,
      provider: "local",
    });

    return res.status(201).json({
      message: "Registration successful! Please login.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const matched = await bcrypt.compare(password, user.password);

    if (!matched) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = createToken(user);
    res.cookie("token", token, cookieOptions);

    return res.json({
      message: "Login successful",
      user: sendUser(user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    const email = payload?.email;
    const name = payload?.name || "Google User";
    const photo = payload?.picture || "https://i.ibb.co/4pDNDk1/avatar.png";

    if (!email) {
      return res.status(400).json({ message: "Google email is required" });
    }

    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        name,
        email,
        photo,
        provider: "google",
      });
    } else {
      // Keep Google profile updated if the user already exists
      user.name = user.name || name;
      user.photo = user.photo || photo;
      if (!user.provider) user.provider = "google";
      await user.save();
    }

    const token = createToken(user);
    res.cookie("token", token, cookieOptions);

    return res.json({
      message: "Google login successful",
      user: sendUser(user),
    });
  } catch (error) {
    return res.status(401).json({
      message: "Google authentication failed",
    });
  }
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id).select("-password");

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.json({
    user: sendUser(user),
  });
});

router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);

  return res.json({
    message: "Logged out",
  });
});

export default router;
