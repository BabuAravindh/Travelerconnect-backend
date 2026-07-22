// utils/authValidation.ts
const EMAIL_REGEX    = /^\S+@\S+\.\S+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export function validateSignupFields(body: any) {
  const { name, email, password, confirmPassword } = body;
  const errors: { field: string; message: string }[] = [];

  if (!name?.trim())       errors.push({ field: "name",            message: "Name is required" });
  if (!email)              errors.push({ field: "email",           message: "Email is required" });
  if (!password)           errors.push({ field: "password",        message: "Password is required" });
  if (!confirmPassword)    errors.push({ field: "confirmPassword", message: "Please confirm your password" });

  if (email && !EMAIL_REGEX.test(email))
    errors.push({ field: "email", message: "Enter a valid email address" });

  if (password && !PASSWORD_REGEX.test(password))
    errors.push({ field: "password", message: "Password must be 8+ chars with uppercase, lowercase, number & special character" });

  if (password && confirmPassword && password !== confirmPassword)
    errors.push({ field: "confirmPassword", message: "Passwords do not match" });

  return errors;
}