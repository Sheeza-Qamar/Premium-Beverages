import jwt from "jsonwebtoken";

type ClientCardPayload = {
  purpose: "client-card";
  clientId: number;
};

type JwtPayload = ClientCardPayload & {
  iat: number;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing required environment variable: JWT_SECRET");
  }
  return secret;
}

export function createClientCardToken(clientId: number): string {
  const payload: ClientCardPayload = {
    purpose: "client-card",
    clientId,
  };
  return jwt.sign(payload, getJwtSecret());
}

export function verifyClientCardToken(token: string): { clientId: number } | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    if (payload.purpose !== "client-card" || !Number.isInteger(payload.clientId) || payload.clientId < 1) {
      return null;
    }
    return { clientId: payload.clientId };
  } catch {
    return null;
  }
}
