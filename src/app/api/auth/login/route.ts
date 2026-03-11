import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import crypto from "crypto";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const { username, password } = await req.json();

        // Fetch credentials from DB, fallback to admin/admin
        const dbUser = await prisma.appSetting.findUnique({ where: { key: "AUTH_USERNAME" } });
        const dbPass = await prisma.appSetting.findUnique({ where: { key: "AUTH_PASSWORD" } });

        const actualUsername = dbUser?.value || "admin";
        const actualPassword = dbPass?.value || "admin";

        if (username !== actualUsername || password !== actualPassword) {
            return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString("hex");

        // Save token to DB
        await prisma.appSetting.upsert({
            where: { key: "SESSION_TOKEN" },
            update: { value: token },
            create: { key: "SESSION_TOKEN", value: token },
        });

        const cookieStore = await cookies();
        cookieStore.set({
            name: "trade_alert_session",
            value: token,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 30, // 30 days
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Login error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
