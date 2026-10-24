const messageBox = document.getElementById("message");
const authPanel = document.getElementById("authPanel");
const greeting = document.getElementById("userGreeting");
const logoutBtn = document.getElementById("logoutBtn");
const eventsGrid = document.getElementById("eventsGrid");
const ticketsList = document.getElementById("ticketsList");
const searchInput = document.getElementById("searchInput");
let currentUser = null;
let allEvents = [];

function showMessage(message, isError = false) {
  messageBox.textContent = message;
  messageBox.classList.remove("hidden", "error");
  if (isError) messageBox.classList.add("error");
  window.scrollTo({ top: 0, behavior: "smooth" });
  setTimeout(() => messageBox.classList.add("hidden"), 5000);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin",
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

function updateAuthUI() {
  authPanel.classList.toggle("hidden", Boolean(currentUser));
  logoutBtn.classList.toggle("hidden", !currentUser);
  greeting.textContent = currentUser ? `Hi, ${currentUser.name}` : "";
  document.getElementById("myTicketsNav").classList.toggle("hidden", !currentUser);
}

function formatDate(dateText) {
  const date = new Date(`${dateText}T12:00:00`);
  return Number.isNaN(date.getTime()) ? dateText : date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function renderEvents() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = allEvents.filter(event =>
    [event.title, event.category, event.venue, event.address, event.description]
      .some(value => String(value || "").toLowerCase().includes(query))
  );

  if (!filtered.length) {
    eventsGrid.innerHTML = '<p class="muted">No matching events found.</p>';
    return;
  }

  eventsGrid.innerHTML = filtered.map(event => `
    <article class="event-card">
      <div class="event-art">${escapeHtml(event.category || "Event")}</div>
      <div class="event-body">
        <span class="tag">${escapeHtml(event.category || "Event")}</span>
        <h3>${escapeHtml(event.title)}</h3>
        <p class="description">${escapeHtml(event.description || "")}</p>
        <div class="event-meta">
          <span>📅 ${escapeHtml(formatDate(event.date))} · ${escapeHtml(event.time || "")}</span>
          <span>📍 ${escapeHtml(event.venue || "")}</span>
          <span>🗺️ ${escapeHtml(event.address || "")}</span>
          <span>🎟️ ${Number(event.seats) || 0} total seats</span>
        </div>
        <div class="event-bottom">
          <div class="price">${Number(event.price) === 0 ? "Free" : `₹${Number(event.price)}`}<small>per ticket</small></div>
          <button class="button book-btn" data-book="${event.id}" ${currentUser ? "" : 'title="Log in to book"'}>
            ${currentUser ? "Book ticket" : "Log in to book"}
          </button>
        </div>
      </div>
    </article>
  `).join("");

  eventsGrid.querySelectorAll("[data-book]").forEach(button => {
    button.addEventListener("click", async () => {
      if (!currentUser) {
        showMessage("Please log in or create an account before booking.", true);
        authPanel.scrollIntoView({ behavior: "smooth" });
        return;
      }
      button.disabled = true;
      try {
        const result = await api("/api/bookings", {
          method: "POST",
          body: JSON.stringify({ eventId: button.dataset.book })
        });
        showMessage(`${result.message} Your ticket ID is ${result.booking.ticketCode}.`);
        await loadTickets();
      } catch (error) {
        showMessage(error.message, true);
      } finally {
        button.disabled = false;
      }
    });
  });
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

async function loadEvents() {
  try {
    allEvents = await api("/api/events");
    renderEvents();
  } catch (error) {
    eventsGrid.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

async function loadTickets() {
  if (!currentUser) {
    ticketsList.innerHTML = '<p class="muted">Log in to view your tickets.</p>';
    return;
  }
  try {
    const tickets = await api("/api/my-bookings");
    if (!tickets.length) {
      ticketsList.innerHTML = '<p class="muted">You have not booked any tickets yet. Explore the events above!</p>';
      return;
    }
    ticketsList.innerHTML = tickets.map(ticket => `
      <article class="ticket-card">
        <div class="ticket-top">
          <div><h3>${escapeHtml(ticket.eventTitle)}</h3><div class="ticket-code">${escapeHtml(ticket.ticketCode)}</div></div>
          <span class="status ${ticket.status === "Cancelled" ? "cancelled" : ""}">${escapeHtml(ticket.status)}</span>
        </div>
        <div class="ticket-details">
          📅 ${escapeHtml(formatDate(ticket.eventDate))} · ${escapeHtml(ticket.eventTime)}<br>
          📍 ${escapeHtml(ticket.venue)}<br>
          🗺️ ${escapeHtml(ticket.address)}<br>
          🎟️ Ticket price: ${Number(ticket.price) === 0 ? "Free" : `₹${Number(ticket.price)}`}
        </div>
        ${ticket.status === "Booked" ? `<button class="button cancel-btn" data-cancel="${ticket.id}">Cancel ticket</button>` : ""}
      </article>
    `).join("");

    ticketsList.querySelectorAll("[data-cancel]").forEach(button => {
      button.addEventListener("click", async () => {
        if (!confirm("Are you sure you want to cancel this ticket?")) return;
        button.disabled = true;
        try {
          const result = await api(`/api/bookings/${button.dataset.cancel}/cancel`, { method: "PATCH" });
          showMessage(result.message);
          await loadTickets();
        } catch (error) {
          showMessage(error.message, true);
        } finally {
          button.disabled = false;
        }
      });
    });
  } catch (error) {
    ticketsList.innerHTML = `<p class="muted">${escapeHtml(error.message)}</p>`;
  }
}

document.getElementById("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
    });
    currentUser = result.user;
    updateAuthUI();
    renderEvents();
    await loadTickets();
    event.currentTarget.reset();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message, true);
  }
});

document.getElementById("registerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const result = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password")
      })
    });
    currentUser = result.user;
    updateAuthUI();
    renderEvents();
    await loadTickets();
    event.currentTarget.reset();
    showMessage(result.message);
  } catch (error) {
    showMessage(error.message, true);
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST" });
    currentUser = null;
    updateAuthUI();
    renderEvents();
    ticketsList.innerHTML = "";
    showMessage("Logged out successfully.");
    showView("eventsView");
  } catch (error) {
    showMessage(error.message, true);
  }
});

function showView(viewId) {
  document.getElementById("eventsView").classList.toggle("hidden", viewId !== "eventsView");
  document.getElementById("ticketsView").classList.toggle("hidden", viewId !== "ticketsView");
  document.querySelectorAll(".nav-btn[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewId);
  });
  if (viewId === "ticketsView") loadTickets();
}

document.querySelectorAll(".nav-btn[data-view]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.view));
});
searchInput.addEventListener("input", renderEvents);

async function init() {
  try {
    const result = await api("/api/me");
    currentUser = result.user;
  } catch {
    currentUser = null;
  }
  updateAuthUI();
  await loadEvents();
  if (currentUser) await loadTickets();
}
init();
