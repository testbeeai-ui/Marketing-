"use client";

import { Suspense } from "react";
import { ResetPassword } from "@/components/pages/ResetPassword";

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
            <ResetPassword />
        </Suspense>
    );
}
