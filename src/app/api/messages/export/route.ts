import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const where: { receivedAt?: { gte?: Date; lte?: Date } } = {};
    if (startDate || endDate) {
        where.receivedAt = {};
        if (startDate) {
            where.receivedAt.gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            where.receivedAt.lte = end;
        }
    }

    const messages = await prisma.message.findMany({
        where,
        orderBy: { receivedAt: "desc" },
    });

    // Create CSV header
    const headers = ["ID", "Received At (UTC)", "Text", "Status", "Speakers", "Error"];
    const rows = messages.map((m) => [
        m.id,
        m.receivedAt.toISOString(),
        // Escape quotes and wrap in quotes for CSV
        `"${m.text.replace(/"/g, '""')}"`,
        m.status,
        `"${m.speakers.replace(/"/g, '""')}"`,
        m.error ? `"${m.error.replace(/"/g, '""')}"` : "",
    ]);

    const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.join(",")),
    ].join("\n");

    const filename = `trade-alerts-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;

    return new NextResponse(csvContent, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="${filename}"`,
        },
    });
}
