"use client";

import dynamic from "next/dynamic";

export const InteractiveCollectionsChart = dynamic(
  () => import("@/components/charts/InteractiveCollectionsChart"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F8FA",
          borderRadius: 6,
          color: "#8A9099",
          fontSize: 12,
        }}
      >
        Loading dynamic chart…
      </div>
    ),
  }
);

export const ProductDistributionChart = dynamic(
  () => import("@/components/charts/ProductDistributionChart"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 210,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F8FA",
          borderRadius: 6,
          color: "#8A9099",
          fontSize: 12,
        }}
      >
        Loading distribution…
      </div>
    ),
  }
);

export const Asset3DCanvas = dynamic(
  () => import("@/components/three/Asset3DCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          height: 220,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F7F8FA",
          borderRadius: 8,
          border: "1px solid #E5E7EB",
          color: "#8A9099",
          fontSize: 12,
        }}
      >
        Initializing 3D canvas…
      </div>
    ),
  }
);
