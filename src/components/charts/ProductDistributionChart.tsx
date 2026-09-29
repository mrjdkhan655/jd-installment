"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ProductStat {
  kind: string;
  label: string;
  count: number;
  totalValue: number;
}

export default function ProductDistributionChart({
  stats,
}: {
  stats: ProductStat[];
}) {
  const chartData = useMemo(() => {
    return {
      labels: stats.map((s) => s.label),
      datasets: [
        {
          data: stats.map((s) => s.totalValue),
          backgroundColor: ["#0F4C3A", "#B45309", "#1D4ED8"],
          hoverBackgroundColor: ["#0C3D2E", "#92400E", "#1E40AF"],
          borderColor: "#FFFFFF",
          borderWidth: 2,
        },
      ],
    };
  }, [stats]);

  const options: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            font: {
              family: "Inter, sans-serif",
              size: 11,
            },
            color: "#4B5563",
            usePointStyle: true,
            padding: 14,
          },
        },
        tooltip: {
          backgroundColor: "#111418",
          padding: 10,
          cornerRadius: 6,
          titleFont: {
            family: "Inter, sans-serif",
            size: 12,
            weight: "600",
          },
          bodyFont: {
            family: "Inter, monospace, sans-serif",
            size: 13,
            weight: "500",
          },
          callbacks: {
            label: function (context: any) {
              const val = context.parsed || 0;
              return (
                " " +
                context.label +
                ": AED " +
                val.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              );
            },
          },
        },
      },
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div style={{ height: 210, position: "relative" }}>
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
  );
}
