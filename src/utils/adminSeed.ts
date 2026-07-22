// seeds/adminSeed.ts
import bcrypt from "bcryptjs";
import User from "../models/User";
import mongoose from "mongoose";

const seedAdmin = async () => {
    await mongoose.connect(process.env.MONGO_URI);

    const existing = await User.findOne({ email: "admin@travelerconnect.com" });
    if (existing) {
        console.log("Admin already exists");
        process.exit();
    }

    const hashedPassword = await bcrypt.hash("Admin@123", 10);

    await User.create({
        name: "Super Admin",
        email: "admin@travelerconnect.com",
        password: hashedPassword,
        role: "admin",
        isVerified: true,            
    });

    console.log("✅ Admin seeded successfully");
    process.exit();
};

seedAdmin();