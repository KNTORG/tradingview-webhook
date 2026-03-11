import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Seeding database with default speaker schedules...");

    const speakers = [
        { name: "Family Room speaker", ip: null as string | null },
        { name: "Bedroom speaker", ip: null as string | null },
    ];

    for (const speaker of speakers) {
        // Check if speaker already has schedules
        const existing = await prisma.speakerSchedule.findFirst({
            where: { speakerName: speaker.name },
        });

        if (existing) {
            console.log(`  ⏭  "${speaker.name}" already has schedules, skipping.`);
            continue;
        }

        // Create default schedule: Mon-Sun 08:00-22:00
        for (let day = 0; day < 7; day++) {
            await prisma.speakerSchedule.create({
                data: {
                    speakerName: speaker.name,
                    speakerIp: speaker.ip,
                    dayOfWeek: day,
                    startTime: "08:00",
                    endTime: "22:00",
                    enabled: true,
                },
            });
        }

        console.log(`  ✓  "${speaker.name}" — 7 schedule rules created.`);
    }

    console.log("\nDone! You can modify schedules from the Settings page.");
}

main()
    .then(() => prisma.$disconnect())
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
