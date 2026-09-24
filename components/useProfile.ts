"use client";

import { useCallback, useEffect, useState } from "react";
import { PROFILE_STORAGE_KEY, clearProfile, loadProfile, sanitizeProfile, saveProfile } from "@/lib/eligibility/profile";
import type { ApplicantProfile } from "@/lib/eligibility/types";

/** Applicant profile kept in this browser only, synced across open tabs. */
export function useProfile() {
  const [profile, setProfile] = useState<ApplicantProfile>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setLoaded(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PROFILE_STORAGE_KEY || event.key === null) setProfile(loadProfile());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((next: ApplicantProfile) => {
    saveProfile(next);
    // Keep it for this visit even when storage is blocked.
    setProfile(sanitizeProfile(next));
  }, []);

  const clear = useCallback(() => {
    clearProfile();
    setProfile({});
  }, []);

  return { profile, loaded, update, clear };
}
