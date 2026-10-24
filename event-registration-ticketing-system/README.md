# EventHub — Event Registration and Ticketing System

A student project built with HTML, CSS, JavaScript, Node.js, Express and MongoDB.

## Features

- Create an account and log in
- Passwords hashed using bcrypt
- View upcoming events, dates, times, venues, addresses and ticket prices
- Search events by name, category or venue
- Book a ticket and receive a ticket code
- View your own tickets
- Cancel an active ticket
- Booking details saved in MongoDB
- Sample events inserted automatically on first run

## Requirements

- Node.js (LTS recommended)
- MongoDB Community Server running locally, or a MongoDB Atlas connection string
- Internet is not needed for a local MongoDB setup after packages are installed

## Setup

1. Extract this ZIP file.
2. Open the extracted folder in VS Code.
3. Open Terminal in VS Code.
4. Install dependencies:

   ```bash
   npm install
   ```

5. Copy `.env.example` and name the copy `.env`.
6. Make sure MongoDB is running. For local MongoDB, the default URI is:

   `mongodb://127.0.0.1:27017`

7. If using MongoDB Atlas, replace `MONGODB_URI` in `.env` with your Atlas connection string. Keep the password private.
8. In `.env`, set a long random value for `SESSION_SECRET`.
9. Start the project:

   ```bash
   npm start
   ```

10. Open a browser and visit:

   `http://localhost:3000`

## How to use

1. Create an account using the registration form.
2. Browse upcoming events and venue information.
3. Select **Book ticket**.
4. Select **My Tickets** to view the ticket ID and booking details.
5. Select **Cancel ticket** to cancel a booking.

## MongoDB collections

- `users` — name, email and password hash
- `events` — event title, date, time, venue, address, price and seat limit
- `bookings` — user, event, ticket code, booking status and timestamps

## Notes

- The included events are sample/demo data. Replace them with approved real event information before presenting the project.
- This project marks a ticket as `Cancelled`; it does not process real payments or refunds.
- The default session store is intended for local project demonstration. For production deployment, use a persistent session store, HTTPS, stronger security settings, rate limiting and appropriate privacy protections.
- Never upload your `.env` file or share your MongoDB credentials.
- Event records are inserted only when the `events` collection is empty. To edit sample events, use MongoDB Compass or add an admin feature.
