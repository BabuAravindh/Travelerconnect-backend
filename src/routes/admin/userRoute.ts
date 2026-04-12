import express from "express";
import {
  getUsers,
  getUser,
  updateUser,
  deleteUser
} from "../../controllers/admin/UserController.js";
import User from "../../models/User.js";
import Booking from "../../models/BookingModel.js";
import { Payment } from "../../models/Payment.js";

const router = express.Router();

// =======================
// Admin Stats Route
// =======================
router.get("/stats", async (req, res) => {
  try {
    // User Stats
    const totalUsers = await User.countDocuments();
    const guides = await User.countDocuments({ role: "guide" });
    const customers = await User.countDocuments({ role: "user" });

    // Booking Stats
    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: "finalized" });
    const pendingBookings = await Booking.countDocuments({ status: "pending" });
    const cancelledBookings = await Booking.countDocuments({ status: "cancelled" });
    const paidBookings = await Booking.countDocuments({ status: "paid" });

    // Payment Stats
    const totalPayments = await Payment.countDocuments();

    const totalRevenueResult = await Payment.aggregate([
      { $match: { paymentStatus: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRevenue = totalRevenueResult[0]?.total || 0;

    // Monthly Revenue for Last 12 Months
    const monthlyRevenue = await Payment.aggregate([
      { $match: { paymentStatus: "completed" } },
      {
        $group: {
          _id: {
            month: { $month: "$createdAt" },
            year: { $year: "$createdAt" }
          },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 }
    ]);

    // Format Monthly Data
    const formattedMonthlyRevenue = monthlyRevenue.map(item => ({
      month: new Date(item._id.year, item._id.month - 1).toLocaleString("default", {
        month: "long",
        year: "numeric"
      }),
      total: item.total
    })).reverse();

    // Refund Stats
    const totalRefunds = await Payment.countDocuments({ paymentStatus: "refunded" });
    const totalRefundAmountResult = await Payment.aggregate([
      { $match: { paymentStatus: "refunded" } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]);
    const totalRefundAmount = totalRefundAmountResult[0]?.total || 0;

    // Final Response
    const stats = {
      users: {
        total: totalUsers,
        guides,
        customers
      },
      bookings: {
        total: totalBookings,
        completed: completedBookings,
        pending: pendingBookings,
        cancelled: cancelledBookings,
        paid: paidBookings
      },
      payments: {
        totalTransactions: totalPayments,
        totalRevenue,
        totalRefunds,
        totalRefundAmount,
        monthlyRevenue: formattedMonthlyRevenue
      }
    };

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message
    });
  }
});



// =======================
// User Management Routes
// =======================
router.get("/", getUsers);
router.get("/:id", getUser);
router.put("/:id", updateUser);
router.delete("/:id", deleteUser);

export default router;
