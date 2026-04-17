import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    await prisma.offeringSlot.deleteMany({
      where: {
        offeringId: id,
      },
    });

    await prisma.offeringBatch.deleteMany({
      where: {
        offeringId: id,
      },
    });

    await prisma.offering.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Offering deleted successfully.",
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to delete offering." },
      { status: 500 }
    );
  }
}