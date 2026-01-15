import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { type Server } from "http";
import { nanoid } from "nanoid";
import { storage } from "./storage";
import { generateJobPostingSchema } from "./seoUtils";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Compute dirname in ESM
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const { createServer: createViteServer, createLogger } = await import("vite");
  const viteConfig = (await import("../vite.config"))?.default ?? {};
  const viteLogger = createLogger();
  const serverOptions: any = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  // Serve static HTML files from client/public (e.g., landing pages)
  // These bypass SPA routing
  const publicDir = path.resolve(__dirname, "..", "client", "public");
  app.use(express.static(publicDir, {
    extensions: ['html'],
    index: false, // Don't serve index.html for directories
  }));

  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

/**
 * Inject JSON-LD structured data into HTML for SEO
 */
function injectJsonLd(html: string, jsonLd: object): string {
  const script = `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>`;
  // Inject before </head> for early discovery by crawlers
  return html.replace('</head>', `${script}\n</head>`);
}

/**
 * Parse job identifier from URL path (supports slug, id, or legacy id-slug format)
 */
function parseJobIdentifier(param: string): { type: 'id' | 'slug'; value: string | number } {
  // Pure numeric ID
  if (/^\d+$/.test(param)) {
    return { type: 'id', value: Number(param) };
  }
  // Legacy format: id-slug (e.g., "123-senior-engineer")
  const idSlugMatch = param.match(/^(\d+)-(.+)$/);
  if (idSlugMatch) {
    return { type: 'id', value: Number(idSlugMatch[1]) };
  }
  // Pure slug
  return { type: 'slug', value: param };
}

export function serveStatic(app: Express) {
  // Compute dirname in ESM
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const distPath = path.resolve(__dirname, "public");
  const clientPublicPath = path.resolve(__dirname, "..", "client", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static landing pages from client/public (e.g., /landing/hiring-insights.html)
  // These bypass the SPA and are served directly as static HTML
  if (fs.existsSync(clientPublicPath)) {
    app.use(express.static(clientPublicPath, {
      extensions: ['html'],
      index: false,
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }));
  }

  // Cache policy: cache-bust hashed assets aggressively, but keep index.html no-cache
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-store, must-revalidate');
      } else if (filePath.includes('/assets/')) {
        // hashed assets
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));

  // Server-side JSON-LD injection for job detail pages
  // This ensures Googlebot sees structured data without executing JavaScript
  app.get('/jobs/:param', async (req, res, next) => {
    try {
      const { param } = req.params;
      const identifier = parseJobIdentifier(param);

      // Fetch job data
      let job;
      if (identifier.type === 'id') {
        job = await storage.getJobWithRecruiter(identifier.value as number);
      } else {
        job = await storage.getJobBySlug(identifier.value as string);
      }

      // If job not found or inactive/expired, fall through to SPA (which will show 404/410)
      if (!job || !job.isActive || job.status !== 'approved') {
        return next();
      }

      // Read the index.html template
      const indexPath = path.resolve(distPath, "index.html");
      let html = await fs.promises.readFile(indexPath, "utf-8");

      // Generate JSON-LD
      const baseUrl = process.env.BASE_URL || 'https://www.vantahire.com';
      const jsonLd = generateJobPostingSchema({
        id: job.id,
        title: job.title,
        description: job.description,
        location: job.location,
        type: job.type,
        skills: job.skills as string[] | null,
        clientName: job.client?.name ?? null,
        clientDomain: job.client?.domain ?? null,
        createdAt: job.createdAt,
        deadline: job.deadline,
        expiresAt: job.expiresAt,
        slug: job.slug,
      }, baseUrl);

      // Only inject if JSON-LD generation succeeded
      if (jsonLd) {
        html = injectJsonLd(html, jsonLd);
      }

      // Serve the modified HTML
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-store, must-revalidate');
      res.send(html);
    } catch (error) {
      console.error('[SSR JSON-LD] Error injecting job schema:', error);
      // Fall through to regular SPA serving on error
      next();
    }
  });

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    // Ensure the SPA shell (index.html) is never cached, to avoid hash mismatches
    res.setHeader('Cache-Control', 'no-store, must-revalidate');
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
