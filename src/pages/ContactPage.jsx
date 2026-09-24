import React, { useState } from "react";
import "./ContactPage.css";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulate form submission
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setFormData({ name: "", email: "", subject: "", message: "" });
    }, 1000);
  };

  return (
    <div className="contact-container">
      <div className="contact-wrapper">
        {/* Header Section */}
        <header className="contact-header">
          <span className="brand-badge">A Division of Fab Software Solutions — Mombasa</span>
          <h2>Contact Us</h2>
          <p className="subtitle">
            Have questions regarding our trading bots or platform integrations? Reach out to our technical team in Mombasa for direct support.
          </p>
        </header>

        {/* Info & Form Grid Layout */}
        <div className="contact-content">
          {/* Company Contact Details */}
          <div className="info-cards-grid">
            <div className="info-card">
              <div className="info-icon">🏢</div>
              <div className="info-details">
                <span className="info-label">Parent Company</span>
                <span className="info-value">Fab Software Solutions</span>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">📍</div>
              <div className="info-details">
                <span className="info-label">Head Office</span>
                <span className="info-value">Mombasa, Kenya</span>
              </div>
            </div>

            <a href="mailto:info@fabsoftwaresolutions.example.com" className="info-card link-card">
              <div className="info-icon">✉️</div>
              <div className="info-details">
                <span className="info-label">Email Us</span>
                <span className="info-value">info@fabsoftwaresolutions.com</span>
              </div>
            </a>

            <a href="tel:+254700000000" className="info-card link-card">
              <div className="info-icon">📞</div>
              <div className="info-details">
                <span className="info-label">Phone Support</span>
                <span className="info-value">+254 (0) 704 800 808</span>
              </div>
            </a>

            {/* Sample Social & Support Links */}
            <div className="social-links-wrapper">
              <span className="info-label">Connect & Community</span>
              <div className="social-buttons">
                <a
                  href="https://telegram.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn telegram"
                >
                  Telegram Channel
                </a>
                <a
                  href="https://whatsapp.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn whatsapp"
                >
                  WhatsApp Support
                </a>
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-btn github"
                >
                  GitHub Org
                </a>
              </div>
            </div>
          </div>

          {/* Direct Message Form */}
          <div className="form-card">
            {submitted && (
              <div className="success-banner">
                Thank you! Your inquiry has been forwarded to Fab Software Solutions support desk.
              </div>
            )}

            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Full Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="e.g. John Doe"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="name@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="subject">Subject</label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  placeholder="e.g. Bot License / Integration Support"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  name="message"
                  rows="5"
                  placeholder="Write your message here..."
                  value={formData.message}
                  onChange={handleChange}
                  required
                ></textarea>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Transmitting..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}