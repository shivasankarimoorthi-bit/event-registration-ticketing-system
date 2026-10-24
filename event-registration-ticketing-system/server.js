require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "event_ticketing";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || "development-only-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 4 }
}));
app.use(express.static(path.join(__dirname, "public")));

let db;
let users;
let events;
let bookings;

const starterEvents = [
  {
    title: "Tech Innovation Summit",
    category: "Technology",
    date: "2026-11-15",
    time: "10:00 AM",
    venue: "Vidyasagar Women's College Auditorium",
    address: "Chengalpattu, Tamil Nadu",
    description: "A student-friendly event about technology, innovation and software careers.",
    price: 150,
    seats: 100
  },
  {
    title: "Web Development Workshop",
    category: "Workshop",
    date: "2026-11-22",
    time: "09:30 AM",
    venue: "Innovation Lab, Main Block",
    address: "Chengalpattu, Tamil Nadu",
    description: "Learn the basics of modern web development through practical sessions.",
    price: 100,
    seats: 60
  },
  {
    title: "Campus Cultural Fest",
    category: "Cultural",
    date: "2026-12-05",
    time: "04:00 PM",
    venue: "College Open-Air Stage",
    address: "Chengalpattu, Tamil Nadu",
    description: "Music, dance, student performances and fun activities.",
    price: 200,
    seats: 250
  },
  {
    title: "Career Guidance Meet",
    category: "Career",
    date: "2026-12-12",
    time: "11:00 AM",
    venue: "Seminar Hall - Block B",
    address: "Chengalpattu, Tamil Nadu",
    description: "Resume tips, interview preparation and career guidance for students.",
    price: 0,
    seats: 120
  }
];

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Please log in first." });
  }
  next();
}

function publicUser(user) {
  return { id: user._id.toString(), name: user.name, email: user.email };
}

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (name.length < 2 || !email.includes("@") || password.length < 6) {
      return res.status(400).json({ message: "Enter a name, valid email and password with at least 6 characters." });
    }

    const existing = await users.findOne({ email });
    if (existing) return res.status(409).json({ message: "This email is already registered. Please log in." });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      name, email, passwordHash, createdAt: new Date()
    });
    const user = { _id: result.insertedId, name, email };
    req.session.user = publicUser(user);
    res.status(201).json({ message: "Account created successfully.", user: req.session.user });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Could not create account. Please try again." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const user = await users.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    req.session.user = publicUser(user);
    res.json({ message: "Logged in successfully.", user: req.session.user });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Could not log in. Please try again." });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/events", async (req, res) => {
  try {
    const allEvents = await events.find({}).sort({ date: 1 }).toArray();
    res.json(allEvents.map(e => ({ ...e, id: e._id.toString() })));
  } catch (error) {
    console.error("Events error:", error);
    res.status(500).json({ message: "Could not load events." });
  }
});

app.post("/api/bookings", requireLogin, async (req, res) => {
  try {
    const eventId = String(req.body.eventId || "");
    if (!ObjectId.isValid(eventId)) return res.status(400).json({ message: "Invalid event." });

    const event = await events.findOne({ _id: new ObjectId(eventId) });
    if (!event) return res.status(404).json({ message: "Event not found." });

    const alreadyBooked = await bookings.findOne({
      userId: req.session.user.id,
      eventId: event._id.toString(),
      status: "Booked"
    });
    if (alreadyBooked) return res.status(409).json({ message: "You already have a ticket for this event." });

    const activeCount = await bookings.countDocuments({ eventId: event._id.toString(), status: "Booked" });
    if (activeCount >= event.seats) return res.status(409).json({ message: "Sorry, this event is fully booked." });

    const booking = {
      userId: req.session.user.id,
      userName: req.session.user.name,
      userEmail: req.session.user.email,
      eventId: event._id.toString(),
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      venue: event.venue,
      address: event.address,
      price: event.price,
      ticketCode: "TKT-" + require("crypto").randomBytes(4).toString("hex").toUpperCase(),
      status: "Booked",
      bookedAt: new Date()
    };
    const result = await bookings.insertOne(booking);
    res.status(201).json({ message: "Ticket booked successfully!", booking: { ...booking, id: result.insertedId.toString() } });
  } catch (error) {
    console.error("Booking error:", error);
    res.status(500).json({ message: "Could not book ticket. Please try again." });
  }
});

app.get("/api/my-bookings", requireLogin, async (req, res) => {
  try {
    const mine = await bookings.find({ userId: req.session.user.id }).sort({ bookedAt: -1 }).toArray();
    res.json(mine.map(b => ({ ...b, id: b._id.toString() })));
  } catch (error) {
    console.error("My bookings error:", error);
    res.status(500).json({ message: "Could not load your tickets." });
  }
});

app.patch("/api/bookings/:id/cancel", requireLogin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    if (!ObjectId.isValid(bookingId)) return res.status(400).json({ message: "Invalid ticket." });

    const result = await bookings.updateOne(
      { _id: new ObjectId(bookingId), userId: req.session.user.id, status: "Booked" },
      { $set: { status: "Cancelled", cancelledAt: new Date() } }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ message: "Active ticket not found. It may already be cancelled." });
    }
    res.json({ message: "Ticket cancelled successfully." });
  } catch (error) {
    console.error("Cancel booking error:", error);
    res.status(500).json({ message: "Could not cancel ticket. Please try again." });
  }
});

async function start() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);
  users = db.collection("users");
  events = db.collection("events");
  bookings = db.collection("bookings");

  await users.createIndex({ email: 1 }, { unique: true });
  await bookings.createIndex({ userId: 1, eventId: 1, status: 1 });

  const eventCount = await events.countDocuments();
  if (eventCount === 0) {
    await events.insertMany(starterEvents.map(e => ({ ...e, createdAt: new Date() })));
  }

  app.listen(PORT, () => {
    console.log(`Event Ticketing System running at http://localhost:${PORT}`);
    console.log(`Connected to MongoDB database: ${DB_NAME}`);
  });
}

start().catch(error => {
  console.error("Could not start the application.");
  console.error("Check that MongoDB is running and MONGODB_URI in .env is correct.");
  console.error(error.message);
  process.exit(1);
});
