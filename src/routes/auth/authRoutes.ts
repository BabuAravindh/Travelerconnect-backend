// routes/auth/index.ts

/**
 * @api AUTH ROUTES
 * @baseUrl /api/auth
 * =======================================================
 * 
 * ┌─────────────────────────────────────────────────────┐
 * │                   USER AUTH                         │
 * └─────────────────────────────────────────────────────┘
 *
 * @route   POST /api/auth/signup
 * @desc    Registers a new user account.
 *          Hashes password, creates user in DB,
 *          sends a verification email with a token link.
 *          User cannot login until email is verified.
 * @access  Public
 * @body    {
 *            name:            string  - Display name (must be unique)
 *            email:           string  - Valid email address (must be unique)
 *            password:        string  - Min 8 chars, must have uppercase,
 *                                      lowercase, number, special char
 *            confirmPassword: string  - Must match password
 *          }
 * @success 201 { message, user: { id, name, role } }
 * @error   400 - Validation errors / email or name already taken
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/login
 * @desc    Authenticates an existing user (role: user or admin).
 *          Validates credentials, checks email verification,
 *          returns a signed JWT token with user info.
 * @access  Public
 * @body    {
 *            email:    string - Registered email address
 *            password: string - Account password
 *          }
 * @success 200 { message, token, user: { _id, name, role, phone } }
 * @error   400 - Missing fields
 * @error   401 - Invalid credentials / email not verified
 * @error   403 - Role not allowed on this route (guide trying user login)
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   GET /api/auth/verify-email/:token
 * @desc    Verifies a user's email using the token sent during signup.
 *          Marks user as verified in DB, returns a JWT token
 *          so user is automatically logged in after verification.
 * @access  Public
 * @params  token - Verification token from the email link
 * @body    None
 * @success 200 { message, token, user: { id, name, role } }
 * @error   400 - Invalid or expired token
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/resendverification
 * @desc    Resends a new verification email to the user.
 *          Generates a fresh token and replaces the old one.
 *          Use when the previous email expired or wasn't received.
 * @access  Public
 * @body    {
 *            email: string - Email address of the unverified account
 *          }
 * @success 200 { message: "Verification email sent successfully." }
 * @error   400 - Email already verified
 * @error   404 - User not found
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * ┌─────────────────────────────────────────────────────┐
 * │                  GUIDE AUTH                         │
 * └─────────────────────────────────────────────────────┘
 *
 * @route   POST /api/auth/guide/signup
 * @desc    Registers a new guide account.
 *          Same flow as user signup but forces role to "guide".
 *          Sends a separate guide-specific verification email link.
 *          Guide must also upload government ID after verification.
 * @access  Public
 * @body    {
 *            name:     string - Display name (must be unique)
 *            email:    string - Valid email address (must be unique)
 *            password: string - Account password
 *          }
 * @success 201 { message, user: { id, name, role } }
 * @error   400 - Missing fields / email or name already taken
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/guide/login
 * @desc    Authenticates an existing guide account (role: guide only).
 *          Returns JWT token and a redirectUrl based on whether
 *          the guide has uploaded their government ID or not.
 * @access  Public
 * @body    {
 *            email:    string - Registered guide email
 *            password: string - Account password
 *          }
 * @success 200 {
 *            message,
 *            token,
 *            user: { _id, name, role, govIdVerified },
 *            redirectUrl: "/guides/upload-id" | CLIENT_URL
 *          }
 * @error   400 - Missing fields
 * @error   401 - Invalid credentials / email not verified
 * @error   403 - Role not allowed (user trying guide login)
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   GET /api/auth/guide/verify-email/:token
 * @desc    Verifies a guide's email using the token sent during signup.
 *          Marks guide as verified, returns JWT token.
 *          Response also tells frontend whether guide still needs
 *          to upload their government ID (requiresIdUpload flag).
 * @access  Public
 * @params  token - Verification token from the guide email link
 * @body    None
 * @success 200 {
 *            message,
 *            token,
 *            user: { id, name, role },
 *            requiresIdUpload: boolean,
 *            redirectUrl: "/guides/upload-id" | "/guide-dashboard"
 *          }
 * @error   400 - Invalid or expired token
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/verifyId
 * @desc    Uploads a guide's government ID to Cloudinary.
 *          Updates guide record with document URL and sets
 *          verificationStatus to "pending" (admin reviews later).
 *          Also updates user role to "guide" in User collection.
 * @access  Public
 * @middleware multer.single("governmentId") - handles file parsing
 * @body    {
 *            userId: string - The guide's user ID
 *          }
 * @file    governmentId - JPG / PNG / PDF, max 5MB
 *          Must be sent as multipart/form-data
 * @success 200 {
 *            success: true,
 *            message,
 *            data: {
 *              guide,
 *              user:     { _id, name, role },
 *              document: { url, uploadedAt }
 *            }
 *          }
 * @error   400 - No file / invalid file type
 * @error   503 - Cloudinary unavailable
 * @error   502 - Upload failed after retries
 * @error   504 - Upload timeout (try smaller file)
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * ┌─────────────────────────────────────────────────────┐
 * │                PASSWORD RESET                       │
 * └─────────────────────────────────────────────────────┘
 *
 * @route   POST /api/auth/forgot-password
 * @desc    Initiates password reset flow.
 *          Finds user by email, generates a 6-digit OTP,
 *          saves it to ResetPassword collection with 10min expiry,
 *          and sends it to the user's email.
 * @access  Public
 * @body    {
 *            email: string - Registered email address
 *          }
 * @success 200 { message: "Reset code sent to email" }
 * @error   400 - Missing email
 * @error   404 - User not found
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/verify-reset-code
 * @desc    Verifies the 6-digit OTP sent to user's email.
 *          If valid and not expired, stores userId in a temporary
 *          in-memory session (10 min window) for the reset step.
 *          Must be called before reset-password.
 * @access  Public
 * @body    {
 *            otp: string - 6-digit code from the reset email
 *          }
 * @success 200 { message: "Code verified successfully" }
 * @error   400 - Missing OTP / invalid or expired code
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/reset-password
 * @desc    Final step of password reset flow.
 *          Reads the verified userId from the in-memory session
 *          (set by verify-reset-code), hashes and saves new password.
 *          Session is deleted after use — one time only.
 *          Must call verify-reset-code first, within 10 minutes.
 * @access  Public
 * @body    {
 *            newPassword: string - New password to set
 *          }
 * @success 200 { message: "Password reset successfully" }
 * @error   400 - Reset session expired or not found
 * @error   404 - User not found
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * ┌─────────────────────────────────────────────────────┐
 * │                  VALIDATION                         │
 * └─────────────────────────────────────────────────────┘
 *
 * @route   POST /api/auth/validate/name
 * @desc    Checks if a name is already taken in the DB.
 *          Used for real-time name availability check on signup form.
 *          Call this on input blur/debounce — not on every keystroke.
 * @access  Public
 * @body    {
 *            name: string - Name to check availability for
 *          }
 * @success 200 { status: "success", message: "This name is available." }
 * @error   400 { status: "info",    message: "This name is already taken." }
 * @error   400 { status: "error",   message: "Please enter a name." }
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * @route   POST /api/auth/validate/email
 * @desc    Checks if an email is already registered in the DB.
 *          Used for real-time email availability check on signup form.
 *          Call this on input blur/debounce — not on every keystroke.
 * @access  Public
 * @body    {
 *            email: string - Email to check availability for
 *          }
 * @success 200 { status: "success", message: "This email is available." }
 * @error   400 { status: "info",    message: "This email is already taken." }
 * @error   400 { status: "error",   message: "Please enter an email." }
 * @error   500 - Server error
 *
 * -------------------------------------------------------
 *
 * ┌─────────────────────────────────────────────────────┐
 * │            PASSWORD RESET FLOW ORDER                │
 * └─────────────────────────────────────────────────────┘
 *
 *  1. POST /forgot-password    → sends OTP to email
 *  2. POST /verify-reset-code  → verifies OTP, opens 10min window
 *  3. POST /reset-password     → sets new password, closes window
 *
 * ┌─────────────────────────────────────────────────────┐
 * │              GUIDE ONBOARDING FLOW                  │
 * └─────────────────────────────────────────────────────┘
 *
 *  1. POST /guide/signup           → creates guide account
 *  2. GET  /guide/verify-email/:token → verifies email
 *  3. POST /verifyId               → uploads government ID
 *  4. POST /guide/login            → login (redirects based on ID status)
 */



import { authRoutes }     from "../../constants/auth/authRouteConfig";
import { registerRoutes } from "../../utils/registerRoutes.js";

export default registerRoutes(authRoutes);