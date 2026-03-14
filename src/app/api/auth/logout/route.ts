import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST() {
    try {
        await prisma.appSetting.deleteMany({
            where: { key: "SESSION_TOKEN" }
        });

        const cookieStore = await cookies();
        cookieStore.delete("trade_alert_session");

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
