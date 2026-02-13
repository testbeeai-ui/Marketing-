"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { PUBLIC_DEMO_ORGANIZATION_ID, APP_ADMIN_EMAILS } from "@/lib/constants";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  description?: string;
  role: "owner" | "admin" | "member";
  member_count?: number;
  created_at?: string;
  joined_at?: string;
}

const FALLBACK_ORG: Organization = {
  id: PUBLIC_DEMO_ORGANIZATION_ID,
  name: "Organization",
  slug: "demo",
  description: "View content in read-only mode. Request access to create and edit.",
  role: "member",
  member_count: 0,
};

interface OrganizationContextType {
  activeOrganization: Organization | null;
  organizations: Organization[];
  setActiveOrganization: (org: Organization | null) => void;
  refreshOrganizations: () => Promise<void>;
  loading: boolean;
  isDemoMode: boolean;
  /** True when current user email is in APP_ADMIN_EMAILS (e.g. maildpwd@gmail.com) – never show demo restriction. */
  isAppAdmin: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [activeOrganization, setActiveOrganizationState] = useState<Organization | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const fetchOrganizations = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setCurrentUserEmail(session?.user?.email ?? null);
      if (!session?.user) {
        setOrganizations([]);
        setLoading(false);
        return;
      }

      // Fetch organizations from API (includes member counts)
      const response = await fetch("/api/organizations", {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error || `Failed to fetch organizations (${response.status})`;
        console.error("API Error:", errorMessage, response.status);
        throw new Error(errorMessage);
      }

      const data = await response.json();
      // API always returns Demo Organization with correct role (owner/admin/member) so admins are never treated as demo users
      let orgs = (data.organizations || []) as Organization[];
      if (orgs.length === 0) {
        orgs = [FALLBACK_ORG];
      }
      const publicDemoOrg = orgs.find((o) => o.id === PUBLIC_DEMO_ORGANIZATION_ID);
      const rest = orgs.filter((o) => o.id !== PUBLIC_DEMO_ORGANIZATION_ID);
      if (publicDemoOrg) {
        orgs = [publicDemoOrg, ...rest];
      }
      setOrganizations(orgs);

      const savedOrgId = localStorage.getItem("activeOrganizationId");
      const savedOrg = orgs.find((o) => o.id === savedOrgId) || null;
      const firstRealOrg = orgs.find((o) => o.id !== PUBLIC_DEMO_ORGANIZATION_ID) || null;
      const activeOrg =
        savedOrg?.id === PUBLIC_DEMO_ORGANIZATION_ID && firstRealOrg
          ? firstRealOrg
          : savedOrg || firstRealOrg || orgs[0] || null;
      setActiveOrganizationState(activeOrg);
    } catch (error) {
      console.error("Error in fetchOrganizations:", error);
      // So new users always see Demo Organization even when API fails (e.g. network)
      setOrganizations([FALLBACK_ORG]);
      setActiveOrganizationState(FALLBACK_ORG);
    } finally {
      setLoading(false);
    }
  };

  // Set current user email as soon as session is available (so app-admin bypass works before org fetch)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUserEmail(session?.user?.email ?? null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserEmail(session?.user?.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const setActiveOrganization = (org: Organization | null) => {
    setActiveOrganizationState(org);
    if (org) {
      localStorage.setItem("activeOrganizationId", org.id);
    } else {
      localStorage.removeItem("activeOrganizationId");
    }
  };

  const isAppAdmin = currentUserEmail != null && APP_ADMIN_EMAILS.includes(currentUserEmail.toLowerCase());
  const isDemoMode =
    !isAppAdmin &&
    activeOrganization?.id === PUBLIC_DEMO_ORGANIZATION_ID &&
    activeOrganization?.role !== "owner" &&
    activeOrganization?.role !== "admin";

  return (
    <OrganizationContext.Provider
      value={{
        activeOrganization,
        organizations,
        setActiveOrganization,
        refreshOrganizations: fetchOrganizations,
        loading,
        isDemoMode,
        isAppAdmin,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error("useOrganization must be used within OrganizationProvider");
  }
  return context;
}
