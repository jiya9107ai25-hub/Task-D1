const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const FormData = require("form-data");
const Mailgun = require("mailgun.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./firebaseAdmin");


// ----------------------------------------------------
// ENVIRONMENT VARIABLES
// ----------------------------------------------------

dotenv.config({
    path: path.join(__dirname, ".env")
});


// ----------------------------------------------------
// EXPRESS APP
// ----------------------------------------------------

const app = express();
const PORT = process.env.PORT || 3000;


// ----------------------------------------------------
// MIDDLEWARE
// ----------------------------------------------------

// Allow frontend requests during local development.
app.use(cors());

// Read JSON sent by React.
app.use(
    express.json({
        limit: "10kb"
    })
);


// ----------------------------------------------------
// CHECK REQUIRED ENVIRONMENT VARIABLES
// ----------------------------------------------------

if (
    !process.env.MAILGUN_API_KEY ||
    !process.env.MAILGUN_DOMAIN
) {
    console.error(
        "Missing MAILGUN_API_KEY or MAILGUN_DOMAIN in backend/.env"
    );

    process.exit(1);
}

if (!process.env.JWT_SECRET) {
    console.error(
        "Missing JWT_SECRET in backend/.env"
    );

    process.exit(1);
}


// ----------------------------------------------------
// MAILGUN SETUP
// ----------------------------------------------------

const mailgun = new Mailgun(FormData);

const mg = mailgun.client({
    username: "api",
    key: process.env.MAILGUN_API_KEY
});


// ----------------------------------------------------
// BACKEND TEST ROUTE
// ----------------------------------------------------

app.get("/", function (req, res) {
    return res.status(200).json({
        message: "DEV@Deakin backend is running."
    });
});


// ----------------------------------------------------
// NEWSLETTER SUBSCRIPTION
// ----------------------------------------------------

app.post("/subscribe", async function (req, res) {
    const email = req.body?.email;

    if (
        typeof email !== "string" ||
        !email.trim()
    ) {
        return res.status(400).json({
            message: "Please enter an email address."
        });
    }

    const cleanEmail = email.trim();

    const emailPattern =
        /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

    if (
        cleanEmail.length > 254 ||
        !emailPattern.test(cleanEmail)
    ) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    try {
        const response = await mg.messages.create(
            process.env.MAILGUN_DOMAIN,
            {
                from:
                    `DEV@Deakin <postmaster@${process.env.MAILGUN_DOMAIN}>`,

                to: [cleanEmail],

                subject: "Welcome to DEV@Deakin",

                text:
                    "Welcome to DEV@Deakin! Thank you for subscribing to our Daily Insider.",

                html: `
                    <h2>Welcome to DEV@Deakin!</h2>
                    <p>
                        Thank you for subscribing to our Daily Insider.
                    </p>
                    <p>
                        Stay connected for developer news and updates.
                    </p>
                `
            }
        );

        console.log(
            "Mailgun response:",
            response
        );

        return res.status(200).json({
            message:
                "Subscription successful! Your welcome email is on its way."
        });

    } catch (error) {
        console.error(
            "Mailgun request failed:",
            error
        );

        return res.status(502).json({
            message:
                "We could not send your welcome email. Please try again later."
        });
    }
});


// ----------------------------------------------------
// USER REGISTRATION
// ----------------------------------------------------

app.post("/register", async function (req, res) {
    const name = req.body?.name;
    const email = req.body?.email;
    const password = req.body?.password;

    if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            message: "Invalid registration data."
        });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (
        !cleanName ||
        !cleanEmail ||
        !password
    ) {
        return res.status(400).json({
            message: "Please complete all required fields."
        });
    }

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(cleanEmail)) {
        return res.status(400).json({
            message: "Please enter a valid email address."
        });
    }

    if (password.length < 6) {
        return res.status(400).json({
            message:
                "Password must contain at least 6 characters."
        });
    }

    try {
        const existingUsers = await db
            .collection("users")
            .where(
                "email",
                "==",
                cleanEmail
            )
            .limit(1)
            .get();

        if (!existingUsers.empty) {
            return res.status(409).json({
                message:
                    "An account with this email already exists."
            });
        }

        const hashedPassword =
            await bcrypt.hash(
                password,
                10
            );

        const newUser = await db
            .collection("users")
            .add({
                name: cleanName,
                email: cleanEmail,
                password: hashedPassword,
                plan: "free"
            });

        return res.status(201).json({
            message: "Account created successfully.",

            user: {
                id: newUser.id,
                name: cleanName,
                email: cleanEmail,
                plan: "free"
            }
        });

    } catch (error) {
        console.error(
            "Registration error:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to create your account. Please try again."
        });
    }
});


// ----------------------------------------------------
// USER LOGIN
// ----------------------------------------------------

app.post("/login", async function (req, res) {
    const email = req.body?.email;
    const password = req.body?.password;

    if (
        typeof email !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            message: "Invalid login data."
        });
    }

    const cleanEmail =
        email.trim().toLowerCase();

    if (
        !cleanEmail ||
        !password
    ) {
        return res.status(400).json({
            message:
                "Please enter your email and password."
        });
    }

    try {
        const result = await db
            .collection("users")
            .where(
                "email",
                "==",
                cleanEmail
            )
            .limit(1)
            .get();

        if (result.empty) {
            return res.status(401).json({
                message:
                    "Incorrect email or password."
            });
        }

        const userDocument =
            result.docs[0];

        const userData =
            userDocument.data();

        const passwordIsCorrect =
            await bcrypt.compare(
                password,
                userData.password
            );

        if (!passwordIsCorrect) {
            return res.status(401).json({
                message:
                    "Incorrect email or password."
            });
        }

        const token = jwt.sign(
            {
                userId: userDocument.id,
                email: userData.email
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        return res.status(200).json({
            message: "Login successful.",

            token: token,

            user: {
                id: userDocument.id,
                name: userData.name,
                email: userData.email,
                plan: userData.plan || "free"
            }
        });

    } catch (error) {
        console.error(
            "Login error:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to log in. Please try again."
        });
    }
});

// ----------------------------------------------------
// JWT AUTHENTICATION MIDDLEWARE
// ----------------------------------------------------

function authenticateToken(req, res, next) {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
        return res.status(401).json({
            message: "You must be logged in."
        });
    }

    const token = authorizationHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            message: "Invalid authentication token."
        });
    }

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {
        return res.status(401).json({
            message: "Your session is invalid or has expired."
        });
    }
}


// ----------------------------------------------------
// UPGRADE USER PLAN
// ----------------------------------------------------

app.patch(
    "/upgrade-plan",
    authenticateToken,
    async function (req, res) {

        const nameOnCard = req.body?.nameOnCard;
        const cardNumber = req.body?.cardNumber;
        const expiry = req.body?.expiry;
        const cvv = req.body?.cvv;

        if (
            typeof nameOnCard !== "string" ||
            typeof cardNumber !== "string" ||
            typeof expiry !== "string" ||
            typeof cvv !== "string"
        ) {
            return res.status(400).json({
                message: "Please enter valid payment details."
            });
        }

        const cleanName =
            nameOnCard.trim();

        const cleanCard =
            cardNumber.replace(/\s/g, "");

        const cleanExpiry =
            expiry.trim();

        const cleanCvv =
            cvv.trim();

        if (!cleanName) {
            return res.status(400).json({
                message: "Please enter the name on the card."
            });
        }

        if (!/^\d{16}$/.test(cleanCard)) {
            return res.status(400).json({
                message: "Card number must contain 16 digits."
            });
        }

        if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cleanExpiry)) {
            return res.status(400).json({
                message: "Expiry must be in MM/YY format."
            });
        }

        if (!/^\d{3,4}$/.test(cleanCvv)) {
            return res.status(400).json({
                message: "Please enter a valid CVV."
            });
        }

        try {
            const userReference =
                db.collection("users")
                    .doc(req.user.userId);

            const userDocument =
                await userReference.get();

            if (!userDocument.exists) {
                return res.status(404).json({
                    message: "User account could not be found."
                });
            }

            const userData =
                userDocument.data();

            if (userData.plan === "paid") {
                return res.status(409).json({
                    message: "You are already on the Paid plan."
                });
            }

            await userReference.update({
                plan: "paid"
            });

            return res.status(200).json({
                message:
                    "Your account has been upgraded successfully.",

                user: {
                    id: userDocument.id,
                    name: userData.name,
                    email: userData.email,
                    plan: "paid"
                }
            });

        } catch (error) {
            console.error(
                "Plan upgrade error:",
                error
            );

            return res.status(500).json({
                message:
                    "Unable to upgrade your plan. Please try again."
            });
        }
    }
);
// ----------------------------------------------------
// ERROR HANDLING
// ----------------------------------------------------

app.use(
    function (error, req, res, next) {

        if (
            error.type === "entity.parse.failed"
        ) {
            return res.status(400).json({
                message:
                    "The request contains invalid JSON."
            });
        }

        if (
            error.type === "entity.too.large"
        ) {
            return res.status(413).json({
                message:
                    "The request is too large."
            });
        }

        console.error(
            "Unexpected server error:",
            error
        );

        return res.status(500).json({
            message:
                "Something went wrong. Please try again later."
        });
    }
);


// ----------------------------------------------------
// START SERVER
// ----------------------------------------------------

app.listen(
    PORT,
    function () {
        console.log(
            `Backend running on http://localhost:${PORT}`
        );
    }
);