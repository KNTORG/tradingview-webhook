import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function isAuthenticated(): Promise<boolean> {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("trade_alert_session")?.value;

    if (!sessionToken) {
        return false;
    }

    const savedToken = await prisma.appSetting.findUnique({
        where: { key: "SESSION_TOKEN" },
    });

    return savedToken?.value === sessionToken;
}
