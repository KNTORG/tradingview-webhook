import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
        100,
        Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
        prisma.message.findMany({
            orderBy: { receivedAt: "desc" },
            skip,
            take: limit,
        }),
        prisma.message.count(),
    ]);

    return NextResponse.json({
        messages: messages.map((m) => ({
            ...m,
            speakers: JSON.parse(m.speakers),
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    });
}
