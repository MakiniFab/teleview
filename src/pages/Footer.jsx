import React from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import "./Footer.css"; // or import inside App.css

export default function Footer() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleDashboardClick = (e) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="app-footer">
      <div className="footer-inner">
        {/* Brand Column */}
        <div className="footer-col footer-brand-col">
          <NavLink to="/" onClick={handleDashboardClick} className="footer-brand-logo">
            Autom<span className="brand-accent">8</span>
          </NavLink>
          <p className="footer-brand-desc">
            Automated trading engine and smart bot manager built for seamless market execution.
          </p>
        </div>

        {/* Quick Links Column */}
        <div className="footer-col">
          <h4 className="footer-col-title">Navigation</h4>
          <ul className="footer-links">
            <li>
              <NavLink to="/" end onClick={handleDashboardClick}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/bots">Trading Bots</NavLink>
            </li>
            <li>
              <NavLink to="/history">Trade History</NavLink>
            </li>
            <li>
              <NavLink to="/contact">Support</NavLink>
            </li>
          </ul>
        </div>

        {/* Help & Tutorials Column (All lead to Contact/Support) */}
        <div className="footer-col">
          <h4 className="footer-col-title">Guides & Resources</h4>
          <ul className="footer-links">
            <li>
              <NavLink to="/contact">How to Use Bots</NavLink>
            </li>
            <li>
              <NavLink to="/contact">Deposit & Withdraw from Deriv</NavLink>
            </li>
            <li>
              <NavLink to="/contact">Get Custom Bots</NavLink>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Bottom Bar */}
      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Deriv Autom8. A FAB Software Solutions web platform.</p>
      </div>
    </footer>
  );
}