// Add this route
   app.get('/api/test-email', async (req, res) => {
     const nodemailer = require('nodemailer');
     
     const log = [];
     const logger = (msg) => {
       console.log(msg);
       log.push(msg);
     };
     
     try {
       logger('🔍 Testing email configuration...');
       
       // Check env variables
       logger(`✓ EMAIL_HOST: ${process.env.EMAIL_HOST}`);
       logger(`✓ EMAIL_PORT: ${process.env.EMAIL_PORT}`);
       logger(`✓ EMAIL_USER: ${process.env.EMAIL_USER}`);
       logger(`✓ EMAIL_PASS: ${process.env.EMAIL_PASS ? '***' + process.env.EMAIL_PASS.slice(-4) : 'NOT SET'}`);
       
       // Create transporter
       const transporter = nodemailer.createTransport({
         host: process.env.EMAIL_HOST,
         port: parseInt(process.env.EMAIL_PORT),
         secure: process.env.EMAIL_SECURE === 'true',
         auth: {
           user: process.env.EMAIL_USER,
           pass: process.env.EMAIL_PASS
         },
         tls: {
           rejectUnauthorized: false
         }
       });
       
       // Verify connection
       logger('🔄 Verifying SMTP connection...');
       await transporter.verify();
       logger('✅ SMTP connection verified!');
       
       // Send test email
       logger('📧 Sending test email...');
       const result = await transporter.sendMail({
         from: process.env.EMAIL_USER,
         to: process.env.EMAIL_USER,
         subject: `Test Email - ${new Date().toISOString()}`,
         text: `This is a test email sent from production at ${new Date().toLocaleString()}`
       });
       
       logger(`✅ Email sent! Message ID: ${result.messageId}`);
       
       res.json({
         success: true,
         message: 'Email sent successfully!',
         messageId: result.messageId,
         log: log
       });
       
     } catch (error) {
       logger(`❌ Error: ${error.message}`);
       logger(`❌ Code: ${error.code}`);
       
       res.status(500).json({
         success: false,
         error: error.message,
         code: error.code,
         log: log
       });
     }
   });