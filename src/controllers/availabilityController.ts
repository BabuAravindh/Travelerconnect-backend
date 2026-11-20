// controllers/guideAvailabilityController.js
import GuideAvailability from '../models/guideAvailability.js';

// Add guide availability
export const addAvailability = async (req, res) => {
  try {
    const { guideId, availableDay } = req.body;

    if (guideId !== req.user?._id?.toString() && req.user?.role !== "admin") {
      return res.status(403).json({ error: "You can only set your own availability" });
    }

    const newAvailability = await GuideAvailability.create({ guideId, availableDay });
    res.status(201).json(newAvailability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get guide availability
export const getAvailability = async (req, res) => {
  try {
    const { guideId } = req.params;
    const availability = await GuideAvailability.find({ guideId });
    res.status(200).json(availability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Mark guide as booked
export const bookGuide = async (req, res) => {
  try {
    const { guideId } = req.params;
    const updatedAvailability = await GuideAvailability.findOneAndUpdate(
      { guideId, isBooked: false }, 
      { isBooked: true }, 
      { new: true }
    );

    if (!updatedAvailability) {
      return res.status(404).json({ message: 'Guide not available or already booked' });
    }

    res.status(200).json(updatedAvailability);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
