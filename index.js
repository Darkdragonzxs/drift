import path from "node:path";
import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import { createBareServer } from "@nebula-services/bare-server-node";

const app = express();
const bareServer = createBareServer("/fq/");

// Enable CORS only for /fq
app.use("/fq", cors({ origin: true }));

// Wisp HTTP Reverse Proxy
app.all("/wisp/*", async (req, res) => {
  const targetPath = req.url.replace(/^\/wisp\//, "");
  const targetUrl = `https://wisp.mercurywork.shop/${targetPath}`;

  try {
    const wispRes = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
    });
    const data = await wispRes.arrayBuffer();

    res.setHeader(
      "Content-Type",
      wispRes.headers.get("content-type") || "application/octet-stream"
    );
    res.status(wispRes.status).send(Buffer.from(data));
  } catch (err) {
    console.error(err);
    res.status(500).send("Error proxying Wisp request");
  }
});

// Serve static files from "mango"
app.use(express.static(path.join(process.cwd(), "mango")));

// Bare server mounting
app.use("/fq", bareServer);

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "mango", "404.html"));
});

export default app;
