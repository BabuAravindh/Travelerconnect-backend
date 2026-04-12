// services/emailService.ts
import nodemailer from "nodemailer";
import { emailVerificationTemplate } from "../../utils/emailTemplate";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false },
});

// One function for all auth emails
export const sendEmail = async (to: string, subject: string, html: string) => {
  return transporter.sendMail({
    from: `"TravelerConnect" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

export const sendVerificationEmail = async (to: string, token: string, urlPath: string) => {
  const url = `${process.env.CLIENT_URL}/${urlPath}/${token}`;
  return sendEmail(to, "Verify Your Email - TravelerConnect", emailVerificationTemplate(url));
};