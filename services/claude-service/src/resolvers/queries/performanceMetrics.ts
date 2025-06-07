import type { QueryResolvers } from "../../types/generated.js";

interface PerformanceMetrics {
  operations: Array<{
    name: string;
    count: number;
    avgDuration: number;
    p95Duration: number;
    p99Duration: number;
    errors: number;
  }>;
  timeline: Array<{
    timestamp: string;
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
  }>;
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
  };
}

// In-memory storage for demo purposes
const metricsHistory: Map<string, any[]> = new Map();

export const performanceMetrics: QueryResolvers["performanceMetrics"] = async (
  _parent,
  { service, timeRange },
  context
) => {
  context.logger.info("Fetching performance metrics", { service, timeRange });

  // Calculate time window based on timeRange
  const now = Date.now();
  const timeWindows = {
    "1h": 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000
  };
  const windowMs = timeWindows[timeRange || "1h"] || timeWindows["1h"];

  // Generate mock data for now - in production, this would query real metrics
  const operations = [
    {
      name: "executeCommand",
      count: Math.floor(Math.random() * 100) + 50,
      avgDuration: Math.floor(Math.random() * 200) + 100,
      p95Duration: Math.floor(Math.random() * 500) + 200,
      p99Duration: Math.floor(Math.random() * 1000) + 300,
      errors: Math.floor(Math.random() * 5)
    },
    {
      name: "generateCommitMessages",
      count: Math.floor(Math.random() * 50) + 20,
      avgDuration: Math.floor(Math.random() * 1500) + 500,
      p95Duration: Math.floor(Math.random() * 3000) + 1000,
      p99Duration: Math.floor(Math.random() * 5000) + 2000,
      errors: Math.floor(Math.random() * 2)
    },
    {
      name: "sessions",
      count: Math.floor(Math.random() * 200) + 100,
      avgDuration: Math.floor(Math.random() * 50) + 10,
      p95Duration: Math.floor(Math.random() * 100) + 20,
      p99Duration: Math.floor(Math.random() * 150) + 30,
      errors: 0
    }
  ];

  // Generate timeline data
  const timeline = [];
  const dataPoints = timeRange === "1h" ? 12 : timeRange === "24h" ? 24 : timeRange === "7d" ? 7 : 30;
  
  for (let i = 0; i < dataPoints; i++) {
    const timestamp = new Date(now - (windowMs / dataPoints) * i);
    timeline.unshift({
      timestamp: timestamp.toISOString(),
      requestsPerMinute: Math.floor(Math.random() * 100) + 50,
      avgResponseTime: Math.floor(Math.random() * 200) + 50,
      errorRate: Math.random() * 5
    });
  }

  // Get current resource usage
  const memUsage = process.memoryUsage();
  const resources = {
    cpuUsage: Math.random() * 100, // In production, use real CPU metrics
    memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
    activeConnections: Object.keys(context.sessionManager?.sessions || {}).length
  };

  return {
    operations,
    timeline,
    resources
  };
};
