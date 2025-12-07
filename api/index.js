import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import basicAuth from "express-basic-auth";
import mime from "mime";
import fetch from "node-fetch";
import { createBareServer } from "@nebula-services/bare-server-node";
import chalk from "chalk";
import config from "./config.js";

const app = express();
const bareServer = createBareServer("/fq/");
const cache = new Map();
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000; // 30 days

if (config.challenge !== false) {
  Object.entries(config.users).forEach(([u, p]) =>
    console.log(chalk.blue(`Username: ${u}, Password: ${p}`))
  );
  app.use(basicAuth({ users: config.users, challenge: true }));
}

app.get("/e/*", async (req, res) => {
  try {
    if (cache.has(req.path)) {
      const { data, contentType, timestamp } = cache.get(req.path);
      if (Date.now() - timestamp <= CACHE_TTL) {
        res.setHeader("Content-Type", contentType);
        return res.status(200).send(data);
      }
      cache.delete(req.path);
    }

    const baseUrls = {
      "/e/1/": "https://raw.githubusercontent.com/qrs/x/fixy/",
      "/e/2/": "https://raw.githubusercontent.com/3v1/V5-Assets/main/",
      "/e/3/": "https://raw.githubusercontent.com/3v1/V5-Retro/master/",
    };

    let reqTarget = null;
    for (const [prefix, baseUrl] of Object.entries(baseUrls)) {
      if (req.path.startsWith(prefix)) {
        reqTarget = baseUrl + req.path.slice(prefix.length);
        break;
      }
    }

    if (!reqTarget) return res.status(404).send("Not found");

    const asset = await fetch(reqTarget);
    if (!asset.ok) return res.status(404).send("Not found");

    const data = Buffer.from(await asset.arrayBuffer());
    const ext = path.extname(reqTarget);
    const contentType = [".unityweb"].includes(ext)
      ? "application/octet-stream"
      : mime.getType(ext);

    cache.set(req.path, { data, contentType, timestamp: Date.now() });
    res.setHeader("Content-Type", contentType);
    res.status(200).send(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error fetching asset");
  }
});

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), "mango")));
app.use("/fq", cors({ origin: true }));

// Wisp HTTP Reverse Proxy
app.all("/wisp/*", async (req, res) => {
  const targetPath = req.url.replace(/^\/wisp\//, "");
  const targetUrl = `https://wisp.mercurywork.shop/${targetPath}`;

  try {
    const wispRes = await fetch(targetUrl, {
      method: req.method,
      headers: req.headers,
      body: req.method !== "GET" ? req.body : undefined,
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

// 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(process.cwd(), "mango", "404.html"));
});

export default app;
