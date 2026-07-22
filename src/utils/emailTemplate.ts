export const emailVerificationTemplate = (verificationUrl) => {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verification - TravelerConnect</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 600px;
            margin: 20px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0px 2px 10px rgba(0, 0, 0, 0.1);
            text-align: center;
          }
          h2 {
            color: #1E293B;
          }
          p {
            font-size: 16px;
            color: #333;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            margin: 20px 0;
            font-size: 16px;
            color: #ffffff;
            background-color: #1E293B;
            text-decoration: none;
            border-radius: 5px;
          }
          .footer {
            margin-top: 20px;
            font-size: 14px;
            color: #777;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>Verify Your Email</h2>
          <p>Thank you for signing up for <b>TravelerConnect</b>. Please verify your email address by clicking the button below:</p>
          <a href="${verificationUrl}" class="button">Verify Email</a>
          <p>If the button doesn't work, you can also click on this link:</p>
          <p><a href="${verificationUrl}">${verificationUrl}</a></p>
          <hr>
          <p class="footer">If you did not sign up for TravelerConnect, please ignore this email.</p>
        </div>
      </body>
      </html>
    `;
  };
  