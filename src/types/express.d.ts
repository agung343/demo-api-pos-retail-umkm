import type { AuthPayload } from "@/middlewares/verifyToken";

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}
