import { useCallback, useEffect, useState } from "react";
import { fetchStaffOverview, type StaffOverview } from "@/services/staffAuth";
import { useAppSession } from "@/contexts/AppSessionContext";

/** Shared loader for staff portal pages — one staff_overview call per token. */
export function useStaffData() {
  const { session } = useAppSession();
  const token = session?.kind === "staff" ? session.token : null;
  const [data, setData] = useState<StaffOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetchStaffOverview(token);
      if (!cancelled) {
        setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, nonce]);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  return { data, loading, token, refresh };
}
