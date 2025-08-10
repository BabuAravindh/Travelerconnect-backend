import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Activity from '../models/activityModel.js'; // Adjust the path as needed

dotenv.config(); // Load environment variables from .env file

// Connect to the database
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => ('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error));

// Predefined activities data
const activities = [
  { activityName: 'Hiking', order: 1 },
  { activityName: 'Snorkeling', order: 2 },
  { activityName: 'City Tour', order: 3 },
  { activityName: 'Wildlife Safari', order: 4 },
  { activityName: 'Mountain Biking', order: 5 },
  { activityName: 'Rock Climbing', order: 6 },
  { activityName: 'Scuba Diving', order: 7 },
  { activityName: 'Cultural Exploration', order: 8 },
];

// Seed function
const seedActivities = async () => {
  try {
    await Activity.deleteMany(); // Clear existing data
    const insertedActivities = await Activity.insertMany(activities);
    ('✅ Activities Seeded Successfully:', insertedActivities);
    mongoose.connection.close();
  } catch (error) {
    console.error('Error seeding activities:', error);
    mongoose.connection.close();
  }
};

// Execute the seed function
seedActivities();
