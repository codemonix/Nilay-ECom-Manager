import "express";

declare global {
  namespace Express {
    interface Request {
      currentUser?: {
        id: string;
        name: string;
        role: string;
        permissions: string[];
      };
    }
  }
}

export {};
