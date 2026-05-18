import express from "express";
import Room from "../models/Room.js";
import Booking from "../models/Booking.js";
import auth from "../middleware/auth.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const { search, amenities, latest } = req.query;

    const queryObject = {};

    if (search) {
      queryObject.name = {
        $regex: search,
        $options: "i",
      };
    }

    if (amenities) {
      const amenitiesArray = amenities.split(",").filter(Boolean);

      if (amenitiesArray.length) {
        queryObject.amenities = {
          $in: amenitiesArray,
        };
      }
    }

    let roomsQuery = Room.find(queryObject)
      .populate("owner", "name email photo")
      .sort({ createdAt: -1 });

    if (latest === "true") {
      roomsQuery = roomsQuery.limit(6);
    }

    const rooms = await roomsQuery;

    return res.json(rooms);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/mine", auth, async (req, res) => {
  const rooms = await Room.find({
    owner: req.user.id,
  }).sort({ createdAt: -1 });

  return res.json(rooms);
});

router.get("/:id", async (req, res) => {
  const room = await Room.findById(req.params.id).populate(
    "owner",
    "name email photo"
  );

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  return res.json(room);
});

router.post("/", auth, async (req, res) => {
  try {
    const room = await Room.create({
      ...req.body,
      owner: req.user.id,
    });

    return res.status(201).json(room);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
});

router.put("/:id", auth, async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (room.owner.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Only owner can update this room",
    });
  }

  Object.assign(room, req.body);

  await room.save();

  return res.json(room);
});

router.delete("/:id", auth, async (req, res) => {
  const room = await Room.findById(req.params.id);

  if (!room) {
    return res.status(404).json({ message: "Room not found" });
  }

  if (room.owner.toString() !== req.user.id) {
    return res.status(403).json({
      message: "Only owner can delete this room",
    });
  }

  await Booking.deleteMany({
    room: room._id,
  });

  await room.deleteOne();

  return res.json({
    message: "Room deleted successfully",
  });
});

export default router;