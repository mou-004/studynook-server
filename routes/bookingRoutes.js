import express from "express";
import Booking from "../models/Booking.js";
import Room from "../models/Room.js";
import User from "../models/User.js";
import auth from "../middleware/auth.js";

const router = express.Router();

const getHour = (time) => Number(String(time).split(":")[0]);

router.post("/", auth, async (req, res) => {
  try {
    const { roomId, date, startTime, endTime, note } = req.body;

    if (!roomId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: "Date and time are required" });
    }

    const selectedDate = new Date(`${date}T00:00:00`);
    const today = new Date(new Date().toDateString());

    if (selectedDate < today) {
      return res.status(400).json({ message: "Date must be today or future" });
    }

    if (getHour(endTime) <= getHour(startTime)) {
      return res.status(400).json({
        message: "End time must be after start time",
      });
    }

    const room = await Room.findById(roomId);

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    const conflict = await Booking.findOne({
      room: roomId,
      date,
      status: "confirmed",
      startTime: { $lt: endTime },
      endTime: { $gt: startTime },
    });

    if (conflict) {
      return res.status(409).json({
        message: "This time slot is already booked",
      });
    }

    const totalCost = (getHour(endTime) - getHour(startTime)) * room.hourlyRate;

    const booking = await Booking.create({
      room: roomId,
      user: req.user.id,
      date,
      startTime,
      endTime,
      totalCost,
      note,
    });

    await User.findByIdAndUpdate(req.user.id, {
      $push: { bookings: booking._id },
    });

    await Room.findByIdAndUpdate(roomId, {
      $inc: { bookingCount: 1 },
    });

    return res.status(201).json(booking);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/mine", auth, async (req, res) => {
  const bookings = await Booking.find({
    user: req.user.id,
  })
    .populate("room", "name image floor hourlyRate capacity")
    .sort({ createdAt: -1 });

  return res.json(bookings);
});

router.patch("/:id/cancel", auth, async (req, res) => {
  const booking = await Booking.findById(req.params.id);

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (booking.user.toString() !== req.user.id) {
    return res.status(403).json({ message: "Only owner can cancel booking" });
  }

  booking.status = "cancelled";
  await booking.save();

  await User.findByIdAndUpdate(req.user.id, {
    $pull: { bookings: booking._id },
  });

  return res.json({ message: "Booking cancelled" });
});

export default router;