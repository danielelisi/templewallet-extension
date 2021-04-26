import { useCallback, useMemo } from "react";

import { BakingBadBakerValueHistoryItem, bakingBadGetBaker } from "lib/baking-bad";
import { useRetryableSWR } from "lib/swr";
import { useTezos, useNetwork } from "lib/temple/front";
import { getAllBakers, getBaker, TNBaker } from "lib/tezos-nodes";

export function useDelegate(address: string, suspense = true) {
  const tezos = useTezos();

  const getDelegate = useCallback(async () => {
    try {
      return await tezos.rpc.getDelegate(address);
    } catch (err) {
      if (err.status === 404) {
        return null;
      }

      throw err;
    }
  }, [address, tezos]);

  return useRetryableSWR(["delegate", tezos.checksum, address], getDelegate, {
    dedupingInterval: 20_000,
    suspense,
  });
}

export function useKnownBaker(address: string | null, suspense = true) {
  const net = useNetwork();
  const fetchBaker = useCallback(async (): Promise<(TNBaker & {
    logo: string;
    feeHistory?: BakingBadBakerValueHistoryItem<number>[] | undefined
  }) | null> => {
    if (!address) return null;
    try {
      const baker = await getBaker(address);
      if (baker) {
        try {
          const bakingBadBaker = await bakingBadGetBaker({ address, configs: true });
          if (typeof bakingBadBaker === "object") {
            return {
              ...baker,
              fee: bakingBadBaker.fee,
              feeHistory: bakingBadBaker.config?.fee
            };
          }
        } catch {}
      }
      return baker;
    } catch (_err) {
      return null;
    }
  }, [address]);
  return useRetryableSWR(
    net.type === "main" && address ? ["baker", address] : null,
    fetchBaker,
    {
      refreshInterval: 120_000,
      dedupingInterval: 60_000,
      suspense,
    }
  );
}

export function useKnownBakers(suspense = true) {
  const net = useNetwork();
  const { data: bakers } = useRetryableSWR(
    net.type === "main" ? "all-bakers" : null,
    getAllBakers,
    {
      refreshInterval: 120_000,
      dedupingInterval: 60_000,
      suspense,
    }
  );

  return useMemo(() => (bakers && bakers.length > 1 ? bakers : null), [
    bakers,
  ]);
}
