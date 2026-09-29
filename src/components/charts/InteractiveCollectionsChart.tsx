"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CollectionsDataPoint {
  month: string;
  amount: number;
}

export default function InteractiveCollectionsChart({
  data,
  title = "Monthly Revenue Trend",
}: {
  data: CollectionsDataPoint[];
  title?: string;
}) {
  const chartData = useMemo(() => {
    return {
      labels: data.map((d) => d.month),
      datasets: [
        {
          label: "Confirmed Collections (AED)",
          data: data.map((d) => d.amount),
          borderColor: "#0F4C3A",
          backgroundColor: "rgba(15, 76, 58, 0.08)",
          borderWidth: 2,
          pointBackgroundColor: "#0F4C3A",
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: "#0C3D2E",
          tension: 0.35,
          fill: true,
        },
      ],
    };
  }, [data]);

  const options: any = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: "#111418",
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
          padding: 10,
          cornerRadius: 6,
          displayColors: false,
          callbacks: {
            label: function (context: any) {
              const val = context.parsed.y || 0;
              return (
                "AED " +
                val.toLocaleString("en-AE", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })
              );
            },
          },
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: "#8A9099",
            font: {
              family: "Inter, sans-serif",
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "#E5E7EB",
            lineWidth: 1,
          },
          border: {
            dash: [4, 4],
          },
          ticks: {
            color: "#8A9099",
            font: {
              family: "Inter, sans-serif",
              size: 11,
            },
            callback: function (value: any) {
              if (value >= 1000000) return (value / 1000000).toFixed(1) + "M";
              if (value >= 1000) return (value / 1000).toFixed(0) + "k";
              return value;
            },
          },
        },
      },
    };
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#111418",
          }}
        >
          {title}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#0F4C3A",
            backgroundColor: "#EAF3EF",
            padding: "2px 8px",
            borderRadius: 12,
            fontWeight: 500,
          }}
        >
          Live Interactive
        </span>
      </div>
      <div style={{ height: "clamp(160px, 40vw, 220px)", position: "relative" }}>
        <Line data={chartData} options={options} />
      </div>
    </div>
  );
}
