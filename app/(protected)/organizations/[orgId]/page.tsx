"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationManagement from "@/components/organization/OrganizationManagement";

export default function OrganizationPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params?.orgId as string;

  useEffect(() => {
    if (!orgId) {
      router.replace("/dashboard");
    }
  }, [orgId, router]);

  if (!orgId) {
    return null;
  }

  return <OrganizationManagement organizationId={orgId} />;
}
