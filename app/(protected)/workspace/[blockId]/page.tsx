import Workspace from "@/components/pages/Workspace";

export default async function WorkspacePage({
    params,
}: {
    params: Promise<{ blockId: string }>;
}) {
    // In Next.js 15, params is a Promise that must be awaited
    await params;
    
    return <Workspace />;
}
