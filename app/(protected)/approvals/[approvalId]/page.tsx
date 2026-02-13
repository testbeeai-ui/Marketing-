import { ApprovalDetail } from "@/components/approvals/ApprovalDetail";

interface ApprovalDetailPageProps {
  params: Promise<{ approvalId: string }>;
}

export default async function ApprovalDetailPage({ params }: ApprovalDetailPageProps) {
  const { approvalId } = await params;
  
  return (
    <div className="min-h-screen bg-background">
      <ApprovalDetail approvalId={approvalId} />
    </div>
  );
}
