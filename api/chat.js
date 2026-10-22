const { GoogleGenAI } = require("@google/genai");

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";

const SYSTEM = `You are Cravio's friendly assistant for a fast-food restaurant.
Menu: burgers and pizzas, $18 each.
Open daily 10:00 AM to 10:00 PM.
Offers: Tasty Thursday 15% off, Pizza Days 20% off.
Table booking: guests use the "Book a table" form on the website
(name, phone, email, number of persons, date).
Help with the menu, offers, opening hours and table bookings.
Keep answers short (1-3 sentences). If you don't know something, say so.`;

let ai = null;
function getClient() {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ reply: "Method not allowed." });
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is missing");
    return res
      .status(500)
      .json({ reply: "Server error: GEMINI_API_KEY is not set." });
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    const messages = Array.isArray(body && body.messages) ? body.messages : [];

    // Keep the last 20 messages, and make sure we start with a user turn
    // (Gemini rejects a conversation that starts with a "model" turn).
    let recent = messages
      .filter((m) => m && typeof m.text === "string" && m.text.trim())
      .slice(-20);
    while (recent.length && recent[0].role !== "user") recent.shift();

    if (!recent.length) {
      return res.status(400).json({ reply: "Please type a message." });
    }

    const contents = recent.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text.slice(0, 1000) }],
    }));

    const response = await getClient().models.generateContent({
      model: MODEL,
      contents,
      config: { systemInstruction: SYSTEM },
    });

    return res.status(200).json({
      reply: response.text || "Sorry, I couldn't come up with a reply.",
    });
  } catch (e) {
    console.error("Gemini error:", e && e.message ? e.message : e);
    return res.status(500).json({
      reply: "Sorry, something went wrong. Please try again in a moment.",
    });
  }
};