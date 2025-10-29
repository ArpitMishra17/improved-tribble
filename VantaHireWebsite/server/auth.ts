import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const parts = stored.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid stored password format");
  }
  const [hashed, salt] = parts;
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Role-based access control middleware
export function requireRole(roles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Authentication check middleware
export function requireAuth(req: any, res: any, next: any) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function setupAuth(app: Express) {
  // Fail fast if SESSION_SECRET is not set in production
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET environment variable must be set in production');
  }

  const PostgresSessionStore = connectPg(session);

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'vantahire-dev-secret',
    resave: false,
    saveUninitialized: false,
    store: new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    }),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false);
        }

        // Use secure password comparison for all users (including admin)
        if (!(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  app.post("/api/register", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { username, password, firstName, lastName, role = 'recruiter' } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: "Username and password are required" });
        return;
      }

      // Security: Only allow candidate or recruiter roles via public registration
      // Admin and superadmin accounts must be created manually by existing admins
      const allowedRoles = ['candidate', 'recruiter'];
      if (!allowedRoles.includes(role)) {
        res.status(403).json({ error: "Invalid role. Public registration only allows 'candidate' or 'recruiter' roles." });
        return;
      }

      // Password strength validation
      if (password.length < 10) {
        res.status(400).json({ error: "Password must be at least 10 characters long" });
        return;
      }

      const hasUppercase = /[A-Z]/.test(password);
      const hasLowercase = /[a-z]/.test(password);
      const hasDigit = /\d/.test(password);
      const hasSpecial = /[^A-Za-z0-9]/.test(password);

      if (!hasUppercase || !hasLowercase || !hasDigit || !hasSpecial) {
        res.status(400).json({
          error: "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character"
        });
        return;
      }

      // Common password blacklist
      const commonPasswords = ['password', 'qwerty', '12345678', '123456789', '1234567890', 'abc123', 'password123'];
      if (commonPasswords.includes(password.toLowerCase())) {
        res.status(400).json({ error: "Password is too common. Please choose a stronger password" });
        return;
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        res.status(400).json({ error: "Username already exists" });
        return;
      }

      const user = await storage.createUser({
        username,
        password: await hashPassword(password),
        firstName,
        lastName,
        role
      });

      req.login(user, (err) => {
        if (err) {
          next(err);
          return;
        }
        res.status(201).json({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        });
      });
    } catch (error) {
      next(error);
    }
  });

  // Login with optional expectedRole gating so the wrong portal cannot be used
  app.post("/api/login", (req: Request, res: Response, next: NextFunction): void => {
    passport.authenticate("local", (err: any, user: SelectUser | false) => {
      if (err) {
        next(err);
        return;
      }
      if (!user) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      // Optional expectedRole from client (string or array of strings)
      const expected: any = (req.body as any)?.expectedRole;
      if (expected) {
        const expectedRoles = Array.isArray(expected) ? expected : [expected];
        if (!expectedRoles.includes(user.role)) {
          res.status(403).json({ error: "Please use the correct portal for your role" });
          return;
        }
      }

      req.login(user, (loginErr) => {
        if (loginErr) {
          next(loginErr);
          return;
        }
        // Link any existing applications (by email) to this user account for proper candidate access
        // Await to ensure immediate visibility on first dashboard load; log but do not fail login
        storage.claimApplicationsForUser(user.id, user.username)
          .then(() => {
            res.status(200).json({
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            });
          })
          .catch((e) => {
            console.error('claimApplicationsForUser error:', e);
            res.status(200).json({
              id: user.id,
              username: user.username,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role
            });
          });
        });
    })(req, res, next);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction): void => {
    req.logout((err) => {
      if (err) {
        next(err);
        return;
      }
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req: Request, res: Response): void => {
    if (!req.isAuthenticated()) {
      res.sendStatus(401);
      return;
    }
    const user = req.user!;
    res.json({
      id: user.id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role
    });
  });
}
