const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");

// Load the .env file inside the backend folder.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

// Allow requests from the React development server.
app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173"
    })
);

// Read JSON sent by React.
app.use(express.json({ limit: "10kb" }));

// Check the Mailgun configuration before starting.
if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
    console.error("Missing MAILGUN_API_KEY or MAILGUN_DOMAIN in backend/.env");
    process.exit(1);
}

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY
});

// A simple route to check that the backend is running.
app.get("/", function (req, res) {
    res.status(200).json({
        message: "DEV@Deakin newsletter backend is running."
    });
});

app.post("/subscribe", async function (req, res) {
    const email = req.body?.email;

    if (typeof email !== "string" || !email.trim()) {
        return res.status(400).json({
            message: "Please enter an email address."
        });
    }

    const cleanEmail = email.trim();

    // Basic format check for a single email address.
    const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

    if (cleanEmail.length > 254 || !emailPattern.test(cleanEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    try {
        const response = await mg.messages.create(
            process.env.MAILGUN_DOMAIN,
            {
                from: `DEV@Deakin <postmaster@${process.env.MAILGUN_DOMAIN}>`,
                to: [cleanEmail],
                subject: "Welcome to DEV@Deakin",
                text: "Welcome to DEV@Deakin! Thank you for subscribing to our Daily Insider.",
                html: `
                    <h2>Welcome to DEV@Deakin!</h2>
                    <p>Thank you for subscribing to our Daily Insider.</p>
                    <p>Stay connected for developer news and updates.</p>
                `
            }
        );

        // Log the actual API response for your submission evidence.
        console.log("Mailgun response:", response);

        return res.status(200).json({
            message: "Subscription successful! Your welcome email is on its way."
        });
    } catch (error) {
        console.error("Mailgun request failed. Status:", error.status);

        return res.status(502).json({
            message: "We could not send your welcome email. Please try again later."
        });
    }
});

// Return JSON for request parsing errors and unexpected errors.
app.use(function (error, req, res, next) {
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({
            message: "The request contains invalid JSON."
        });
    }

    if (error.type === "entity.too.large") {
        return res.status(413).json({
            message: "The request is too large."
        });
    }

    console.error("Unexpected server error.");

    return res.status(500).json({
        message: "Something went wrong. Please try again later."
    });
});

app.listen(PORT, function () {
    console.log(`Backend running on http://localhost:${PORT}`);
});
