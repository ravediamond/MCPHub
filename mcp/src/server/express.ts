import express from "express";
import bodyParser from "body-parser";
import helmet from "helmet";
import {
  corsMiddleware,
  ipThrottlingMiddleware,
  startThrottleCleanup,
} from "../middleware";
import { configureRoutes } from "../routes";

/**
 * Initialize and configure the Express server
 */
export function createServer() {
  const app = express();

  // Configure and use helmet for security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "https://mcph.io"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
            "'unsafe-eval'",
            "https://mcph.io",
            "https://apis.google.com",
            "https://*.googleapis.com",
            "https://www.gstatic.com",
            "https://accounts.google.com",
          ],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://mcph.io",
            "https://www.gstatic.com",
          ],
          connectSrc: [
            "'self'",
            "https://mcph.io",
            "https://*.googleapis.com",
            "https://securetoken.googleapis.com",
            "https://firestore.googleapis.com",
            "https://identitytoolkit.googleapis.com",
            "https://*.firebaseio.com",
            "wss://*.firebaseio.com",
            "https://firebasestorage.googleapis.com",
          ],
          imgSrc: [
            "'self'",
            "data:",
            "https://mcph.io",
            "https://*.googleapis.com",
            "https://www.gstatic.com",
          ],
          fontSrc: [
            "'self'",
            "data:",
            "https://mcph.io",
            "https://www.gstatic.com",
          ],
          frameSrc: [
            "'self'",
            "https://mcph.io",
            "https://*.googleapis.com",
            "https://accounts.google.com",
            "https://*.firebaseapp.com",
          ],
        },
      },
      frameguard: {
        action: "deny",
      },
      referrerPolicy: {
        policy: "strict-origin-when-cross-origin",
      },
    }),
  );

  // Use body-parser middleware for JSON
  app.use(bodyParser.json());

  // Apply IP throttling middleware
  app.use(ipThrottlingMiddleware);

  // Start the cleanup interval for the throttle map
  startThrottleCleanup();

  // Add CORS headers for API endpoints
  app.use(corsMiddleware);

  // Configure all routes
  configureRoutes(app);

  return app;
}
