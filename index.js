import path from "node:path";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createBareServer } from "@nebula-services/bare-server-node";

const app = express();
const bareServer = createBareServer("/fq/");

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS for /fq
app.use("/fq", cors({ origin: true }));

// Wisp reverse proxy
app.all("/wisp/*", async (req, res) => {
  const targetPath = req.url.replace(/^\/wisp\//, "");
  const targetUrl = `https://wisp.mercurywork.shop/${targetPath}`;

  try {
    const wispRes = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? JSON.stringify(req.body) : undefined,
    });

    const contentType = wispRes.headers.get("content-type") || "application/octet-stream";
    const data = await wispRes.arrayBuffer();

    res.status(wispRes.status);
    res.setHeader("Content-Type", contentType);
    res.send(Buffer.from(data));
  } catch (err) {
    console.error("Wisp proxy error:", err);
    res.status(500).send("Error proxying Wisp request");
  }
});

// Mount Bare server
app.use("/fq", bareServer);

// Serve static files from mango
app.use(express.static(path.join(process.cwd(), "mango")));

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "mango", "404.html"));
});

export default app;
