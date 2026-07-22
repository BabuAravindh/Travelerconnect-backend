import mongoose from "mongoose";

const ResetPasswordSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  email: { type: String, required: true },
  resetPasswordCode: { type: String, required: true },
  resetPasswordExpires: { type: Date, required: true },
});

const ResetPassword = mongoose.model("ResetPassword", ResetPasswordSchema);
export default ResetPassword;
