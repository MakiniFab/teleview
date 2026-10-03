import React, { useState } from "react";
import "./ContactPage.css";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    topic: "general",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Logic for form submission / API endpoint goes here
    setSubmitted(true);
  };

  return (
    <div className="contacts-container">
      {/* Hero Header */}
      <header className="contacts-header">
        <span className="badge-pill">24/7 Support & Community</span>
        <h1>How Can We Help You?</h1>
        <p>
          Need help with bot setup, deposits, withdrawals, market analysis, or
          general inquiries? Reach out to us directly or join our community.
        </p>
      </header>

      {/* Direct Contact Cards */}
      <div className="quick-contact-grid">
        <div className="contact-card">
          <div className="card-icon">💬</div>
          <h3>Telegram Support</h3>
          <p>Instant answers for deposits, bot setup & trading signals.</p>
          <a
            href="https://t.me/your_telegram_handle"
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn telegram-btn"
          >
            Chat on Telegram
          </a>
        </div>

        <div className="contact-card">
          <div className="card-icon">📱</div>
          <h3>WhatsApp Help Desk</h3>
          <p>Direct assistance for account configuration and funding.</p>
          <a
            href="https://wa.me/your_whatsapp_number"
            target="_blank"
            rel="noopener noreferrer"
            className="action-btn whatsapp-btn"
          >
            Message on WhatsApp
          </a>
        </div>

        <div className="contact-card">
          <div className="card-icon">✉️</div>
          <h3>Email Support</h3>
          <p>Detailed technical queries and account assistance.</p>
          <a href="mailto:support@yourdomain.com" className="action-btn email-btn">
            Send an Email
          </a>
        </div>
      </div>

      {/* Video Tutorials & Social Section */}
      <div className="social-tutorials-box">
        <h3>🎥 Watch Video Tutorials & Setup Guides</h3>
        <p>Join our friendly trading community for quick video demos, bot setup guides, and tips:</p>
        <div className="social-links-grid">
          <a
            href="https://www.tiktok.com/@olinoh?lang=en"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="TikTok Tutorials"
          >
            <img src="/tiktok.png" alt="TikTok" className="social-icon" />
          </a>
          <a
            href="https://www.youtube.com/@olinoh"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="YouTube Demos"
          >
            <img src="/youtube.png" alt="YouTube" className="social-icon" />
          </a>
          <a
            href="https://www.instagram.com/@olinoh"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="Instagram Updates"
          >
            <img src="/insta.jfif" alt="Instagram" className="social-icon" />
          </a>
          <a
            href="https://x.com/@olinoh"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="X (Twitter) Announcements"
          >
            <img src="/x.png" alt="X (Twitter)" className="social-icon" />
          </a>
          <a
            href="https://t.me/olinoh"
            target="_blank"
            rel="noopener noreferrer"
            className="social-link"
            title="Telegram Channel"
          >
            <img src="/telegram.png" alt="Telegram" className="social-icon" />
          </a>
        </div>
      </div>

      {/* Interactive Form & FAQ Grid */}
      <div className="form-faq-section">
        {/* Quick Assistance Checklist */}
        <div className="support-info-box">
          <h2>Popular Help Topics</h2>
          <ul className="info-list">
            <li>
              <strong>⚙️ Bot Setup:</strong> Need assistance configuring Aegis, Nexus, or QuantumSpikePro? Check our video guides or contact support.
            </li>
            <li>
              <strong>💳 Deposits & Withdrawals:</strong> Get help funding your Deriv account via M-Pesa, Agent, Card, or Crypto.
            </li>
            <li>
              <strong>📊 Market Selection:</strong> Learn which Synthetic Index markets suit active strategies best during peak hours.
            </li>
            <li>
              <strong>🛡️ Risk Management:</strong> Guidelines on optimizing Base Stake, Profit Ratio, and Stop Loss settings.
            </li>
          </ul>
        </div>
      </div>

      {/* Section Caption Banner */}
      <section className="section-caption-wrapper">
        <div className="section-caption-box">
          <p className="quote-caption">
            "Set your bot before breakfast. Check your results after dinner."
          </p>
        </div>
      </section>
    </div>
  );
}