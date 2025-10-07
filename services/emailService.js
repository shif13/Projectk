
// services/emailService.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('⚠️ Email credentials not found in environment variables');
    return null;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    return transporter;
  } catch (error) {
    console.error('⚠️ Failed to create email transporter:', error.message);
    return null;
  }
};

const transporter = createTransporter();

// Verify transporter configuration
const verifyEmailConfig = async () => {
  if (!transporter) {
    console.log('⚠️ Email service disabled - no credentials provided');
    return false;
  }

  try {
    await transporter.verify();
    console.log('✅ Email service is ready');
    return true;
  } catch (error) {
    console.error('❌ Email service error:', error.message);
    return false;
  }
};


// Welcome email template for job seekers
const getJobSeekerWelcomeTemplate = (userData) => {
  return {
    subject: 'Welcome to TalentConnect! Your Account is Ready',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Welcome to TalentConnect!</h1>
            <p>Your freelance journey starts here</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName} ${userData.lastName}!</h2>
            
            <p>Congratulations! Your TalentConnect account has been successfully created. You're now part of a vibrant community of talented professionals.</p>
            
            <div class="feature">
              <h3>📋 Your Profile</h3>
              <p><strong>Username:</strong> ${userData.userName}<br>
                 <strong>Email:</strong> ${userData.email}<br>
                 <strong>Account Type:</strong> Job Seeker</p>
            </div>
            
            <div class="feature">
              <h3>🚀 What's Next?</h3>
              <ul>
                <li>Complete your profile with skills and experience</li>
                <li>Upload your CV and certificates</li>
                <li>Set your availability status</li>
                <li>Start connecting with recruiters</li>
              </ul>
            </div>
            
            <div class="feature">
              <h3>💡 Pro Tips</h3>
              <ul>
                <li>Keep your profile updated with latest skills</li>
                <li>Upload a professional CV in PDF format</li>
                <li>Add your LinkedIn and GitHub profiles</li>
                <li>Write a compelling bio that highlights your expertise</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
                Access Your Dashboard
              </a>
            </div>
            
            <p>If you have any questions or need help getting started, feel free to reply to this email or contact our support team.</p>
            
            <p>Best regards,<br>The TalentConnect Team</p>
          </div>
          
          <div class="footer">
            <p>© 2024 TalentConnect. All rights reserved.</p>
            <p>This email was sent to ${userData.email}</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Welcome to TalentConnect, ${userData.firstName}!
      
      Your account has been successfully created.
      
      Account Details:
      - Username: ${userData.userName}
      - Email: ${userData.email}
      - Account Type: Job Seeker
      
      What's Next:
      - Complete your profile
      - Upload your CV and certificates
      - Set your availability status
      - Start connecting with recruiters
      
      Login at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/login
      
      Best regards,
      The TalentConnect Team
    `
  };
};

// Send welcome email
const sendWelcomeEmail = async (userData, userType, companyName = null) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping welcome email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    let emailTemplate;
    
    if (userType === 'jobseeker') {
      emailTemplate = getJobSeekerWelcomeTemplate(userData);
    } else if (userType === 'recruiter') {
      emailTemplate = getRecruiterWelcomeTemplate(userData, companyName);
    } else {
      throw new Error('Invalid user type');
    }
    
    const mailOptions = {
      from: {
        name: 'TalentConnect',
        address: process.env.EMAIL_USER
      },
      to: userData.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Welcome email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send welcome email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password reset email with prominent token display
const sendPasswordResetEmail = async (user, resetToken) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping password reset email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: {
        name: 'TalentConnect Security',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: '🔐 Your Password Reset Code - TalentConnect',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5; 
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white; 
              border-radius: 16px; 
              overflow: hidden; 
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
            }
            .header { 
              background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); 
              color: white; 
              text-align: center; 
              padding: 40px 24px; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .content { 
              padding: 40px 32px; 
            }
            .token-container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              border-radius: 12px;
              padding: 32px;
              margin: 32px 0;
              text-align: center;
              box-shadow: 0 4px 16px rgba(102, 126, 234, 0.3);
            }
            .token-label {
              color: white;
              font-size: 14px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin-bottom: 16px;
              opacity: 0.9;
            }
            .token-code {
              background: white;
              color: #667eea;
              font-size: 48px;
              font-weight: 800;
              font-family: 'Courier New', monospace;
              letter-spacing: 12px;
              padding: 20px;
              border-radius: 8px;
              display: inline-block;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
              margin: 0;
            }
            .token-expiry {
              color: white;
              font-size: 13px;
              margin-top: 16px;
              opacity: 0.9;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #f44336 0%, #e91e63 100%);
              color: white; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
              box-shadow: 0 4px 12px rgba(244, 67, 54, 0.3);
              transition: all 0.3s ease;
            }
            .warning { 
              background: #fff3cd; 
              border-left: 4px solid #ffc107;
              padding: 20px; 
              border-radius: 8px; 
              margin: 24px 0; 
            }
            .warning-title {
              color: #856404;
              font-weight: 700;
              margin-bottom: 8px;
              font-size: 16px;
            }
            .warning ul {
              margin: 8px 0;
              padding-left: 20px;
              color: #856404;
            }
            .warning li {
              margin: 6px 0;
            }
            .steps {
              background: #f8f9fa;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
            }
            .step {
              display: flex;
              align-items: flex-start;
              margin: 16px 0;
            }
            .step-number {
              background: #667eea;
              color: white;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: 700;
              margin-right: 16px;
              flex-shrink: 0;
            }
            .footer { 
              background: #f8f9fa; 
              padding: 24px; 
              text-align: center; 
              border-top: 1px solid #e9ecef; 
              font-size: 13px; 
              color: #6c757d; 
            }
            .footer-links {
              margin-top: 16px;
            }
            .footer-links a {
              color: #667eea;
              text-decoration: none;
              margin: 0 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.95;">Secure your TalentConnect account</p>
            </div>
            
            <div class="content">
              <h2 style="color: #333; margin-top: 0;">Hello ${user.firstName || 'User'}!</h2>
              
              <p style="font-size: 16px; color: #555;">
                You requested a password reset for your TalentConnect account (<strong>${user.email}</strong>).
              </p>

              <div class="token-container">
                <div class="token-label">Your Reset Code</div>
                <div class="token-code">${resetToken}</div>
                <div class="token-expiry">⏱️ Valid for 1 hour</div>
              </div>

              <div class="steps">
                <h3 style="margin-top: 0; color: #333;">How to Reset Your Password:</h3>
                <div class="step">
                  <div class="step-number">1</div>
                  <div>Click the button below or copy the 6-digit code above</div>
                </div>
                <div class="step">
                  <div class="step-number">2</div>
                  <div>Enter the code on the password reset page</div>
                </div>
                <div class="step">
                  <div class="step-number">3</div>
                  <div>Create your new password (minimum 6 characters)</div>
                </div>
              </div>

              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              
              <p style="font-size: 14px; color: #6c757d; text-align: center;">
                Or copy this link: <br>
                <span style="word-break: break-all; background: #f0f0f0; padding: 8px 12px; border-radius: 4px; display: inline-block; margin-top: 8px; font-size: 12px;">
                  ${resetUrl}
                </span>
              </p>
              
              <div class="warning">
                <div class="warning-title">⚠️ Important Security Information</div>
                <ul>
                  <li><strong>This code expires in 1 hour</strong> for your security</li>
                  <li>You can only use this code once</li>
                  <li>If you didn't request this reset, please ignore this email and secure your account</li>
                  <li>Your current password remains active until you create a new one</li>
                  <li>Never share this code with anyone, including TalentConnect support</li>
                </ul>
              </div>
              
              <p style="font-size: 14px; color: #555; margin-top: 24px;">
                If you have any concerns about your account security, please contact our support team immediately.
              </p>
              
              <p style="margin-top: 32px; color: #333;">
                Best regards,<br>
                <strong>The TalentConnect Security Team</strong>
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0;"><strong>TalentConnect</strong></p>
              <p style="margin: 8px 0;">© ${new Date().getFullYear()} TalentConnect. All rights reserved.</p>
              <p style="margin: 8px 0;">This email was sent to <strong>${user.email}</strong></p>
              <div class="footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Contact Support</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - TalentConnect
        
        Hello ${user.firstName || 'User'},
        
        You requested a password reset for your TalentConnect account (${user.email}).
        
        YOUR RESET CODE: ${resetToken}
        
        This code is valid for 1 hour.
        
        HOW TO RESET YOUR PASSWORD:
        1. Click this link: ${resetUrl}
        2. Enter the 6-digit code: ${resetToken}
        3. Create your new password (minimum 6 characters)
        
        IMPORTANT SECURITY INFORMATION:
        - This code expires in 1 hour
        - You can only use this code once
        - If you didn't request this reset, ignore this email
        - Never share this code with anyone
        
        If you have concerns about your account security, contact our support team immediately.
        
        Best regards,
        The TalentConnect Security Team
        
        © ${new Date().getFullYear()} TalentConnect. All rights reserved.
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send password reset email:', error.message);
    return { success: false, error: error.message };
  }
};

// Send password change confirmation email
const sendPasswordChangeConfirmation = async (user) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping password change confirmation');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`;
    const changeDate = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    const mailOptions = {
      from: {
        name: 'TalentConnect Security',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: '✅ Password Successfully Changed - TalentConnect',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
              line-height: 1.6; 
              color: #333; 
              margin: 0; 
              padding: 0; 
              background-color: #f5f5f5; 
            }
            .container { 
              max-width: 600px; 
              margin: 20px auto; 
              background: white; 
              border-radius: 16px; 
              overflow: hidden; 
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
            }
            .header { 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
              color: white; 
              text-align: center; 
              padding: 40px 24px; 
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .success-icon {
              background: rgba(255, 255, 255, 0.2);
              width: 80px;
              height: 80px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              margin: 0 auto 20px;
              font-size: 48px;
            }
            .content { 
              padding: 40px 32px; 
            }
            .info-box {
              background: #f0fdf4;
              border-left: 4px solid #10b981;
              padding: 20px;
              border-radius: 8px;
              margin: 24px 0;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #d1fae5;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #065f46;
            }
            .info-value {
              color: #047857;
            }
            .button { 
              display: inline-block; 
              background: linear-gradient(135deg, #10b981 0%, #059669 100%);
              color: white; 
              padding: 14px 32px; 
              text-decoration: none; 
              border-radius: 8px; 
              margin: 24px 0;
              font-weight: 600;
              box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
            }
            .warning { 
              background: #fef3c7; 
              border-left: 4px solid #f59e0b;
              padding: 20px; 
              border-radius: 8px; 
              margin: 24px 0; 
            }
            .warning-title {
              color: #92400e;
              font-weight: 700;
              margin-bottom: 12px;
              font-size: 16px;
            }
            .security-tips {
              background: #f8f9fa;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
            }
            .tip {
              display: flex;
              align-items: flex-start;
              margin: 12px 0;
            }
            .tip-icon {
              color: #10b981;
              margin-right: 12px;
              font-size: 20px;
              flex-shrink: 0;
            }
            .footer { 
              background: #f8f9fa; 
              padding: 24px; 
              text-align: center; 
              border-top: 1px solid #e9ecef; 
              font-size: 13px; 
              color: #6c757d; 
            }
            .footer-links {
              margin-top: 16px;
            }
            .footer-links a {
              color: #10b981;
              text-decoration: none;
              margin: 0 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="success-icon">✅</div>
              <h1>Password Successfully Changed</h1>
              <p style="margin: 8px 0 0 0; opacity: 0.95;">Your account is now secure with your new password</p>
            </div>
            
            <div class="content">
              <h2 style="color: #333; margin-top: 0;">Hello ${user.firstName || 'User'}!</h2>
              
              <p style="font-size: 16px; color: #555;">
                This email confirms that your TalentConnect account password has been successfully changed.
              </p>

              <div class="info-box">
                <h3 style="margin-top: 0; color: #065f46;">Change Details</h3>
                <div class="info-row">
                  <span class="info-label">Account Email:</span>
                  <span class="info-value">${user.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Changed On:</span>
                  <span class="info-value">${changeDate}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Status:</span>
                  <span class="info-value">✅ Confirmed</span>
                </div>
              </div>

              <div style="text-align: center; margin: 32px 0;">
                <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
                  <strong>Ready to sign in with your new password?</strong>
                </p>
                <a href="${loginUrl}" class="button">Login to Your Account</a>
              </div>

              <div class="security-tips">
                <h3 style="margin-top: 0; color: #333;">🔒 Security Best Practices</h3>
                <div class="tip">
                  <span class="tip-icon">✓</span>
                  <span>Use a unique password for TalentConnect</span>
                </div>
                <div class="tip">
                  <span class="tip-icon">✓</span>
                  <span>Never share your password with anyone</span>
                </div>
                <div class="tip">
                  <span class="tip-icon">✓</span>
                  <span>Enable two-factor authentication if available</span>
                </div>
                <div class="tip">
                  <span class="tip-icon">✓</span>
                  <span>Change your password regularly</span>
                </div>
              </div>
              
              <div class="warning">
                <div class="warning-title">⚠️ Didn't Change Your Password?</div>
                <p style="margin: 8px 0; color: #92400e;">
                  If you did not make this change, your account may have been compromised. 
                  <strong>Please contact our security team immediately</strong> and consider:
                </p>
                <ul style="margin: 12px 0; padding-left: 20px; color: #92400e;">
                  <li>Contacting support at <a href="mailto:${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}" style="color: #92400e; font-weight: 600;">support@talentconnect.com</a></li>
                  <li>Reviewing your recent account activity</li>
                  <li>Checking your email account security</li>
                </ul>
              </div>
              
              <p style="margin-top: 32px; color: #333;">
                Best regards,<br>
                <strong>The TalentConnect Security Team</strong>
              </p>
            </div>
            
            <div class="footer">
              <p style="margin: 0;"><strong>TalentConnect</strong></p>
              <p style="margin: 8px 0;">© ${new Date().getFullYear()} TalentConnect. All rights reserved.</p>
              <p style="margin: 8px 0;">This notification was sent to <strong>${user.email}</strong></p>
              <div class="footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Security Center</a>
                <a href="#">Contact Support</a>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Successfully Changed - TalentConnect
        
        Hello ${user.firstName || 'User'},
        
        This email confirms that your TalentConnect account password has been successfully changed.
        
        CHANGE DETAILS:
        - Account Email: ${user.email}
        - Changed On: ${changeDate}
        - Status: Confirmed
        
        You can now sign in with your new password at: ${loginUrl}
        
        SECURITY BEST PRACTICES:
        ✓ Use a unique password for TalentConnect
        ✓ Never share your password with anyone
        ✓ Enable two-factor authentication if available
        ✓ Change your password regularly
        
        DIDN'T CHANGE YOUR PASSWORD?
        If you did not make this change, your account may have been compromised.
        Please contact our security team immediately at: ${process.env.SUPPORT_EMAIL || process.env.EMAIL_USER}
        
        Best regards,
        The TalentConnect Security Team
        
        © ${new Date().getFullYear()} TalentConnect. All rights reserved.
      `
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Password change confirmation email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send password change confirmation:', error.message);
    return { success: false, error: error.message };
  }
};


// Send contact email from recruiter to candidate
const sendContactEmail = async (candidate, emailData) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping contact email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { subject, message, senderInfo } = emailData;
    
    // Create professional email template
    const emailTemplate = getContactEmailTemplate(candidate, subject, message, senderInfo);
    
    const mailOptions = {
      from: {
        name: senderInfo.name || 'TalentConnect Recruiter',
        address: process.env.EMAIL_USER
      },
      to: candidate.email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      replyTo: senderInfo.email || process.env.EMAIL_USER
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Contact email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send contact email:', error.message);
    return { success: false, error: error.message };
  }
};

// Contact email template
const getContactEmailTemplate = (candidate, subject, message, senderInfo) => {
  const candidateName = `${candidate.firstName} ${candidate.lastName}`;
  
  return {
    subject: subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 24px; 
            text-align: center; 
          }
          .content { 
            padding: 32px; 
          }
          .candidate-info { 
            background: #f8f9fa; 
            padding: 16px; 
            border-radius: 8px; 
            margin-bottom: 24px; 
            border-left: 4px solid #667eea; 
          }
          .message-content { 
            background: white; 
            padding: 24px; 
            border: 1px solid #e9ecef; 
            border-radius: 8px; 
            margin: 24px 0; 
            white-space: pre-wrap; 
            font-family: Georgia, serif; 
            line-height: 1.7; 
          }
          .footer { 
            background: #f8f9fa; 
            padding: 24px; 
            text-align: center; 
            border-top: 1px solid #e9ecef; 
            font-size: 14px; 
            color: #666; 
          }
          .cta-button { 
            display: inline-block; 
            background: #28a745; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 16px 0; 
          }
          .warning { 
            background: #fff3cd; 
            border: 1px solid #ffeaa7; 
            padding: 12px; 
            border-radius: 6px; 
            margin: 16px 0; 
            font-size: 14px; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💼 New Opportunity</h1>
            <p>Message via TalentConnect</p>
          </div>
          
          <div class="content">
            <div class="candidate-info">
              <h3>Hello ${candidateName}!</h3>
              <p>A recruiter found your profile on TalentConnect and wants to connect with you regarding a potential opportunity.</p>
              <p><strong>Your Profile:</strong> ${candidate.title || 'Professional'}</p>
            </div>
            
            <div class="message-content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            <div style="text-align: center;">
              <p><strong>Interested in this opportunity?</strong></p>
              <a href="mailto:${senderInfo.email || process.env.EMAIL_USER}?subject=Re: ${encodeURIComponent(subject)}" class="cta-button">
                Reply to Recruiter
              </a>
            </div>
            
            <div class="warning">
              <strong>🛡️ Safety Reminder:</strong>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>This message was sent through TalentConnect</li>
                <li>Always verify company details before sharing personal information</li>
                <li>Be cautious of requests for immediate payments or personal documents</li>
                <li>If this seems suspicious, please report it to our support team</li>
              </ul>
            </div>
            
            <p style="margin-top: 24px;">
              <strong>From:</strong> ${senderInfo.name || 'TalentConnect Recruiter'}<br>
              <strong>Sent via:</strong> TalentConnect Platform<br>
              <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>TalentConnect</strong> - Connecting Talent with Opportunity</p>
            <p>© 2024 TalentConnect. All rights reserved.</p>
            <p style="margin-top: 16px;">
              This email was sent to <strong>${candidate.email}</strong><br>
              <a href="#" style="color: #666;">Unsubscribe</a> | 
              <a href="#" style="color: #666;">Report Spam</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      New Opportunity - TalentConnect
      
      Hello ${candidateName}!
      
      A recruiter found your profile on TalentConnect and wants to connect with you regarding a potential opportunity.
      
      Your Profile: ${candidate.title || 'Professional'}
      
      MESSAGE:
      ${message}
      
      From: ${senderInfo.name || 'TalentConnect Recruiter'}
      Date: ${new Date().toLocaleDateString()}
      
      To reply, send an email to: ${senderInfo.email || process.env.EMAIL_USER}
      Subject: Re: ${subject}
      
      SAFETY REMINDER:
      - This message was sent through TalentConnect
      - Always verify company details before sharing personal information
      - Be cautious of requests for payments or personal documents
      
      Best regards,
      TalentConnect Team
      
      ---
      This email was sent to ${candidate.email}
      © 2024 TalentConnect. All rights reserved.
    `
  };
};


// Equipment listing confirmation email template
const getEquipmentListingWelcomeTemplate = (equipmentData) => {
  return {
    subject: '🎉 Equipment Successfully Listed - TalentConnect',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); 
          }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
            color: white; 
            text-align: center; 
            padding: 40px 24px; 
          }
          .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 700;
          }
          .success-icon {
            background: rgba(255, 255, 255, 0.2);
            width: 80px;
            height: 80px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 48px;
          }
          .content { 
            padding: 40px 32px; 
          }
          .equipment-card {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border-left: 4px solid #10b981;
            padding: 24px;
            border-radius: 12px;
            margin: 24px 0;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.1);
          }
          .equipment-card h3 {
            color: #065f46;
            margin-top: 0;
            font-size: 20px;
          }
          .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 10px 0;
            border-bottom: 1px solid #d1fae5;
          }
          .detail-row:last-child {
            border-bottom: none;
          }
          .detail-label {
            font-weight: 600;
            color: #065f46;
          }
          .detail-value {
            color: #047857;
            text-align: right;
          }
          .status-badge {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .feature-box {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
          }
          .feature {
            display: flex;
            align-items: flex-start;
            margin: 12px 0;
          }
          .feature-icon {
            color: #10b981;
            margin-right: 12px;
            font-size: 20px;
            flex-shrink: 0;
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white; 
            padding: 14px 32px; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 24px 0;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
          }
          .tips-section {
            background: #fff7ed;
            border-left: 4px solid #f59e0b;
            padding: 20px;
            border-radius: 8px;
            margin: 24px 0;
          }
          .tips-section h3 {
            color: #92400e;
            margin-top: 0;
          }
          .tip {
            display: flex;
            align-items: flex-start;
            margin: 10px 0;
            color: #78350f;
          }
          .tip-number {
            background: #fbbf24;
            color: white;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            font-size: 12px;
            margin-right: 12px;
            flex-shrink: 0;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 24px; 
            text-align: center; 
            border-top: 1px solid #e9ecef; 
            font-size: 13px; 
            color: #6c757d; 
          }
          .footer-links {
            margin-top: 16px;
          }
          .footer-links a {
            color: #10b981;
            text-decoration: none;
            margin: 0 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="success-icon">🎉</div>
            <h1>Equipment Successfully Listed!</h1>
            <p style="margin: 8px 0 0 0; opacity: 0.95;">Your equipment is now live and visible to potential renters</p>
          </div>
          
          <div class="content">
            <h2 style="color: #333; margin-top: 0;">Hello ${equipmentData.contactPerson}!</h2>
            
            <p style="font-size: 16px; color: #555;">
              Great news! Your equipment listing has been successfully created and is now live on TalentConnect. 
              Renters can now discover and inquire about your equipment.
            </p>

            <div class="equipment-card">
              <h3>📦 ${equipmentData.equipmentName}</h3>
              <div class="detail-row">
                <span class="detail-label">Equipment Type:</span>
                <span class="detail-value">${equipmentData.equipmentType}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${equipmentData.location || 'Not specified'}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Contact Person:</span>
                <span class="detail-value">${equipmentData.contactPerson}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Contact Number:</span>
                <span class="detail-value">${equipmentData.contactNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Contact Email:</span>
                <span class="detail-value">${equipmentData.contactEmail}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Status:</span>
                <span class="detail-value">
                  <span class="status-badge">${equipmentData.availability === 'available' ? '✓ Available' : 'On-Hire'}</span>
                </span>
              </div>
              ${equipmentData.equipmentConditionFiles && equipmentData.equipmentConditionFiles.length > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Documents:</span>
                <span class="detail-value">${equipmentData.equipmentConditionFiles.length} file(s) uploaded</span>
              </div>
              ` : ''}
            </div>

            <div class="feature-box">
              <h3 style="margin-top: 0; color: #333;">🚀 What Happens Next?</h3>
              <div class="feature">
                <span class="feature-icon">📧</span>
                <span>You'll receive email notifications when someone inquires about your equipment</span>
              </div>
              <div class="feature">
                <span class="feature-icon">💬</span>
                <span>Respond quickly to inquiries to increase your booking chances</span>
              </div>
              <div class="feature">
                <span class="feature-icon">📊</span>
                <span>Track your listing performance through your dashboard</span>
              </div>
              <div class="feature">
                <span class="feature-icon">✏️</span>
                <span>Update your listing anytime to keep information current</span>
              </div>
            </div>

            <div class="tips-section">
              <h3>💡 Tips for Successful Equipment Rentals</h3>
              <div class="tip">
                <span class="tip-number">1</span>
                <span><strong>Respond Fast:</strong> Quick responses to inquiries increase booking rates by up to 80%</span>
              </div>
              <div class="tip">
                <span class="tip-number">2</span>
                <span><strong>Clear Photos:</strong> Add high-quality photos showing equipment condition</span>
              </div>
              <div class="tip">
                <span class="tip-number">3</span>
                <span><strong>Accurate Details:</strong> Provide complete specifications and rental terms</span>
              </div>
              <div class="tip">
                <span class="tip-number">4</span>
                <span><strong>Regular Updates:</strong> Keep availability status current to avoid confusion</span>
              </div>
              <div class="tip">
                <span class="tip-number">5</span>
                <span><strong>Professional Service:</strong> Maintain equipment well and provide excellent service</span>
              </div>
            </div>

            <div style="text-align: center; margin: 32px 0;">
              <p style="font-size: 16px; color: #333; margin-bottom: 16px;">
                <strong>Ready to manage your listing?</strong>
              </p>
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard" class="button">
                View Your Dashboard
              </a>
            </div>

            <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6;">
              <h4 style="margin-top: 0; color: #1e40af;">📞 Need Help?</h4>
              <p style="margin: 8px 0; color: #1e3a8a;">
                If you have any questions or need assistance with your listing, our support team is here to help:
              </p>
              <ul style="margin: 8px 0; padding-left: 20px; color: #1e3a8a;">
                <li>Email: support@talentconnect.com</li>
                <li>Check our <a href="#" style="color: #3b82f6;">Equipment Listing Guide</a></li>
                <li>Browse <a href="#" style="color: #3b82f6;">Frequently Asked Questions</a></li>
              </ul>
            </div>
            
            <p style="margin-top: 32px; color: #333;">
              Thank you for choosing TalentConnect for your equipment rental needs!<br><br>
              Best regards,<br>
              <strong>The TalentConnect Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p style="margin: 0;"><strong>TalentConnect</strong></p>
            <p style="margin: 8px 0;">© ${new Date().getFullYear()} TalentConnect. All rights reserved.</p>
            <p style="margin: 8px 0;">Listing created on: ${new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <div class="footer-links">
              <a href="#">Manage Listing</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Contact Support</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Equipment Successfully Listed - TalentConnect
      
      Hello ${equipmentData.contactPerson}!
      
      Great news! Your equipment listing has been successfully created and is now live on TalentConnect.
      
      EQUIPMENT DETAILS:
      - Name: ${equipmentData.equipmentName}
      - Type: ${equipmentData.equipmentType}
      - Location: ${equipmentData.location || 'Not specified'}
      - Contact Person: ${equipmentData.contactPerson}
      - Contact Number: ${equipmentData.contactNumber}
      - Contact Email: ${equipmentData.contactEmail}
      - Status: ${equipmentData.availability === 'available' ? 'Available' : 'On-Hire'}
      ${equipmentData.equipmentConditionFiles && equipmentData.equipmentConditionFiles.length > 0 ? `- Documents: ${equipmentData.equipmentConditionFiles.length} file(s) uploaded` : ''}
      
      WHAT HAPPENS NEXT:
      ✓ You'll receive email notifications when someone inquires about your equipment
      ✓ Respond quickly to inquiries to increase your booking chances
      ✓ Track your listing performance through your dashboard
      ✓ Update your listing anytime to keep information current
      
      TIPS FOR SUCCESS:
      1. Respond Fast - Quick responses increase booking rates by up to 80%
      2. Clear Photos - Add high-quality photos showing equipment condition
      3. Accurate Details - Provide complete specifications and rental terms
      4. Regular Updates - Keep availability status current
      5. Professional Service - Maintain equipment well and provide excellent service
      
      Manage your listing at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard
      
      Need help? Contact us at: support@talentconnect.com
      
      Thank you for choosing TalentConnect!
      
      Best regards,
      The TalentConnect Team
      
      ---
      Listing created on: ${new Date().toLocaleDateString()}
      © ${new Date().getFullYear()} TalentConnect. All rights reserved.
    `
  };
};

// Send equipment listing confirmation email
const sendEquipmentListingEmail = async (equipmentData) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping equipment listing confirmation');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const emailTemplate = getEquipmentListingWelcomeTemplate(equipmentData);
    
    const mailOptions = {
      from: {
        name: 'TalentConnect',
        address: process.env.EMAIL_USER
      },
      to: equipmentData.contactEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Equipment listing confirmation email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send equipment listing confirmation:', error.message);
    return { success: false, error: error.message };
  }
};

// Send equipment inquiry email to equipment owner
const sendEquipmentInquiryEmail = async (equipmentData, inquiryData) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping equipment inquiry email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const { name, email, phone, message } = inquiryData;
    const equipmentName = equipmentData.name;
    const equipmentPrice = equipmentData.price;
    const equipmentLocation = equipmentData.location;
    const ownerEmail = equipmentData.email || equipmentData.ownerEmail;
    
    if (!ownerEmail) {
      throw new Error('Equipment owner email not found');
    }
    
    // Create professional email template
    const emailTemplate = getEquipmentInquiryTemplate(equipmentData, inquiryData);
    
    const mailOptions = {
      from: {
        name: 'Equipment Hire Platform',
        address: process.env.EMAIL_USER
      },
      to: ownerEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      replyTo: email // So the owner can reply directly to the inquirer
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log('✅ Equipment inquiry email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
    
  } catch (error) {
    console.error('❌ Failed to send equipment inquiry email:', error.message);
    return { success: false, error: error.message };
  }
};

// Equipment inquiry email template
const getEquipmentInquiryTemplate = (equipmentData, inquiryData) => {
  const { name, email, phone, message } = inquiryData;
  const equipmentName = equipmentData.name;
  const equipmentPrice = equipmentData.price;
  const equipmentLocation = equipmentData.location;
  const ownerName = equipmentData.owner || equipmentData.ownerName || 'Equipment Owner';
  
  return {
    subject: `Rental Inquiry: ${equipmentName} - from ${name}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5; 
          }
          .container { 
            max-width: 600px; 
            margin: 20px auto; 
            background: white; 
            border-radius: 12px; 
            overflow: hidden; 
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
          }
          .header { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
            color: white; 
            padding: 24px; 
            text-align: center; 
          }
          .content { 
            padding: 32px; 
          }
          .equipment-info { 
            background: #f0fdf4; 
            padding: 20px; 
            border-radius: 8px; 
            margin-bottom: 24px; 
            border-left: 4px solid #10b981; 
          }
          .inquirer-info { 
            background: #fafafa; 
            padding: 16px; 
            border-radius: 8px; 
            margin-bottom: 20px; 
          }
          .message-content { 
            background: white; 
            padding: 24px; 
            border: 1px solid #e5e7eb; 
            border-radius: 8px; 
            margin: 20px 0; 
            white-space: pre-wrap; 
            line-height: 1.7; 
            font-style: italic;
          }
          .cta-section { 
            text-align: center; 
            margin: 30px 0; 
            padding: 20px; 
            background: #f9fafb; 
            border-radius: 8px; 
          }
          .cta-button { 
            display: inline-block; 
            background: #10b981; 
            color: white; 
            padding: 12px 24px; 
            text-decoration: none; 
            border-radius: 6px; 
            font-weight: bold; 
            margin: 8px; 
          }
          .contact-info { 
            background: #eff6ff; 
            padding: 16px; 
            border-radius: 8px; 
            margin: 20px 0; 
          }
          .footer { 
            background: #f9fafb; 
            padding: 20px; 
            text-align: center; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            color: #6b7280; 
          }
          .highlight { 
            color: #10b981; 
            font-weight: 600; 
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🛠️ Equipment Rental Inquiry</h1>
            <p>Someone is interested in your equipment!</p>
          </div>
          
          <div class="content">
            <h2>Hello ${ownerName}!</h2>
            <p>You have received a new rental inquiry for your equipment listed on the platform.</p>
            
            <div class="equipment-info">
              <h3>📦 Equipment Details</h3>
              <p><strong>Name:</strong> ${equipmentName}</p>
              <p><strong>Price:</strong> <span class="highlight">${equipmentPrice}</span></p>
              <p><strong>Location:</strong> ${equipmentLocation}</p>
            </div>
            
            <div class="inquirer-info">
              <h3>👤 Inquiry From</h3>
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
            </div>
            
            <h3>💬 Message from ${name}:</h3>
            <div class="message-content">
              ${message.replace(/\n/g, '<br>')}
            </div>
            
            <div class="cta-section">
              <h3>Ready to respond?</h3>
              <p>Contact ${name} directly using the information below:</p>
              
              <a href="mailto:${email}?subject=Re: ${encodeURIComponent(equipmentName)} Rental&body=Hi ${encodeURIComponent(name)},%0D%0A%0D%0AThank you for your interest in my ${encodeURIComponent(equipmentName)}.%0D%0A%0D%0A" class="cta-button">
                📧 Reply via Email
              </a>
              
              ${phone ? `
                <a href="tel:${phone}" class="cta-button">
                  📞 Call ${name}
                </a>
              ` : ''}
            </div>
            
            <div class="contact-info">
              <h4>🔄 Quick Response Tips:</h4>
              <ul style="margin: 8px 0; padding-left: 20px;">
                <li>Respond quickly to increase booking chances</li>
                <li>Confirm availability dates and pickup/delivery details</li>
                <li>Share any additional requirements or terms</li>
                <li>Consider offering to show the equipment before rental</li>
              </ul>
            </div>
            
            <p style="margin-top: 24px; font-size: 14px; color: #6b7280;">
              <strong>Inquiry received on:</strong> ${new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Equipment Hire Platform</strong> - Connecting Equipment Owners with Renters</p>
            <p>© 2024 Equipment Hire Platform. All rights reserved.</p>
            <p style="margin-top: 12px;">
              This inquiry was sent to your listed email address.<br>
              If you no longer wish to receive rental inquiries, please update your equipment listing.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Equipment Rental Inquiry
      
      Hello ${ownerName}!
      
      You have received a new rental inquiry for your equipment.
      
      EQUIPMENT DETAILS:
      Name: ${equipmentName}
      Price: ${equipmentPrice}
      Location: ${equipmentLocation}
      
      INQUIRY FROM:
      Name: ${name}
      Email: ${email}
      ${phone ? `Phone: ${phone}` : ''}
      
      MESSAGE:
      ${message}
      
      TO RESPOND:
      Reply to this email or contact ${name} directly at:
      Email: ${email}
      ${phone ? `Phone: ${phone}` : ''}
      
      QUICK RESPONSE TIPS:
      - Respond quickly to increase booking chances
      - Confirm availability dates and pickup/delivery details
      - Share any additional requirements or terms
      - Consider offering to show the equipment before rental
      
      Inquiry received on: ${new Date().toLocaleDateString()}
      
      Best regards,
      Equipment Hire Platform Team
      
      ---
      © 2024 Equipment Hire Platform. All rights reserved.
    `
  };
};


module.exports = {
  verifyEmailConfig,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordChangeConfirmation,
  transporter,
  sendContactEmail,
  sendEquipmentListingEmail,
  sendEquipmentInquiryEmail
};