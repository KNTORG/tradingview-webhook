import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";

export async function DELETE(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const olderThanDays = parseInt(
        searchParams.get("olderThanDays") || "30",
        10
    );

    if (isNaN(olderThanDays) || olderThanDays < 0) {
        return NextResponse.json(
            { error: "olderThanDays must be a non-negative integer" },
            { status: 400 }
        );
    }

    let result;
    if (olderThanDays === 0) {
        // Delete ALL messages
        result = await prisma.message.deleteMany({});
    } else {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        // Delete old messages
        result = await prisma.message.deleteMany({
            where: {
                receivedAt: {
                    lt: cutoffDate,
                },
            },
        });
    }

    // VACUUM to reclaim disk space
    await prisma.$executeRaw(Prisma.sql`VACUUM`);

    // Get new DB size
    let dbSize = 0;
    try {
        const dbUrl = process.env.DATABASE_URL || "file:./data/alerts.db";
        const dbPath = dbUrl.replace("file:", "");
        const resolvedPath = path.resolve(process.cwd(), dbPath);
        const stats = fs.statSync(resolvedPath);
        dbSize = stats.size;
    } catch {
        // ignore if we can't read the file
    }

    // Get remaining message count
    const remainingCount = await prisma.message.count();

    return NextResponse.json({
        deleted: result.count,
        remaining: remainingCount,
        dbSizeBytes: dbSize,
        dbSizeFormatted: formatBytes(dbSize),
    });
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export async function GET() {
    // Return current stats
    const totalMessages = await prisma.message.count();

    let dbSize = 0;
    try {
        const dbUrl = process.env.DATABASE_URL || "file:./data/alerts.db";
        const dbPath = dbUrl.replace("file:", "");
        const resolvedPath = path.resolve(process.cwd(), dbPath);
        const stats = fs.statSync(resolvedPath);
        dbSize = stats.size;
    } catch {
        // ignore
    }

    const oldestMessage = await prisma.message.findFirst({
        orderBy: { receivedAt: "asc" },
        select: { receivedAt: true },
    });

    return NextResponse.json({
        totalMessages,
        dbSizeBytes: dbSize,
        dbSizeFormatted: formatBytes(dbSize),
        oldestMessageDate: oldestMessage?.receivedAt || null,
    });
}
