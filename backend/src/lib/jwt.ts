import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET ?? "dev-secret-change-me";
const expiresIn = process.env.JWT_EXPIRES_IN ?? "8h";

export type JwtPayload = {
  sub: string;
  role: "ADMIN" | "SALES_MANAGER";
  branchId: string | null;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
