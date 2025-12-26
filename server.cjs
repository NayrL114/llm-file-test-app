require("dotenv").config();
const express = require("express");
const OpenAI = require("openai");

const app = express();
app.use(express.json());

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/api/chat", async (req, res) => {
  try {
    const prompt = String(req.body?.prompt ?? "").trim();
    if (!prompt) return res.status(400).json({ error: "Missing prompt." });

    const response = await client.responses.create({
      model: "gpt-5.2",
      input: prompt,
    });

    res.json({ output: response.output_text });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error calling OpenAI." });
  }
});

app.listen(3001, () => console.log("API server running on http://localhost:3001"));
