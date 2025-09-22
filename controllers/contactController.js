const { sendContactEmail } = require("../services/emailService");
const { db } = require("../config/db");

exports.sendEmailToCandidate = async (req, res) => {
  try {
    const { candidateId, subject, message } = req.body;

    // Validation
    if (!candidateId || !subject?.trim() || !message?.trim()) {
      return res.status(400).json({
        success: false,
        msg: "Candidate ID, subject, and message are required",
      });
    }

    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        msg: "Subject must be less than 200 characters",
      });
    }

    if (message.length < 10 || message.length > 5000) {
      return res.status(400).json({
        success: false,
        msg: "Message must be between 10 and 5000 characters",
      });
    }

    // Fetch candidate details
    const getCandidateQuery = `
      SELECT 
        u.id,
        u.firstName,
        u.lastName,
        u.email,
        js.title
      FROM users u
      LEFT JOIN job_seekers js ON u.id = js.userId
      WHERE u.id = ? AND u.userType = 'jobseeker'
    `;

    db.query(getCandidateQuery, [candidateId], async (err, candidates) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          success: false,
          msg: "Database error occurred",
        });
      }

      if (candidates.length === 0) {
        return res.status(404).json({
          success: false,
          msg: "Candidate not found",
        });
      }

      const candidate = candidates[0];
      const senderInfo = {
        name: "TalentConnect Recruiter",
        email: process.env.EMAIL_USER,
      };

      try {
        const result = await sendContactEmail(candidate, {
          subject: subject.trim(),
          message: message.trim(),
          senderInfo,
        });

        if (result.success) {
          // Log contact attempt
          const logQuery = `
            INSERT INTO contact_logs (candidate_id, subject, message, sent_at, status)
            VALUES (?, ?, ?, NOW(), 'sent')
          `;

          db.query(
            logQuery,
            [candidateId, subject.trim(), message.trim()],
            (logErr) => {
              if (logErr) {
                console.warn("Failed to log contact attempt:", logErr);
              }
            }
          );

          res.json({
            success: true,
            msg: "Email sent successfully",
            messageId: result.messageId,
          });
        } else {
          res.status(500).json({
            success: false,
            msg: result.error || "Failed to send email",
          });
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        res.status(500).json({
          success: false,
          msg: "Failed to send email. Please try again.",
        });
      }
    });
  } catch (error) {
    console.error("Contact email endpoint error:", error);
    res.status(500).json({
      success: false,
      msg: "Server error while sending email",
    });
  }
};

// ✅ Keep table creation here
exports.createContactLogsTable = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS contact_logs (
      id INT PRIMARY KEY AUTO_INCREMENT,
      candidate_id INT NOT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status ENUM('sent', 'failed') DEFAULT 'sent',
      FOREIGN KEY (candidate_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_candidate_sent (candidate_id, sent_at)
    )
  `;

  db.query(createTableQuery, (err) => {
    if (err) {
      console.error("Error creating contact_logs table:", err);
    } else {
      console.log("✅ Contact logs table ready");
    }
  });
};
