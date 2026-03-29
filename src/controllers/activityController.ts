// controllers/activityController.js
import Activity from '../models/activityModel.js';

// Create a new activity
export const createActivity = async (req, res) => {
  try {
    const { activityName, order } = req.body;
    const newActivity = await Activity.create({ activityName, order });
    res.status(201).json(newActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Fetch all activities
export const getActivities = async (req, res) => {
  try {
    const activities = await Activity.find().sort({ order: 1 });
    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// Update an activity
export const updateActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { activityName, order } = req.body;

    const updatedActivity = await Activity.findByIdAndUpdate(
      id,
      { activityName, order },
      { new: true, runValidators: true }
    );

    if (!updatedActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.status(200).json(updatedActivity);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete an activity
export const deleteActivity = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedActivity = await Activity.findByIdAndDelete(id);

    if (!deletedActivity) {
      return res.status(404).json({ error: 'Activity not found' });
    }

    res.status(200).json({ message: 'Activity deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
