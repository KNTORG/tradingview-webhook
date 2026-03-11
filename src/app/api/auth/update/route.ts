import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isAuthenticated } from "../../../../lib/auth";

const prisma = new PrismaClient();

export async function POST(req: Request) {
    try {
        const authenticated = await isAuthenticated();
        if (!authenticated) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { username, password } = await req.json();

        if (!username || !password) {
            return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
        }

        await prisma.appSetting.upsert({
            where: { key: "AUTH_USERNAME" },
            update: { value: username },
            create: { key: "AUTH_USERNAME", value: username },
        });

        await prisma.appSetting.upsert({
            where: { key: "AUTH_PASSWORD" },
            update: { value: password },
            create: { key: "AUTH_PASSWORD", value: password },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update credentials error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
