import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["admin", "user", "guide"]},
  profilePic: { type: String },


  verificationToken: { type: String }, 
  isVerified: { type: Boolean, default: false }, 
  credits: { 
    type: Number, 
    default: 10, 
    min: 0 
},
  
  resetPasswordCode: String,
  resetPasswordExpires: Date,
});

UserSchema.methods.createJWT = function () {
  return jwt.sign(
    { userId: this._id, name: this.name },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};

UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", UserSchema);
export default User;
