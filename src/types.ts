/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Comment {
  id: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface TimelineEvent {
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  description: string;
  timestamp: string;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  category: string;
  urgency: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Reported' | 'Verified' | 'In Progress' | 'Resolved';
  neighborhood: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  reportedBy: string;
  reportedAt: string;
  verifiedByCount: number;
  verifiedUsers: string[];
  imageUrl?: string;
  comments: Comment[];
  estimatedDaysToResolve: number;
  aiAnalysis?: string;
  aiConfidence?: number;
  aiSummary?: string;
  aiSafetyRecommendations?: string[];
  aiVisionAnalysis?: {
    detectedIssue: string;
    confidence: number;
    severity: string;
    estimatedDimensions?: string;
    potentialRisk: string;
    suggestedAction: string;
    checks: { label: string; checked: boolean }[];
  };
  timeline: TimelineEvent[];
}

export interface NeighborhoodConfig {
  id: string;
  name: string;
  description: string;
  centerLat: number;
  centerLng: number;
  latRange: number;
  lngRange: number;
  streets: string[];
  features: {
    name: string;
    type: 'park' | 'water';
    xPercent: number; // position as % of width
    yPercent: number; // position as % of height
    widthPercent?: number;
    heightPercent?: number;
    radiusPercent?: number;
  }[];
}

export interface UserStats {
  userName: string;
  level: number;
  xp: number;
  badges: {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlockedAt?: string;
  }[];
  reportsCount: number;
  verificationsCount: number;
  impactPoints: number;
}

export interface NeighborhoodStats {
  totalIssues: number;
  resolvedIssues: number;
  activeIssues: number;
  criticalIssues: number;
  avgResolutionTimeDays: number;
  categoryDistribution: { category: string; count: number }[];
  impactPointsSaved: number;
}

export interface PredictiveInsight {
  title: string;
  description: string;
  severity: 'Info' | 'Warning' | 'Urgent';
  affectedArea: string;
  recommendingAction: string;
  impactOfAction: string;
}
