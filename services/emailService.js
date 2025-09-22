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
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Add security options
      secure: false,
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

// Welcome email template for recruiters
const getRecruiterWelcomeTemplate = (userData, companyName) => {
  return {
    subject: 'Welcome to TalentConnect! Start Finding Great Talent',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #9c27b0 0%, #673ab7 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #9c27b0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .feature { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #9c27b0; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 Welcome to TalentConnect!</h1>
            <p>Your talent acquisition journey begins</p>
          </div>
          
          <div class="content">
            <h2>Hello ${userData.firstName}!</h2>
            
            <p>Welcome to TalentConnect! Your recruiter account for <strong>${companyName}</strong> has been successfully created.</p>
            
            <div class="feature">
              <h3>🏢 Your Company Profile</h3>
              <p><strong>Company:</strong> ${companyName}<br>
                 <strong>Contact:</strong> ${userData.firstName} ${userData.lastName}<br>
                 <strong>Email:</strong> ${userData.email}</p>
            </div>
            
            <div class="feature">
              <h3>🔍 Recruiter Toolkit</h3>
              <ul>
                <li><strong>Smart Search:</strong> Find candidates by title, location, and skills</li>
                <li><strong>AI Skill Matcher:</strong> Match job requirements with candidate skills</li>
                <li><strong>Advanced Filters:</strong> Filter by experience, availability, and salary</li>
                <li><strong>Direct Contact:</strong> Connect with candidates instantly</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" class="button">
                Access Recruiter Dashboard
              </a>
            </div>
            
            <p>Start exploring our talent pool and find the perfect candidates for your projects!</p>
            
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
      Welcome to TalentConnect!
      
      Your recruiter account for ${companyName} has been successfully created.
      
      Account Details:
      - Company: ${companyName}
      - Contact: ${userData.firstName} ${userData.lastName}
      - Email: ${userData.email}
      
      Recruiter Toolkit Features:
      - Smart Search for candidates
      - AI Skill Matcher
      - Advanced Filters
      - Direct Contact with candidates
      
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

// FIXED: Send password reset email - now accepts user object and resetToken
const sendPasswordResetEmail = async (user, resetToken) => {
  if (!transporter) {
    console.log('⚠️ Email service unavailable - skipping password reset email');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const mailOptions = {
      from: {
        name: 'TalentConnect',
        address: process.env.EMAIL_USER
      },
      to: user.email,
      subject: 'Reset Your TalentConnect Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f44336 0%, #e91e63 100%); color: white; text-align: center; padding: 30px; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔒 Password Reset Request</h1>
              <p>Secure your TalentConnect account</p>
            </div>
            
            <div class="content">
              <h2>Hello ${user.firstName}!</h2>
              
              <p>You requested a password reset for your TalentConnect account (<strong>${user.email}</strong>).</p>
              
              <p>Click the button below to create a new password:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset My Password</a>
              </div>
              
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; background: #f0f0f0; padding: 10px; border-radius: 4px;">
                ${resetUrl}
              </p>
              
              <div class="warning">
                <strong>⚠️ Important Security Information:</strong>
                <ul>
                  <li>This link will expire in 1 hour for security</li>
                  <li>You can only use this link once</li>
                  <li>If you didn't request this reset, please ignore this email</li>
                  <li>Your current password remains active until you create a new one</li>
                </ul>
              </div>
              
              <p>If you have any concerns about your account security, please contact our support team immediately.</p>
              
              <p>Best regards,<br>The TalentConnect Security Team</p>
            </div>
            
            <div class="footer">
              <p>© 2024 TalentConnect. All rights reserved.</p>
              <p>This email was sent to ${user.email}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Password Reset Request - TalentConnect
        
        Hello ${user.firstName},
        
        You requested a password reset for your TalentConnect account (${user.email}).
        
        Click this link to reset your password: ${resetUrl}
        
        IMPORTANT:
        - This link expires in 1 hour
        - You can only use this link once
        - If you didn't request this reset, ignore this email
        
        Best regards,
        The TalentConnect Security Team
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

// Add this function to your existing emailService.js file

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


module.exports = {
  verifyEmailConfig,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  transporter,
  sendContactEmail
};