
// controllers/bookingController.js
import Booking from '../models/BookingModel.js';
import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js'
import { Language } from '../models/predefineSchemas.js';
import activityModel from '../models/activityModel.js';
import UserProfile from '../models/UserProfile.js';
import User from "../models/User.js"; // Import User model
import Guide from '../models/Guide.js';
export const createBooking = async (req, res) => {
  try {
    const { 
      userId, 
      guideId, 
      startDate, 
      endDate, 
      budget,
      pickupLocation,
      dropoffLocation,
      activities = [],
      specialRequests = ''
    } = req.body;

    (activities, "activities in booking controller");

    // Validate required fields
    const requiredFields = { userId, guideId, startDate, endDate, budget };
    for (const [field, value] of Object.entries(requiredFields)) {
      if (!value) {
        return res.status(400).json({ 
          success: false,
          message: `Missing required field: ${field}` 
        });
      }
    }

    // Validate budget
    if (isNaN(budget) || Number(budget) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Budget must be a positive number"
      });
    }

    // Parse and validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid start date format"
      });
    }

    if (isNaN(end.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid end date format"
      });
    }

    if (start < today) {
      return res.status(400).json({
        success: false,
        message: "Start date cannot be in the past"
      });
    }

    if (start >= end) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date"
      });
    }

    // Restrict future bookings to 1 year
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 1);
    if (start > maxFutureDate || end > maxFutureDate) {
      return res.status(400).json({
        success: false,
        message: "Booking dates cannot be more than 1 year in the future"
      });
    }

    // Check guide validity
    const guide = await User.findById(guideId);
    if (!guide || guide.role !== 'guide') {
      return res.status(404).json({
        success: false,
        message: "Guide not found or invalid"
      });
    }

    // Check for date conflicts
    const conflictingBooking = await Booking.findOne({
      guideId,
      $or: [
        { startDate: { $lt: end, $gte: start } },
        { endDate: { $lte: end, $gt: start } },
        { startDate: { $lte: start }, endDate: { $gte: end } }
      ],
      status: { $nin: ['cancelled', 'rejected'] }
    });

    if (conflictingBooking) {
      return res.status(409).json({
        success: false,
        message: "Guide is already booked for the selected dates",
        conflictingDates: {
          start: conflictingBooking.startDate,
          end: conflictingBooking.endDate
        }
      });
    }

    // Create booking
    const newBooking = new Booking({ 
      userId, 
      guideId, 
      startDate: start,
      endDate: end,
      budget: Number(budget),
      pickupLocation,
      dropoffLocation,
      activities: Array.isArray(activities) ? activities : [activities],
      specialRequests,
      status: 'pending',
      paymentStatus: 'unpaid',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await newBooking.save();

    // Create conversation if not exists
    let conversation = await Conversation.findOne({
      participants: { $all: [userId, guideId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        participants: [userId, guideId],
        isBookingRelated: true,
        bookingId: newBooking._id
      });
      await conversation.save();
    }

    res.status(201).json({
      success: true,
      message: "Booking created successfully!",
      booking: {
        id: newBooking._id,
        guideId: newBooking.guideId,
        userId: newBooking.userId,
        startDate: newBooking.startDate,
        endDate: newBooking.endDate,
        status: newBooking.status,
        budget: newBooking.budget
      },
      conversationId: conversation?._id
    });

  } catch (error) {
    console.error("Error creating booking:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating booking",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const updateBookingDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, budget, startDate, endDate } = req.body;

    // Fetch existing booking to validate conditions
    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    const updateFields = {};

    // ✅ Restrict marking status as 'completed' unless endDate has passed
    if (status) {
      if (status === 'completed') {
        const today = new Date();
        const bookingEndDate = new Date(booking.endDate);

        if (bookingEndDate > today) {
          return res.status(400).json({
            message: "Booking can only be marked as 'completed' after the end date has passed.",
          });
        }
      }

      updateFields.status = status;
    }

    // ✅ Payment status update
    if (paymentStatus) {
      updateFields.paymentStatus = paymentStatus;
    }

    // ✅ Budget update with validation
    if (budget !== undefined) {
      if (isNaN(budget) || budget <= 0) {
        return res.status(400).json({ message: "Invalid budget value" });
      }
      updateFields.budget = budget;
    }

    // ✅ Validate and update start date
    if (startDate) {
      if (isNaN(new Date(startDate).getTime())) {
        return res.status(400).json({ message: "Invalid start date format" });
      }
      updateFields.startDate = startDate;
    }

    // ✅ Validate and update end date
    if (endDate) {
      if (isNaN(new Date(endDate).getTime())) {
        return res.status(400).json({ message: "Invalid end date format" });
      }
      updateFields.endDate = endDate;
    }

    // ✅ Perform the update
    const updatedBooking = await Booking.findByIdAndUpdate(id, updateFields, { new: true });

    res.status(200).json({ message: "Booking updated successfully!", updatedBooking });
  } catch (error) {
    console.error("Error updating booking details:", error);
    res.status(500).json({ message: "Error updating booking details", error });
  }
};

export const getGuideBookings = async (req, res) => {
  try {
    const { guideId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(guideId)) {
      return res.status(400).json({ message: "Invalid guide ID format" });
    }

    const bookings = await Booking.find({ guideId })
      .populate({
        path: 'userId',
        select: 'name email',
        model: 'User'
      })
      .sort({ startDate: 1 });

    // Get all unique user IDs from bookings
    const userIds = bookings.map(b => b.userId?._id?.toString());

    // Fetch user profiles based on userId
    const profiles = await UserProfile.find({ userId: { $in: userIds } }).select('userId phoneNumber');

    // Create a map for fast lookup
    const profileMap = new Map();
    profiles.forEach(profile => {
      profileMap.set(profile.userId.toString(), profile.phoneNumber);
    });

    const formattedBookings = bookings.map(booking => {
      const start = new Date(booking.startDate);
      const end = new Date(booking.endDate);
      const durationDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

      const phone = profileMap.get(booking.userId?._id?.toString()) || "Not Available";

      return {
        id: booking._id,
        userName: booking.userId?.name || "Unknown",
        email: booking.userId?.email || "Not Available",
        phoneNumber: phone,
        startDate: booking.startDate.toISOString().split("T")[0],
        endDate: booking.endDate.toISOString().split("T")[0],
        budget: booking.budget,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        duration: `${durationDays} day(s)`,
        specialRequests: booking.specialRequests || "None",
        pickupLocation: booking.pickupLocation,
        dropoffLocation: booking.dropoffLocation,
        activities: booking.activities,
        bookingDate: booking.bookingDate.toISOString().split("T")[0]
      };
    });

    res.json({
      success: true,
      count: formattedBookings.length,
      bookings: formattedBookings
    });

  } catch (error) {
    console.error("Error fetching guide bookings:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching guide bookings",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getUserBookings = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    ("Fetching bookings for User ID:", userId);

    // Fetch all bookings for the given userId with lean() for better performance
    const bookings = await Booking.find({ userId }).lean();
     ("Bookings found:", bookings.length);
    if (!bookings.length) {
      (`No bookings found for user ${userId}`);
      return res.status(200).json([]);
    }

    // Process bookings safely
    const enrichedBookings = await Promise.all(bookings.map(async (booking) => {
      try {
        // Safely handle missing guideId
        const guideId = booking.guideId ? booking.guideId.toString() : null;

        // Default empty guide profile
        const defaultGuideProfile = {
          languages: [],
          activities: [],
          guideName: 'Unknown Guide',
          guideEmail: 'No email available',
          guidePhoneNumber: 'Not provided',
        };

        // If no guideId, return booking with default profile
        if (!guideId) {
          return {
            ...booking,
            guideProfile: defaultGuideProfile
          };
        }

        // Fetch guide data in parallel
        const [guide, guideUser, userProfile] = await Promise.all([
          Guide.findOne({ userId: guideId })
            .populate('languages', 'languageName')
            .populate('activities', 'activityName')
            .lean(),
          User.findOne({ _id: guideId }).select('email name').lean(),
          UserProfile.findOne({ userId: guideId }).select('phoneNumber').lean()
        ]);

        return {
          ...booking,
          guideProfile: {
            languages: guide?.languages?.map(lang => lang.languageName) || [],
            activities: guide?.activities?.map(act => act.activityName) || [],
            guideName: guideUser?.name || 'Unknown Guide',
            guideEmail: guideUser?.email || 'No email available',
            guidePhoneNumber: userProfile?.phoneNumber || 'Not provided',
          }
        };
      } catch (error) {
        console.error(`Error processing booking ${booking._id}:`, error);
        return {
          ...booking,
          guideProfile: {
            languages: [],
            activities: [],
            guideName: 'Unknown Guide',
            guideEmail: 'No email available',
            guidePhoneNumber: 'Not provided',
          }
        };
      }
    }));

    res.json(enrichedBookings);
  } catch (error) {
    console.error("Error fetching user bookings:", error);
    
    let errorMessage = "Error fetching user bookings";
    if (error.name === 'CastError') {
      errorMessage = "Invalid data format in database";
    } else if (error.name === 'MongoNetworkError') {
      errorMessage = "Database connection error";
    }

    res.status(500).json({ 
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



//admin booking controllers
export const getAllBookings = async (req, res) => {
  try {
    const { status, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    
    // Build filter object (initially empty to get all bookings)
    const filter = {};
    
    // Add optional filters
    if (status) filter.status = status;
    if (dateFrom || dateTo) {
      filter.startDate = {};
      if (dateFrom) filter.startDate.$gte = new Date(dateFrom);
      if (dateTo) filter.startDate.$lte = new Date(dateTo);
    }
    
    // Get total count of matching bookings
    const total = await Booking.countDocuments(filter);
    
    // If no bookings found, return early with empty array
    if (total === 0) {
      return res.json({
        total: 0,
        page: parseInt(page),
        pages: 0,
        limit: parseInt(limit),
        bookings: []
      });
    }
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    const totalPages = Math.ceil(total / limit);
    
    // Get bookings with pagination and population
    const bookings = await Booking.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate({
        path: 'userId',
        select: 'name email',
        model: 'User'
      })
      .populate({
        path: 'guideId',
        select: 'name email',
        model: 'User'
      })
      .lean();
    
    // Format the response
    const formattedBookings = bookings.map(booking => {
      // Calculate duration in days
      const durationDays = Math.ceil(
        (new Date(booking.endDate) - new Date(booking.startDate)) / 
        (1000 * 60 * 60 * 24)
      );
      
      return {
        ...booking,
        id: booking._id,
        userName: booking.userId?.name || 'Unknown User',
        userEmail: booking.userId?.email || '',
        guideName: booking.guideId?.name || 'Unknown Guide',
        guideEmail: booking.guideId?.email || '',
        duration: `${durationDays} day${durationDays !== 1 ? 's' : ''}`,
        // Remove populated objects if not needed
        userId: undefined,
        guideId: undefined,
        _id: undefined,
        __v: undefined
      };
    });
    
    res.json({
      total,
      page: parseInt(page),
      pages: totalPages,
      limit: parseInt(limit),
      bookings: formattedBookings
    });
    
  } catch (error) {
    console.error("Error fetching bookings:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch bookings",
      error: error.message 
    });
  }
};

export const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;
    
    const deletedBooking = await Booking.findByIdAndDelete(id);
    
    if (!deletedBooking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    
    res.json({
      message: "Booking deleted successfully",
      booking: {
        _id: deletedBooking._id,
        startDate: deletedBooking.startDate,
        endDate: deletedBooking.endDate
      }
    });
    
  } catch (error) {
    console.error("Error deleting booking:", error);
    res.status(500).json({ message: "Error deleting booking", error });
  }
};





















